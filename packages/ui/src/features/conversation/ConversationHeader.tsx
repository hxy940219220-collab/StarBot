import { INPUT_LIMITS } from "@openbot/contracts/input-limits";
import { Badge, Button, Clock3, Input } from "@openbot/ui";
import { ProviderModelPicker } from "@openbot/ui/components/ProviderModelPicker";
import type { AgentProfile } from "@openbot/ui/data";
import { RemoteDesktopIcon } from "@openbot/ui/features/conversation/ConversationIcons";
import { PinnedMessages, type PinnedMessagesProps } from "@openbot/ui/features/conversation/PinnedMessages";
import { SidePanelToggle, type SidePanelToggleProps } from "@openbot/ui/features/conversation/SidePanel";
import { TabShape } from "@openbot/ui/features/conversation/TabShape";
import { useText } from "@openbot/ui/text";
import type { ComponentProps, JSX } from "@solidjs/web";
import { createSignal, onSettled, Show } from "solid-js";
import { formatShortSessionTabTitle, getStoredMainSessionTitle, setStoredMainSessionTitle } from "./main-session-title";
import { modelPickerFit } from "./model-picker-fit";

export { formatShortSessionTabTitle, getStoredMainSessionTitle, setStoredMainSessionTitle };

export interface ConversationHeaderProps {
  agent: AgentProfile | null | undefined;
  title?: JSX.Element | undefined;
  sessionTitle?: string | undefined;
  onRenameSessionTitle?: ((title: string) => void) | undefined;
  modelPicker: ComponentProps<typeof ProviderModelPicker>;
  pendingModel?: ConversationHeaderPendingModel | undefined;
  onSettingsIntent: () => void;
  onOpenSettings: () => void;
  onOpenChat?: (() => void) | undefined;
  remoteControl?: ConversationHeaderRemoteControl | undefined;
  pinnedMessages?: PinnedMessagesProps | undefined;
  sidePanel?: SidePanelToggleProps | undefined;
  threads?: JSX.Element | undefined;
  extraActions?: JSX.Element | undefined;
  titleSelected?: boolean | undefined;
}

export interface ConversationHeaderPendingModel {
  running: string;
  next: string;
}

export interface ConversationHeaderRemoteControl {
  enabled: boolean;
  active: boolean;
  visible: boolean;
  onOpen: (trigger: HTMLButtonElement) => void;
}

const RENAME_FOCUS_GUARD_MS = 280;

function fitHeaderPicker(header: HTMLElement) {
  const parts = () =>
    header.querySelectorAll<HTMLElement>(
      ":scope > .conversation-heading-group, :scope > .conversation-header-actions, :scope > .conversation-header-actions > *",
    );
  const overflows = () => [...parts()].some((part) => part.scrollWidth - part.clientWidth > 1);
  const picker = modelPickerFit(header, overflows, () => measure());
  const measure = () => {
    for (const part of parts()) observer.observe(part);
    const row = header.querySelector(":scope > .conversation-heading-group > .agent-threads-header");
    if (row) observer.observe(row);
    if (header.querySelector('.agent-threads-tabs, .agent-threads-header:not([data-mode="tabs"])')) return;
    if (header.querySelector(".provider-model-trigger")) picker.fit();
    else delete header.dataset.modelFit;
  };
  const observer = new ResizeObserver(measure);
  observer.observe(header);
  measure();
  return () => {
    observer.disconnect();
    picker.stop();
  };
}

export function ConversationHeader(props: ConversationHeaderProps) {
  const { t } = useText();
  const titleTab = () => (props.titleSelected === undefined ? undefined : "");
  const titleSelected = () => (props.titleSelected ? "" : undefined);
  const fullSessionTitle = () => props.sessionTitle?.trim() || "新对话";
  const shortSessionTitle = () => formatShortSessionTabTitle(fullSessionTitle(), 6);
  const [renaming, setRenaming] = createSignal(false);
  let renameStartedAt = Number.NEGATIVE_INFINITY;
  let header: HTMLElement | undefined;

  const startMainRename = () => {
    if (!props.onRenameSessionTitle) return;
    renameStartedAt = performance.now();
    setRenaming(true);
  };

  const commitMainRename = (value: string | null) => {
    if (!renaming()) return;
    setRenaming(false);
    if (value === null) return;
    const trimmed = value.trim();
    if (trimmed && trimmed !== fullSessionTitle()) {
      props.onRenameSessionTitle?.(trimmed);
    }
  };

  onSettled(() => (header ? fitHeaderPicker(header) : undefined));
  return (
    <header ref={header} class="window-drag conversation-header">
      <div class="conversation-heading-group">
        <Show when={props.agent} fallback={props.title}>
          {() => (
            <Show
              when={renaming()}
              fallback={
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  class="conversation-title conversation-session-tab no-drag"
                  data-tab={titleTab()}
                  data-selected={titleSelected()}
                  aria-label={fullSessionTitle()}
                  title={`${fullSessionTitle()}（双击修改标题）`}
                  onClick={() => props.onOpenChat?.()}
                  onDblClick={(event: MouseEvent) => {
                    event.preventDefault();
                    event.stopPropagation();
                    startMainRename();
                  }}
                  onKeyDown={(event: KeyboardEvent) => {
                    if (event.key === "F2") {
                      event.preventDefault();
                      startMainRename();
                    }
                  }}
                >
                  <h1 class="conversation-session-tab-label" dir="auto">
                    {shortSessionTitle()}
                  </h1>
                </Button>
              }
            >
              <div
                class="conversation-title conversation-session-tab conversation-session-tab-editing no-drag"
                data-tab={titleTab()}
                data-selected={titleSelected()}
              >
                <Input
                  ref={(field: HTMLInputElement) =>
                    requestAnimationFrame(() => {
                      field.focus();
                      field.select();
                    })
                  }
                  class="conversation-session-tab-input"
                  size="sm"
                  dir="auto"
                  aria-label="修改会话标题"
                  maxlength={INPUT_LIMITS.agentTaskTitle}
                  defaultValue={fullSessionTitle()}
                  onKeyDown={(event: KeyboardEvent & { currentTarget: HTMLInputElement }) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitMainRename(event.currentTarget.value);
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      event.stopPropagation();
                      commitMainRename(null);
                    }
                  }}
                  onBlur={(event: FocusEvent & { currentTarget: HTMLInputElement }) => {
                    const field = event.currentTarget;
                    if (performance.now() - renameStartedAt < RENAME_FOCUS_GUARD_MS) {
                      requestAnimationFrame(() => field.focus());
                      return;
                    }
                    commitMainRename(field.value);
                  }}
                />
              </div>
            </Show>
          )}
        </Show>
        {props.threads}
      </div>
      <div class="conversation-header-actions no-drag">
        <Show when={props.agent && props.pendingModel}>
          {(change) => {
            const detail = () => t("conversation.header.modelNextTurnDetail", change());
            return (
              <Badge variant="info-light" class="conversation-model-pending" role="status" title={detail()}>
                <Clock3 aria-hidden="true" />
                {t("conversation.header.modelNextTurn")}
                <span class="sr-only">{detail()}</span>
              </Badge>
            );
          }}
        </Show>
        <Show when={props.agent}>
          <ProviderModelPicker {...props.modelPicker} />
        </Show>
        {props.extraActions}
        <Show when={props.remoteControl}>
          {(control) => (
            <Button
              variant="ghost"
              type="button"
              class="header-panel-toggle remote-desktop-button"
              aria-label={t(control().active ? "conversation.header.resumeRemote" : "conversation.header.openRemote")}
              aria-expanded={control().visible ? "true" : "false"}
              disabled={!control().enabled}
              onClick={(event) => control().onOpen(event.currentTarget)}
              data-cuelume-tap="open"
            >
              <RemoteDesktopIcon />
              <Show when={control().active}>
                <span class="remote-desktop-button-dot" aria-hidden="true" />
              </Show>
            </Button>
          )}
        </Show>
        <Show when={props.pinnedMessages}>{(pins) => <PinnedMessages {...pins()} />}</Show>
        <Show when={props.sidePanel}>{(sidePanel) => <SidePanelToggle {...sidePanel()} />}</Show>
      </div>
      <Show when={props.agent && titleTab() !== undefined}>
        <TabShape
          selected='.conversation-title[data-tab][data-selected], .agent-threads-tab[aria-selected="true"], .agent-threads-switcher'
          sized=".conversation-title, .agent-threads-tabs, .agent-threads-tab, .agent-threads-switcher"
          scroller=".agent-threads-tabs"
        />
      </Show>
    </header>
  );
}
