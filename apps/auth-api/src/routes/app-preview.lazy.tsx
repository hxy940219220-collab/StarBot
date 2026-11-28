import { DEFAULT_APP_LANGUAGE } from "@starbot/contracts/app-language";
import { loadLocale, resolveLocale } from "@starbot/i18n";
import { createLazyFileRoute } from "@tanstack/solid-router";
import { createSignal, lazy, onSettled, Show } from "solid-js";

const StarBotPlayground = lazy(() =>
  Promise.all([
    import("@starbot/renderer-preview"),
    loadLocale(resolveLocale(DEFAULT_APP_LANGUAGE, navigator.language)).catch(() => undefined),
  ]).then(([module]) => ({ default: module.StarBotPlayground })),
);

export const Route = createLazyFileRoute("/app-preview")({ component: AppPreviewPage });

export function AppPreviewPage() {
  const [mounted, setMounted] = createSignal(false);
  onSettled(() => {
    setMounted(true);
  });

  return (
    <div id="root" class="starbot-playground-root" data-preview-variant="landing">
      <Show
        when={mounted()}
        fallback={<div class="starbot-playground-loading" role="status" aria-label="Loading StarBot preview" />}
      >
        <StarBotPlayground variant="landing" />
      </Show>
    </div>
  );
}
