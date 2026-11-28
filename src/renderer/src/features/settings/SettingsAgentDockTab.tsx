import { AGENT_DOCK_SIZE_LIMITS, type AgentDockDisplay, type AgentDockDisplayInfo } from "@starbot/contracts/ipc";
import type { AppTextKey } from "@starbot/i18n";
import {
  Button,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SettingsSection,
  SliderField,
  SwitchField,
} from "@starbot/ui";
import type { ComposerAgent } from "@starbot/ui/data";
import type { JSX } from "@solidjs/web";
import { createMemo, createSignal, onCleanup, onSettled, Show } from "solid-js";
import { useI18n } from "../../i18n-context";
import { usePlatform } from "../../platform";
import { agentDockPort } from "../agent-dock/agent-dock-port";
import {
  type AgentDockPlacement,
  setAgentDockPreference,
  useAgentDockPreference,
} from "../agent-dock/agent-dock-preference";
import { XWaylandRestartRow } from "./XWaylandRestartRow";

export interface AgentDockSettingsModel {
  server: { id: string; name: string } | null;
  agents: readonly ComposerAgent[];
  hiddenAgentIds: ReadonlySet<string>;
}

const PLACEMENT_LABEL = {
  screen: "settings.agentDock.placement.screen",
  window: "settings.agentDock.placement.window",
} as const satisfies Record<AgentDockPlacement, AppTextKey>;

const PRESET_SHORTCUTS = ["DoubleTap:Alt", "Alt+Space", "Alt+S", "DoubleTap:Control", "custom", "off"] as const;
type ShortcutMenuId = (typeof PRESET_SHORTCUTS)[number];

const KEY_CODE_MAP: Readonly<Record<string, { accel: string; label: string }>> = {
  Space: { accel: "Space", label: "空格" },
  Tab: { accel: "Tab", label: "Tab" },
  Backquote: { accel: "`", label: "`" },
  Minus: { accel: "-", label: "-" },
  Equal: { accel: "=", label: "=" },
  BracketLeft: { accel: "[", label: "[" },
  BracketRight: { accel: "]", label: "]" },
  Backslash: { accel: "\\", label: "\\" },
  Semicolon: { accel: ";", label: ";" },
  Quote: { accel: "'", label: "'" },
  Comma: { accel: ",", label: "," },
  Period: { accel: ".", label: "." },
  Slash: { accel: "/", label: "/" },
};

function keyFromEventCode(code: string): { accel: string; label: string } | null {
  if (/^Key([A-Z])$/.test(code)) {
    const ch = code.slice(3);
    return { accel: ch, label: ch };
  }
  if (/^Digit([0-9])$/.test(code)) {
    const d = code.slice(5);
    return { accel: d, label: d };
  }
  if (/^F([1-9]|1[0-2])$/.test(code)) {
    return { accel: code, label: code };
  }
  return KEY_CODE_MAP[code] ?? null;
}

function modifierNameOfCode(code: string): "Alt" | "Control" | "Shift" | "Command" | null {
  if (code === "AltLeft" || code === "AltRight") return "Alt";
  if (code === "ControlLeft" || code === "ControlRight") return "Control";
  if (code === "ShiftLeft" || code === "ShiftRight") return "Shift";
  if (code === "MetaLeft" || code === "MetaRight") return "Command";
  return null;
}

function formatCompanionShortcut(shortcut: string | null, isMac: boolean): string {
  if (!shortcut || shortcut === "off") return "关闭快捷键";
  if (shortcut.startsWith("DoubleTap:")) {
    const target = shortcut.slice("DoubleTap:".length);
    if (target === "Alt") return isMac ? "连按两下 ⌥" : "连按两下 Alt";
    if (target === "Control") return isMac ? "连按两下 ⌃" : "连按两下 Ctrl";
    if (target === "Shift") return isMac ? "连按两下 ⇧" : "连按两下 Shift";
    if (target === "Command") return isMac ? "连按两下 ⌘" : "连按两下 Win";
    return `连按两下 ${target}`;
  }
  return shortcut
    .split("+")
    .map((part) => {
      if (part === "Alt" || part === "Option") return isMac ? "⌥" : "Alt";
      if (part === "Control" || part === "Ctrl") return isMac ? "⌃" : "Ctrl";
      if (part === "Shift") return isMac ? "⇧" : "Shift";
      if (part === "Command" || part === "Meta" || part === "CommandOrControl") return isMac ? "⌘" : "Ctrl";
      if (part === "Space") return "空格";
      return part;
    })
    .join(" + ");
}

export function SettingsAgentDockTab(props: { model: AgentDockSettingsModel; selectMount?: HTMLElement | undefined }) {
  const i18n = useI18n();
  const preference = useAgentDockPreference();
  const platform = usePlatform();
  const isMac = () => (platform.appInfo()?.platform ?? "darwin") === "darwin";
  const screenSupport = () =>
    preference().shown && preference().placement === "screen" ? platform.appInfo()?.aboveAppsSupport : undefined;
  const aboveApps = () => preference().shown && preference().placement === "screen";

  const [recording, setRecording] = createSignal(false);
  const [recorderHint, setRecorderHint] = createSignal<string | null>(null);
  let recorderRoot: HTMLDivElement | undefined;
  let lastSoloModifier: { mod: "Alt" | "Control" | "Shift" | "Command"; endedAt: number } | null = null;
  let currentSoloModifier: {
    mod: "Alt" | "Control" | "Shift" | "Command";
    startedAt: number;
    tainted: boolean;
  } | null = null;

  const isPreset = (val: string | null): val is Exclude<ShortcutMenuId, "custom"> =>
    val === "DoubleTap:Alt" || val === "Alt+Space" || val === "Alt+S" || val === "DoubleTap:Control";

  const selectedMenuId = (): ShortcutMenuId => {
    const cur = preference().shortcut;
    if (!cur) return "off";
    if (isPreset(cur)) return cur;
    return "custom";
  };

  const menuLabel = (id: ShortcutMenuId): string => {
    const mac = isMac();
    if (id === "DoubleTap:Alt") return mac ? "连按两下 ⌥（推荐）" : "连按两下 Alt（推荐）";
    if (id === "Alt+Space") return mac ? "⌥ + 空格" : "Alt + 空格";
    if (id === "Alt+S") return mac ? "⌥ + S" : "Alt + S";
    if (id === "DoubleTap:Control") return mac ? "连按两下 ⌃" : "连按两下 Ctrl";
    if (id === "off") return "关闭快捷键";
    const cur = preference().shortcut;
    if (cur && !isPreset(cur)) {
      return `自定义：${formatCompanionShortcut(cur, mac)}`;
    }
    return "自定义快捷键…";
  };

  function stopRecording(): void {
    if (!recording()) return;
    setRecording(false);
    setRecorderHint(null);
    currentSoloModifier = null;
    lastSoloModifier = null;
    window.removeEventListener("keydown", onRecordKeyDown, true);
    window.removeEventListener("keyup", onRecordKeyUp, true);
    window.removeEventListener("pointerdown", onRecordPointerOutside, true);
    window.removeEventListener("blur", stopRecording);
  }

  function startRecording(): void {
    if (recording()) return;
    setRecorderHint(null);
    currentSoloModifier = null;
    lastSoloModifier = null;
    setRecording(true);
    window.addEventListener("keydown", onRecordKeyDown, true);
    window.addEventListener("keyup", onRecordKeyUp, true);
    window.addEventListener("pointerdown", onRecordPointerOutside, true);
    window.addEventListener("blur", stopRecording);
  }

  const onRecordPointerOutside = (event: PointerEvent) => {
    if (recorderRoot && event.target instanceof Node && recorderRoot.contains(event.target)) return;
    stopRecording();
  };

  const onRecordKeyDown = (event: KeyboardEvent) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat) return;

    if (event.code === "Escape" && !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
      stopRecording();
      return;
    }

    const modName = modifierNameOfCode(event.code);
    const activeMods: string[] = [];
    if (event.metaKey) activeMods.push(isMac() ? "Command" : "CommandOrControl");
    if (event.ctrlKey) activeMods.push("Control");
    if (event.altKey) activeMods.push("Alt");
    if (event.shiftKey) activeMods.push("Shift");

    if (modName) {
      if (activeMods.length > 1) {
        if (currentSoloModifier) currentSoloModifier.tainted = true;
        setRecorderHint("最多支持 2 个按键组合");
        return;
      }
      currentSoloModifier = { mod: modName, startedAt: Date.now(), tainted: false };
      if (lastSoloModifier && lastSoloModifier.mod === modName && Date.now() - lastSoloModifier.endedAt <= 450) {
        const saved = `DoubleTap:${modName}`;
        stopRecording();
        setAgentDockPreference({ shortcut: saved });
        return;
      }
      setRecorderHint(
        `再按一下 ${formatCompanionShortcut(`DoubleTap:${modName}`, isMac()).replace("连按两下 ", "")} 设为双击，或配合另一键`,
      );
      return;
    }

    // Regular key pressed
    if (currentSoloModifier) currentSoloModifier.tainted = true;
    lastSoloModifier = null;

    if (activeMods.length > 1) {
      setRecorderHint("最多使用 2 个按键，请重按");
      return;
    }

    const parsedKey = keyFromEventCode(event.code);
    if (!parsedKey) {
      setRecorderHint("不支持该按键，请换一个键");
      return;
    }

    if (activeMods.length === 1) {
      const combo = `${activeMods[0]}+${parsedKey.accel}`;
      stopRecording();
      setAgentDockPreference({ shortcut: combo });
      return;
    }

    // Single non-modifier key: allow F1-F12 directly, or double-tap for other keys
    if (/^F([1-9]|1[0-2])$/.test(event.code)) {
      stopRecording();
      setAgentDockPreference({ shortcut: parsedKey.accel });
      return;
    }
    setRecorderHint("请搭配 1 个修饰键（如 ⌥ + 字母），或连按两下修饰键");
  };

  const onRecordKeyUp = (event: KeyboardEvent) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const modName = modifierNameOfCode(event.code);
    if (!modName || !currentSoloModifier || currentSoloModifier.mod !== modName) return;
    const now = Date.now();
    if (!currentSoloModifier.tainted && now - currentSoloModifier.startedAt <= 340) {
      lastSoloModifier = { mod: modName, endedAt: now };
    } else {
      lastSoloModifier = null;
    }
    currentSoloModifier = null;
  };

  onCleanup(stopRecording);

  return (
    <SettingsSection title={i18n.t("settings.agentDock.title")}>
      <ItemGroup class="settings-modal-card">
        <SwitchField
          data-settings-row="settings.agentDock.show.title"
          checked={preference().shown}
          onChange={(shown) => setAgentDockPreference({ shown })}
          label={i18n.t("settings.agentDock.show.title")}
          description={i18n.t("settings.agentDock.show.description")}
        />
        <Item class="settings-modal-row">
          <ItemContent>
            <ItemTitle>呼出 / 隐藏快捷键</ItemTitle>
            <ItemDescription>
              {recording()
                ? (recorderHint() ?? "请按下最多 2 个按键，或连按两下同一修饰键（Esc 取消）")
                : "最多 2 个按键或连按两下单个修饰键，随时调出或关闭悬浮星友。"}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <div ref={recorderRoot} style={{ display: "inline-flex", "align-items": "center", gap: "8px" }}>
              <Show
                when={recording()}
                fallback={
                  <>
                    <ChoiceSelect<ShortcutMenuId>
                      value={selectedMenuId()}
                      text={menuLabel}
                      choices={PRESET_SHORTCUTS}
                      label="呼出与隐藏快捷键"
                      disabled={false}
                      mount={props.selectMount}
                      onChange={(choice) => {
                        if (choice === "custom") {
                          startRecording();
                          return;
                        }
                        setAgentDockPreference({ shortcut: choice === "off" ? null : choice });
                      }}
                    />
                    <Button variant="outline" size="sm" type="button" onClick={startRecording}>
                      自定义
                    </Button>
                  </>
                }
              >
                <Button variant="outline" size="sm" type="button" onClick={stopRecording}>
                  正在录制… 取消
                </Button>
              </Show>
            </div>
          </ItemActions>
        </Item>
        <Item data-settings-row="settings.agentDock.placement.title" class="settings-modal-row">
          <ItemContent>
            <ItemTitle>{i18n.t("settings.agentDock.placement.title")}</ItemTitle>
            <ItemDescription>{i18n.t("settings.agentDock.placement.description")}</ItemDescription>
          </ItemContent>
          <ItemActions>
            <ChoiceSelect
              value={preference().placement}
              text={(placement) => i18n.t(PLACEMENT_LABEL[placement])}
              choices={["screen", "window"]}
              label={i18n.t("settings.agentDock.placement.title")}
              disabled={!preference().shown}
              mount={props.selectMount}
              onChange={(placement) => setAgentDockPreference({ placement })}
            />
          </ItemActions>
        </Item>
        <XWaylandRestartRow
          support={screenSupport()}
          keys={{
            title: "settings.agentDock.xwayland.title",
            description: "settings.agentDock.xwayland.description",
            unsupported: "settings.agentDock.xwayland.unsupported",
            restart: "settings.agentDock.xwayland.restart",
          }}
          onRestart={() => agentDockPort().agentDock.setXWayland({ enabled: true })}
        />
        <Item data-settings-row="settings.agentDock.display.title" class="settings-modal-row">
          <ItemContent>
            <ItemTitle>{i18n.t("settings.agentDock.display.title")}</ItemTitle>
          </ItemContent>
          <ItemActions>
            <DisplaySelect
              value={preference().display}
              disabled={!aboveApps()}
              mount={props.selectMount}
              onChange={(display) => setAgentDockPreference({ display })}
            />
          </ItemActions>
        </Item>
        <div data-settings-row="settings.agentDock.size.title" class="settings-agent-dock-size">
          <SliderField
            label={i18n.t("settings.agentDock.size.title")}
            value={preference().sizePercent}
            minValue={AGENT_DOCK_SIZE_LIMITS.min}
            maxValue={AGENT_DOCK_SIZE_LIMITS.max}
            step={AGENT_DOCK_SIZE_LIMITS.step}
            disabled={!preference().shown}
            formatValue={(value) => `${value}%`}
            onChange={(sizePercent) => setAgentDockPreference({ sizePercent })}
          />
        </div>
      </ItemGroup>
    </SettingsSection>
  );
}

function ChoiceSelect<T extends string>(props: {
  value: T;
  choices: readonly T[];
  text: (value: T) => string;
  label: string;
  disabled: boolean;
  mount: HTMLElement | undefined;
  onChange: (value: T) => void;
}): JSX.Element {
  const options = createMemo(() => props.choices.map((id) => ({ id })));
  const label = (id: T) => props.text(id);
  return (
    <Select<{ id: T }>
      class="settings-modal-select"
      options={options()}
      optionValue="id"
      optionTextValue={(option) => label(option.id)}
      value={options().find((option) => option.id === props.value) ?? null}
      disabled={props.disabled}
      onChange={(option) => option && props.onChange(option.id)}
      placement="bottom-end"
      itemComponent={(itemProps) => <SelectItem item={itemProps.item}>{label(itemProps.item.rawValue.id)}</SelectItem>}
    >
      <SelectTrigger size="sm" aria-label={props.label}>
        <SelectValue<{ id: T }>>{(state) => label(state.selectedOption().id)}</SelectValue>
      </SelectTrigger>
      <SelectContent mount={props.mount} />
    </Select>
  );
}

function displayKey(display: AgentDockDisplay): string {
  return display.kind === "display" ? `display:${display.id}` : display.kind;
}

function keyDisplay(key: string): AgentDockDisplay {
  if (key === "window" || key === "primary" || key === "all") return { kind: key };
  return { kind: "display", id: Number(key.slice("display:".length)) };
}

function sameKeys(before: string[], after: string[]): boolean {
  return before.length === after.length && before.every((key, index) => key === after[index]);
}

function DisplaySelect(props: {
  value: AgentDockDisplay;
  disabled: boolean;
  mount: HTMLElement | undefined;
  onChange: (display: AgentDockDisplay) => void;
}): JSX.Element {
  const i18n = useI18n();
  const [displays, setDisplays] = createSignal<AgentDockDisplayInfo[]>([]);
  let active = true;
  const load = () =>
    void agentDockPort()
      .agentDock.listDisplays()
      .then((list) => {
        if (active) setDisplays(list);
      })
      .catch(() => undefined);
  onSettled(() => {
    load();
    return () => {
      active = false;
    };
  });

  const options = createMemo(
    (): string[] => {
      const listed = displays().map((display) => `display:${display.id}`);
      const saved = displayKey(props.value);
      const extra = props.value.kind === "display" && !listed.includes(saved) ? [saved] : [];
      return ["window", "primary", "all", ...listed, ...extra];
    },
    { equals: sameKeys },
  );

  const label = (key: string): string => {
    if (key === "window") return i18n.t("settings.agentDock.display.window");
    if (key === "primary") return i18n.t("settings.agentDock.display.primary");
    if (key === "all") return i18n.t("settings.agentDock.display.all");
    const index = displays().findIndex((display) => `display:${display.id}` === key);
    if (index < 0) return i18n.t("settings.agentDock.display.disconnected");
    return displays()[index]?.label || i18n.t("settings.agentDock.display.unnamed", { number: index + 1 });
  };

  return (
    <Select<string>
      class="settings-modal-select"
      options={options()}
      value={displayKey(props.value)}
      disabled={props.disabled}
      onOpenChange={(open) => {
        if (open) load();
      }}
      onChange={(key) => {
        if (key && key !== displayKey(props.value)) props.onChange(keyDisplay(key));
      }}
      placement="bottom-end"
      sameWidth={false}
      itemComponent={(item) => <SelectItem item={item.item}>{label(item.item.rawValue)}</SelectItem>}
    >
      <SelectTrigger size="sm" aria-label={i18n.t("settings.agentDock.display.title")}>
        <SelectValue<string>>{(state) => label(state.selectedOption() ?? "window")}</SelectValue>
      </SelectTrigger>
      <SelectContent mount={props.mount} />
    </Select>
  );
}
