import type { McpLocalFlow } from "@openbot/contracts/mcp-connect-flows";
import { Alert, AlertContent, AlertDescription, AlertIcon, Button, Check, ExternalLink, Info, Text } from "@openbot/ui";
import { createMemo, For, onSettled, Show } from "solid-js";
import { useText } from "../../text";
import { createConnectRun, type McpConnectBaseProps, McpConnectShell } from "./McpConnectShell";

export interface McpLocalDialogProps extends McpConnectBaseProps {
  flow: McpLocalFlow;
  onOpenUrl?: ((url: string) => void) | undefined;
}

export function McpLocalDialog(props: McpLocalDialogProps) {
  const { t } = useText();
  const { state, busy, forget, attempt } = createConnectRun(props);
  const isStdioAccountAuth = () => props.subject.config.transport === "stdio";
  const connect = () =>
    void attempt(async () => {
      if (isStdioAccountAuth()) {
        await new Promise((resolve) => setTimeout(resolve, 900));
      }
      return props.subject.config;
    });
  onSettled(() => {
    if (props.connectOnOpen) connect();
  });
  const docs = createMemo(() => {
    const url = props.flow.docsUrl;
    return url && props.onOpenUrl ? { url, label: props.flow.docsLabel ?? t("mcp.local.docs") } : null;
  });

  const authSteps = createMemo(() => [
    {
      title: `打开「${props.subject.name}」专属登录窗口`,
      desc: "在星友独立安全沙盒中拉起官方授权页面",
    },
    {
      title: "扫码或登录你的个人账号",
      desc: busy() ? "正在等待你在弹出窗口完成扫码或登录..." : "登录态持久保存在本机，后续无需重复扫码",
    },
    {
      title: "自动验证并打通同步权限",
      desc: "支持将文档、草稿或创作指令直接同步至你的账号",
    },
  ]);

  return (
    <McpConnectShell
      {...props}
      state={state}
      busy={busy}
      onCancelBusy={() => forget()}
      description={
        isStdioAccountAuth()
          ? `绑定个人账号后，星友创作的内容可直接存入你的「${props.subject.name}」工作台。`
          : t("mcp.local.description", { name: props.subject.name })
      }
      onSubmit={connect}
      action={
        <Button
          type="submit"
          size="sm"
          class={isStdioAccountAuth() ? "mcp-auth-submit-btn" : undefined}
          loading={busy()}
          loadingLabel={isStdioAccountAuth() ? "等待扫码登录中..." : t("common.connecting")}
        >
          {isStdioAccountAuth()
            ? state.phase === "failed"
              ? "重新拉起登录窗口"
              : "打开登录窗口并绑定"
            : state.phase === "failed"
              ? t("common.tryAgain")
              : t("mcp.connect.connect")}
        </Button>
      }
    >
      <Show
        when={isStdioAccountAuth()}
        fallback={
          <>
            <div class="mcp-connect-card">
              <div class="mcp-connect-row">
                <h3 class="mcp-local-heading">{t("mcp.local.stepsTitle", { name: props.subject.name })}</h3>
                <Show when={docs()}>
                  {(page) => (
                    <Button
                      class="mcp-connect-docs"
                      type="button"
                      variant="link"
                      onClick={() => props.onOpenUrl?.(page().url)}
                    >
                      {page().label}
                      <ExternalLink aria-hidden="true" />
                    </Button>
                  )}
                </Show>
                <ol class="mcp-local-steps">
                  <For each={props.flow.steps}>{(step) => <li>{step}</li>}</For>
                </ol>
              </div>
              <Show when={props.subject.config.transport === "http" && props.subject.config.url}>
                <p class="mcp-connect-row mcp-local-address">
                  <Text as="span" tone="muted">
                    {t("mcp.local.address")}
                  </Text>
                  <code>{props.subject.config.url}</code>
                </p>
              </Show>
            </div>
            <Show when={props.flow.note}>
              {(note) => (
                <Alert tone="neutral">
                  <AlertIcon>
                    <Info />
                  </AlertIcon>
                  <AlertContent>
                    <AlertDescription>{note()}</AlertDescription>
                  </AlertContent>
                </Alert>
              )}
            </Show>
          </>
        }
      >
        <div class="starbot-auth-flow-card" data-busy={busy() ? "" : undefined}>
          <div class="starbot-auth-flow-head">
            <span class="starbot-auth-flow-label">授权绑定步骤</span>
            <Show when={docs()}>
              {(page) => (
                <button type="button" class="starbot-auth-flow-link" onClick={() => props.onOpenUrl?.(page().url)}>
                  <span>访问官网</span>
                  <ExternalLink aria-hidden="true" />
                </button>
              )}
            </Show>
          </div>
          <ol class="starbot-auth-step-list">
            <For each={authSteps()}>
              {(item, idx) => {
                const isDone = () => busy() && idx() === 0;
                const isActive = () => (busy() ? idx() === 1 : idx() === 0);
                return (
                  <li
                    class="starbot-auth-step-item"
                    data-done={isDone() ? "" : undefined}
                    data-active={isActive() ? "" : undefined}
                  >
                    <span class="starbot-auth-step-badge" aria-hidden="true">
                      <Show when={isDone()} fallback={idx() + 1}>
                        <Check class="size-3.5" />
                      </Show>
                    </span>
                    <div class="starbot-auth-step-copy">
                      <strong>{item.title}</strong>
                      <span>{item.desc}</span>
                    </div>
                  </li>
                );
              }}
            </For>
          </ol>
        </div>
      </Show>
    </McpConnectShell>
  );
}
