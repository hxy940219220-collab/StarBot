import type { SettingLinkId } from "@openbot/contracts/ipc";
import type { AgentMessage } from "@openbot/ui/data";
import {
  AGENT_SETTING_LINK_ROWS,
  type AgentSettingLinkId,
  isAgentSettingLinkId,
} from "@openbot/ui/features/conversation/agent-setting-links";
import { SettingLinkCard } from "@openbot/ui/features/conversation/SettingLinkCard";
import { useText } from "@openbot/ui/text";
import { usePlatform } from "../../platform";
import { appSettingLinkTarget } from "../settings/setting-link-targets";
import { navItem } from "../settings/settings-tabs";
import { useConversationViewScope } from "./conversation-scope";
import type { ConversationProps } from "./conversation-types";

export interface SettingLinkChatCardProps {
  settingId: SettingLinkId;
  agent: { id: string; name: string } | null;
  onOpenAgentSetting: (agentId: string, settingId: AgentSettingLinkId) => void;
  appSettingOpener?: ConversationProps["appSettingOpener"];
}

function starbotSubLabelForSetting(settingId: AgentSettingLinkId): string | null {
  switch (settingId) {
    case "agent.memories":
    case "agent.builtin-memory":
      return "专属记忆";
    case "agent.skills":
      return "装备技能";
    case "agent.routines":
      return "定时叮嘱";
    case "agent.access":
    case "agent.computer-use":
    case "agent.local-scripts":
    case "agent.folders":
    case "agent.browser-profile":
      return "操作边界";
    default:
      return null;
  }
}

export function SettingLinkChatCard(props: SettingLinkChatCardProps) {
  const { t } = useText();
  const platform = usePlatform();
  const card = () => {
    const settingId = props.settingId;
    if (isAgentSettingLinkId(settingId)) {
      const row = AGENT_SETTING_LINK_ROWS[settingId];
      const agent = props.agent;
      const subLabel = starbotSubLabelForSetting(settingId);
      const path = [agent?.name ?? "", "星友档案", ...(subLabel ? [subLabel] : [])].filter(Boolean);
      const customTitle =
        settingId === "agent.browser-profile"
          ? "浏览器与登录档案"
          : settingId === "agent.computer-use"
            ? "读取与操作本机应用 / 浏览器"
            : t(row.title);
      return {
        title: customTitle,
        path,
        open: agent ? () => props.onOpenAgentSetting(agent.id, settingId) : undefined,
        note: agent ? undefined : t("chat.settingLink.agentChatOnly"),
      };
    }
    const target = appSettingLinkTarget(settingId, platform.appInfo()?.platform);
    const open = props.appSettingOpener?.(settingId);
    return {
      title: t(target.row),
      path: [t("app.settingsPage.title"), t(navItem(target.tab).titleKey)],
      open,
      note: props.appSettingOpener ? undefined : t("chat.settingLink.desktopOnly"),
    };
  };
  return <SettingLinkCard title={card().title} path={card().path} onOpen={card().open} note={card().note} />;
}

export function useThreadSettingLinkCard() {
  const { props, channel, openAgentSettingRow } = useConversationViewScope();
  return (message: AgentMessage) => {
    const marker = message.actionMarker;
    if (marker?.kind !== "setting-link") return undefined;
    const agent = props.agent;
    return (
      <SettingLinkChatCard
        settingId={marker.settingId}
        agent={channel || !agent ? null : { id: agent.id, name: agent.name }}
        onOpenAgentSetting={openAgentSettingRow}
        appSettingOpener={props.appSettingOpener}
      />
    );
  };
}
