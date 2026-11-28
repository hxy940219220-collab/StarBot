import { BookOpen, DropdownMenu, Megaphone, MotionTooltip, Sparkles } from "@openbot/ui";
import { createSignal } from "solid-js";
import { useText } from "../../text";
import { StarbotHelpIcon } from "../window/StarbotNavIcons";

export interface HelpMenuNews {
  headline: string;
  date: string;
}

export interface HelpMenuProps {
  news?: readonly HelpMenuNews[];
  triggerClass?: string;
  onOpen?: () => void;
  onOpenWhatsNew?: () => void;
  onOpenChangelog?: () => void;
  onOpenGuides: () => void;
  onStartOnboardingTour?: () => void;
  onOpenDiscord?: () => void;
  onReportProblem?: () => void;
  onSendFeedback: () => void;
}

export function HelpMenu(props: HelpMenuProps) {
  const { t } = useText();
  const [open, setOpen] = createSignal(false);
  return (
    <DropdownMenu.Root
      placement="right-end"
      gutter={10}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) props.onOpen?.();
      }}
    >
      <MotionTooltip content={t("app.help.label")} suppressed={open()}>
        <DropdownMenu.Trigger class={props.triggerClass} aria-label={t("app.help.label")}>
          <StarbotHelpIcon aria-hidden="true" />
        </DropdownMenu.Trigger>
      </MotionTooltip>
      <DropdownMenu.Portal>
        <DropdownMenu.Content class="agent-context-menu help-menu starbot-help-menu" aria-label={t("app.help.label")}>
          <DropdownMenu.Item onSelect={() => props.onOpenGuides()}>
            <BookOpen class="agent-context-icon size-4" aria-hidden="true" />
            <span>使用指南</span>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => (props.onStartOnboardingTour ? props.onStartOnboardingTour() : props.onOpenGuides())}
          >
            <Sparkles class="agent-context-icon size-4" aria-hidden="true" />
            <span>新手指引</span>
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item onSelect={() => props.onSendFeedback()}>
            <Megaphone class="agent-context-icon size-4" aria-hidden="true" />
            <span>发送反馈</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
