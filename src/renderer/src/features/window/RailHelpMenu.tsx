import { requestFirstAgentTourReplay } from "@openbot/ui/features/agents/FirstAgentSetup";
import { HelpMenu } from "@openbot/ui/features/updates/HelpMenu";
import { createSignal, onCleanup, onSettled } from "solid-js";
import {
  StarBotFeatureTourModal,
  StarBotFeedbackModal,
  StarBotGuideModal,
} from "./StarBotHelpModals";

type HelpLink = "changelog" | "guides" | "discord" | "report-problem" | "feedback";

const FEATURE_TOUR_SEEN_KEY = "starbot:feature-tour-v021-video-seen";

export function RailHelpMenu(props: {
  version: string | null;
  onOpenWhatsNew: () => void;
  onOpenLink: (destination: HelpLink) => void;
  onStartOnboardingTour?: () => void;
}) {
  const [guideOpen, setGuideOpen] = createSignal(false);
  const [feedbackOpen, setFeedbackOpen] = createSignal(false);
  const [featureTourOpen, setFeatureTourOpen] = createSignal(false);

  onSettled(() => {
    try {
      if (!window.localStorage.getItem(FEATURE_TOUR_SEEN_KEY)) {
        const timer = window.setTimeout(() => {
          window.localStorage.setItem(FEATURE_TOUR_SEEN_KEY, "1");
          setFeatureTourOpen(true);
        }, 2800);
        onCleanup(() => window.clearTimeout(timer));
      }
    } catch {}
  });

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
