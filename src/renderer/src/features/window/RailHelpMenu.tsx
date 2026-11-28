import { requestFirstAgentTourReplay } from "@starbot/ui/features/agents/FirstAgentSetup";
import { HelpMenu } from "@starbot/ui/features/updates/HelpMenu";
import { createSignal } from "solid-js";
import { StarBotFeatureTourModal, StarBotFeedbackModal, StarBotGuideModal } from "./StarBotHelpModals";

type HelpLink = "changelog" | "guides" | "discord" | "report-problem" | "feedback";

export function RailHelpMenu(props: {
  version: string | null;
  onOpenWhatsNew: () => void;
  onOpenLink: (destination: HelpLink) => void;
  onStartOnboardingTour?: () => void;
}) {
  const [guideOpen, setGuideOpen] = createSignal(false);
  const [feedbackOpen, setFeedbackOpen] = createSignal(false);
  const [featureTourOpen, setFeatureTourOpen] = createSignal(false);

  function startTour(): void {
    setFeatureTourOpen(true);
  }

  function startAvatarSetupTour(): void {
    setFeatureTourOpen(false);
    if (props.onStartOnboardingTour) {
      props.onStartOnboardingTour();
    } else {
      requestFirstAgentTourReplay();
    }
  }

  return (
    <>
      <HelpMenu
        triggerClass="window-rail-button"
        onOpenGuides={() => setGuideOpen(true)}
        onStartOnboardingTour={startTour}
        onSendFeedback={() => setFeedbackOpen(true)}
      />
      <StarBotFeatureTourModal
        open={featureTourOpen()}
        onClose={() => setFeatureTourOpen(false)}
        onOpenGuides={() => {
          setFeatureTourOpen(false);
          setGuideOpen(true);
        }}
        onOpenAvatarSetup={startAvatarSetupTour}
      />
      <StarBotGuideModal
        open={guideOpen()}
        onClose={() => setGuideOpen(false)}
        onStartTour={startTour}
        onOpenFeedback={() => setFeedbackOpen(true)}
      />
      <StarBotFeedbackModal open={feedbackOpen()} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
