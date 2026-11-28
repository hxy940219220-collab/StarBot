import type { AgentProviderId } from "@starbot/contracts/ipc";
import { AppLoadingScreen } from "@starbot/ui/features/account/AppLoadingScreen";
import { UpdateRequiredScreen } from "@starbot/ui/features/updates/UpdateRequiredScreen";
import { useText } from "@starbot/ui/text";
import { createEffect, createMemo, createSignal, Loading, Show } from "solid-js";
import { appPort } from "./app-port";
import { useAuth } from "./features/account/account-context";
import { useProviderDetection } from "./features/custom-providers/provider-detection-context";
import { createLanguageStep } from "./features/onboarding/language-step";
import { useSetup } from "./features/onboarding/onboarding-context";
import { SetupReadError } from "./features/onboarding/SetupReadError";
import { useSetupProviderProps } from "./features/onboarding/setup-provider-props";
import { useServerScope } from "./features/servers/server-scope";
import { useServerSelection } from "./features/servers/server-selection";
import { useUpdates } from "./features/updates/updates-context";
import { WhatsNewOverlay } from "./features/updates/WhatsNewOverlay";
import { QuitShortcutHint } from "./features/window/QuitShortcutHint";
import { startsAfterRestart } from "./features/window/restarted-start";
import { useI18n } from "./i18n-context";
import { AccountLogin, InitialSetup, LanguageStep } from "./lazy-views";
import { usePlatform } from "./platform";
import { reportWorkspaceReady } from "./renderer-timing";
import {
  closeStartupSplashPreview,
  recordStartupSplashPlayed,
  resetFirstLoginSplashFlag,
  shouldPlayStartupSplashNow,
  splashPreviewOpen,
  startupLoadingScene,
} from "./startup-animation-preference";
import { WorkspaceShell } from "./WorkspaceShell";

let startupSplashPlayed = false;

export function skipStartupSplash(): void {
  startupSplashPlayed = true;
}

function LoadingScreen() {
  const { t } = useText();
  return <div class="initial-setup-screen" role="status" aria-label={t("app.loading")} />;
}

export function AppAccessGate() {
  const { t } = useText();
  const platform = usePlatform();
  const i18n = useI18n();
  const auth = useAuth();
  const setup = useSetup();
  const scope = useServerScope();
  const setupProviders = useSetupProviderProps();
  const detection = useProviderDetection();
  const { joinRemoteDuringSetup } = useServerSelection();
  const updates = useUpdates();
  const [requiredUpdateDismissed, setRequiredUpdateDismissed] = createSignal(false);
  const updateRequired = () => updates.status().requiredVersion !== undefined && !requiredUpdateDismissed();
  const languageLoaded = createMemo<boolean>((was) => was === true || i18n.ready());
  const started = () => setup.setupLoaded() && platform.appInfo() !== null && languageLoaded();

  const initialShouldPlay = !platform.landingPreview && !startsAfterRestart() && shouldPlayStartupSplashNow();
  const [splashShown, setSplashShown] = createSignal(initialShouldPlay);
  const splashPlaysThrough = initialShouldPlay && !startupSplashPlayed && platform.chatWindow === null;
  const [splashOpen, setSplashOpen] = createSignal(false);
  const splashMoving = () => splashShown() && !splashOpen();
  const [workspaceReady, setWorkspaceReady] = createSignal(false);
  const hasInviteSetup = () => Boolean(setup.pendingInviteUrl().trim());
  const workspaceShown = () => !!auth.visibleSignedInAccount() && !hasInviteSetup();
  const splashReady = () =>
    started() && auth.centralAuth().status !== "loading" && (!workspaceShown() || workspaceReady() || updateRequired());
  const languageStep = createLanguageStep();
  const languageStepShown = () =>
    !languageStep.done() && (languageStep.reopened() || auth.centralAuth().status === "signed_out");

  createEffect(
    () => auth.centralAuth().status,
    (status) => {
      if (status === "signed_in" && !languageStep.done()) languageStep.complete();
      if (status === "signed_out") resetFirstLoginSplashFlag();
    },
  );

  // Streamlined StarBot onboarding: skip StarBot's free-vs-own-model screen;
  // automatically scan local desktop agents/models once and enter workspace directly.
  let autoSetupInitialized = false;
  createEffect(
    () =>
      started() &&
      Boolean(auth.visibleSignedInAccount()) &&
      scope.connection.hasContent &&
      !setup.setupReadFailed() &&
      setup.setupState()?.completed === false &&
      !hasInviteSetup(),
    (needsSilentInit) => {
      if (!needsSilentInit || autoSetupInitialized) return;
      autoSetupInitialized = true;
      detection.scanOnce();
      const readyProvider: AgentProviderId =
        setupProviders.agentStatus?.providers?.find((p) => p.state === "available")?.id ??
        setup.setupState()?.preferredProvider ??
        "antigravity";
      void setup.saveSetup(readyProvider, null).catch(() => undefined);
    },
  );

  createEffect(started, (ready) => {
    if (ready) performance.mark("starbot:app-started");
  });
  createEffect(workspaceReady, (ready) => {
    if (ready && platform.chatWindow === null) reportWorkspaceReady();
  });

  return (
    <>
      <Show when={started() && updateRequired()}>
        <UpdateRequiredScreen
          status={updates.status()}
          logoVariant={platform.appInfo()?.variant ?? "production"}
          onUpdate={updates.runAction}
          onOpenDownloadPage={() => void appPort().openExternal("download")}
          onDismiss={() => setRequiredUpdateDismissed(true)}
        />
      </Show>
      <Show when={started() && !updateRequired()}>
        <Show
          when={auth.visibleSignedInAccount()}
          fallback={
            <Loading fallback={<LoadingScreen />}>
              <Show
                when={languageStepShown()}
                fallback={
                  <AccountLogin
                    variant={platform.appInfo()?.variant ?? "production"}
                    state={auth.centralAuth()}
                    onRetry={auth.retryCentralAccount}
                    onRequestEmailCode={auth.requestEmailCode}
                    onVerifyEmailCode={auth.verifyEmailCode}
                    inviteField
                    onReset={auth.logoutCentralAccount}
                    onOpenCompanySignIn={auth.openCompanySignIn}
                    language={i18n.locale()}
                    onChangeLanguage={languageStep.reopen}
                  />
                }
              >
                <LanguageStep
                  variant={platform.appInfo()?.variant ?? "production"}
                  reopened={languageStep.reopened()}
                  onDone={languageStep.complete}
                />
              </Show>
            </Loading>
          }
        >
          {(account) => (
            <Show when={!setup.setupReadFailed()} fallback={<SetupReadError />}>
              <Show
                when={hasInviteSetup()}
                fallback={
                  <WorkspaceShell
                    account={account}
                    behindSplash={splashMoving}
                    onStartupReady={() => setWorkspaceReady(true)}
                  />
                }
              >
                <Loading fallback={<LoadingScreen />}>
                  <InitialSetup
                    {...setupProviders}
                    state={setup.setupState() ?? { completed: false, preferredProvider: null, preferredModel: null }}
                    platform={platform.appInfo()?.platform ?? "darwin"}
                    accountEmail={account().email}
                    inviteUrl={setup.pendingInviteUrl()}
                    onSave={setup.saveSetup}
                    onPreviewInvite={setup.previewInvite}
                    onJoinRemote={joinRemoteDuringSetup}
                    onLogout={auth.logoutCentralAccount}
                  />
                </Loading>
              </Show>
            </Show>
          )}
        </Show>
      </Show>
      <WhatsNewOverlay
        ready={
          !platform.chatWindow &&
          !updateRequired() &&
          !splashShown() &&
          !!auth.visibleSignedInAccount() &&
          !hasInviteSetup()
        }
      />
      <QuitShortcutHint />
      <Show when={splashShown()}>
        <AppLoadingScreen
          label={t("app.loading")}
          title={t("app.loading")}
          scene={startupLoadingScene()}
          ready={splashReady()}
          quickExit={!splashPlaysThrough}
          onMountViews={() => setSplashOpen(true)}
          onExited={() => {
            recordStartupSplashPlayed();
            startupSplashPlayed = true;
            setSplashShown(false);
          }}
        />
      </Show>
      <Show when={splashPreviewOpen()}>
        <div role="presentation" style={{ position: "fixed", inset: "0", "z-index": "9999" }}>
          <AppLoadingScreen
            label="开屏盲盒动画预览"
            title="StarBot · 星友"
            scene="pile"
            preview={true}
            ready={true}
            quickExit={false}
            onExited={() => closeStartupSplashPreview()}
          />
        </div>
      </Show>
    </>
  );
}
