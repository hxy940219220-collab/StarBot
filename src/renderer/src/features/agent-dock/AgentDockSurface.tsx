import type {
  AgentDockAction,
  AgentDockOffset,
  AgentDockPresentation,
  StarBotCompanionInfo,
} from "@starbot/contracts/ipc";
import { createEffect, createMemo, createSignal, onSettled, Show } from "solid-js";
import { currentDevicePlatform } from "../../send-shortcut-preference";
import { windowShape } from "../../window-shape";
import { agentDockPort } from "./agent-dock-port";
import { createAgentDockVoice } from "./agent-dock-voice";
import { StarBotFloatingCompanion } from "./StarBotFloatingCompanion";

const SHAPED_WINDOW = currentDevicePlatform() === "linux" || currentDevicePlatform() === "win32";

export function AgentDockSurface() {
  const [presentation, setPresentation] = createSignal<AgentDockPresentation | null>(null);
  const [livePlacement, setLivePlacement] = createSignal<AgentDockOffset | null>(null);
  const [closePanelNonce, setClosePanelNonce] = createSignal(0);
  let received = false;
  let pointerIn = false;
  let dragging = false;
  let panelOpen = false;
  let sentInteractive: boolean | null = null;
  let sentKeyboard: boolean | null = null;
  let sentShape = "";

  const apply = (next: AgentDockPresentation | null) => {
    received = true;
    setPresentation(next);
  };

  const perform = (action: AgentDockAction) => agentDockPort().agentDock.performAction(action);

  function syncShape(): void {
    if (!SHAPED_WINDOW) return;
    const hitNodes = [...document.querySelectorAll<HTMLElement>("[data-companion-hit]")];
    const rects = hitNodes
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({
        x: Math.max(0, Math.floor(r.left - 8)),
        y: Math.max(0, Math.floor(r.top - 8)),
        width: Math.ceil(r.width + 16),
        height: Math.ceil(r.height + 16),
      }));
    const shape = windowShape(rects);
    const key = JSON.stringify(shape);
    if (key === sentShape) return;
    sentShape = key;
    void agentDockPort()
      .agentDock.setInputRegion(shape)
      .catch(() => undefined);
  }

  function syncInteractive(): void {
    const active = pointerIn || dragging;
    const keyboard = panelOpen;
    if (active === sentInteractive && keyboard === sentKeyboard) return;
    sentInteractive = active;
    sentKeyboard = keyboard;
    void agentDockPort()
      .agentDock.setInteractive({ interactive: active, keyboard })
      .catch(() => undefined);
  }

  onSettled(() => {
    const unsubscribe = agentDockPort().agentDock.onPresentation(apply);
    const stopMoved = agentDockPort().agentDock.onMoved((offset) => {
      setLivePlacement(offset);
      requestAnimationFrame(() => syncShape());
    });
    const stopCloseChat = agentDockPort().agentDock.onCloseChat(() => {
      setClosePanelNonce((n) => n + 1);
    });
    void agentDockPort()
      .agentDock.getPresentation()
      .then((value) => {
        if (!received) apply(value);
      })
      .catch(() => undefined);

    const onPointer = (event: MouseEvent) => {
      const target = event.target;
      pointerIn = target instanceof Element && target.closest("[data-companion-hit]") !== null;
      syncInteractive();
      syncShape();
    };
    const onLeave = () => {
      if (dragging) return;
      pointerIn = false;
      syncInteractive();
    };
    const observer = SHAPED_WINDOW ? new MutationObserver(() => syncShape()) : undefined;
    observer?.observe(document.body, { childList: true, subtree: true, attributes: true });
    document.addEventListener("mouseover", onPointer);
    document.addEventListener("mousemove", onPointer);
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      unsubscribe();
      stopMoved();
      stopCloseChat();
      observer?.disconnect();
      document.removeEventListener("mouseover", onPointer);
      document.removeEventListener("mousemove", onPointer);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    };
  });

  const serverId = createMemo(() => presentation()?.serverId ?? null);
  const voice = createAgentDockVoice(() => serverId() ?? "local");

  createEffect(serverId, () => {
    dragging = false;
    syncInteractive();
  });

  const companionBots = createMemo<readonly StarBotCompanionInfo[]>(() => {
    const pres = presentation();
    if (!pres) return [];
    if (pres.companionBots && pres.companionBots.length > 0) return pres.companionBots;
    return pres.agents.map((ag) => ({
      agent: ag,
      mood: "idle",
      working: false,
      provider: "",
      model: "",
      modelLabel: ag.title || "默认模型",
      latestReplyId: null,
      latestReplyText: null,
      usage: {
        contextUsedTokens: 0,
        contextWindowTokens: 128_000,
        contextEstimated: true,
        messageCount: 0,
        turnCount: 0,
        quotaPercentUsed: null,
        quotaResetsAt: null,
      },
    }));
  });

  const effectiveOffset = createMemo<AgentDockOffset | undefined>(() => {
    const live = livePlacement();
    if (live) return live;
    return presentation()?.offsets.at(-1);
  });

  const expandSide = createMemo<"left" | "right">(() => {
    const current = effectiveOffset();
    if (current?.dockedEdge === "left") return "right";
    if (current?.dockedEdge === "right") return "left";
    const lastX = current?.xOffset;
    if (lastX !== undefined) return lastX <= 0.45 ? "right" : "left";
    return presentation()?.edge === "left" ? "right" : "left";
  });

  return (
    <Show when={serverId()} keyed>
      {(server) => (
        <StarBotFloatingCompanion
          bots={companionBots()}
          activeBotId={presentation()?.companionAgentId ?? companionBots()[0]?.agent.id ?? null}
          modelChoices={presentation()?.companionModelChoices ?? []}
          sizePercent={presentation()?.sizePercent ?? 100}
          expandSide={expandSide()}
          anchorX={effectiveOffset()?.anchorX}
          anchorY={effectiveOffset()?.anchorY}
          stageWidth={effectiveOffset()?.windowWidth}
          stageHeight={effectiveOffset()?.windowHeight}
          dockedEdge={effectiveOffset()?.dockedEdge ?? null}
          closePanelNonce={closePanelNonce()}
          onPanelOpenChange={(open) => {
            panelOpen = open;
            syncInteractive();
          }}
          voice={voice}
          onDrag={(phase) => {
            dragging = phase !== "end";
            syncInteractive();
            void agentDockPort()
              .agentDock.drag(phase)
              .catch(() => undefined);
          }}
          onSelectBot={(agentId) => {
            void perform({ type: "select-companion", serverId: server, agentId }).catch(() => undefined);
          }}
          onSendVoiceText={async (agentId, text) => {
            await perform({
              type: "send",
              serverId: server,
              seat: { kind: "agent", id: agentId },
              text,
              clientMessageId: crypto.randomUUID(),
            });
          }}
          onSwitchModel={(agentId, provider, model) => {
            void perform({ type: "switch-model", serverId: server, agentId, provider, model }).catch(() => undefined);
          }}
          onStarBotChat={(agentId) => {
            void perform({ type: "open-agent", serverId: server, agentId }).catch(() => undefined);
          }}
          onResizeSizePercent={(sizePercent) => {
            void perform({ type: "set-size", sizePercent }).catch(() => undefined);
          }}
          onHide={() => {
            void perform({ type: "hide" }).catch(() => undefined);
          }}
          onVoiceStateChange={(st) => {
            void perform({
              type: "voice-sync",
              serverId: server,
              active: st.active,
              ...(st.phase ? { phase: st.phase } : {}),
              ...(st.elapsedSeconds !== undefined ? { elapsedSeconds: st.elapsedSeconds } : {}),
              ...(st.liveText !== undefined ? { liveText: st.liveText } : {}),
              ...(st.levels ? { levels: st.levels } : {}),
              ...(st.agentId !== undefined ? { agentId: st.agentId } : {}),
            }).catch(() => undefined);
          }}
        />
      )}
    </Show>
  );
}
