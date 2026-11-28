import { Button, Play, SwitchField } from "@openbot/ui";
import { unlockKawaiiAudio } from "@openbot/ui/features/agents/starbot-kawaii-audio";
import { useText } from "@openbot/ui/text";
import { For, Show } from "solid-js";
import { setMotionEffect, useMotionEffect } from "../../motion-preference";
import {
  type StartupAnimationMode,
  triggerStartupSplashPreview,
  updateStartupAnimationConfig,
  useStartupAnimationConfig,
} from "../../startup-animation-preference";

const STARTUP_MODE_OPTIONS: ReadonlyArray<{
  readonly id: StartupAnimationMode;
  readonly label: string;
  readonly desc: string;
}> = [
  { id: "always", label: "固定每次启动", desc: "每次打开星友时都播放盲盒礼物盒开屏动画" },
  { id: "every_n_days", label: "隔几天出现一次", desc: "按设定天数周期展示开屏动画，兼顾惊喜感与启动速度" },
  { id: "first_login_only", label: "仅首次登录展示", desc: "只在账号首次登录进入星友空间时播放一次" },
  { id: "off", label: "完全取消动画", desc: "跳过开屏盲盒动画，直接静默进入工作台" },
];

export function MotionSwitches() {
  const { t } = useText();
  const backgroundBlur = useMotionEffect("backgroundBlur");
  const movingFaces = useMotionEffect("movingFaces");
  const splashConfig = useStartupAnimationConfig();

  return (
    <>
      <SwitchField
        data-settings-row="settings.backgroundBlur.title"
        checked={backgroundBlur()}
        onChange={(on) => setMotionEffect("backgroundBlur", on)}
        label={t("settings.backgroundBlur.title")}
        description={t("settings.backgroundBlur.description")}
      />
      <SwitchField
        data-settings-row="settings.movingFaces.title"
        checked={movingFaces()}
        onChange={(on) => setMotionEffect("movingFaces", on)}
        label={t("settings.movingFaces.title")}
        description={t("settings.movingFaces.description")}
      />

      <div
        data-settings-row="settings.startupAnimation.title"
        class="settings-modal-row starbot-splash-pref-card"
        style={{
          display: "flex",
          "flex-direction": "column",
          "align-items": "stretch",
          gap: "14px",
          padding: "16px 18px 18px",
          "border-top": "1px solid var(--openbot-border)",
        }}
      >
        <div
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "space-between",
            gap: "16px",
            "flex-wrap": "wrap",
          }}
        >
          <div style={{ display: "flex", "flex-direction": "column", gap: "4px", "min-width": "0", flex: "1" }}>
            <strong
              style={{
                "font-size": "var(--openbot-text-md, 13.5px)",
                "font-weight": "var(--openbot-weight-medium, 500)",
                color: "var(--openbot-text-primary)",
              }}
            >
              开屏盲盒动画（礼物盒蹦出星友）
            </strong>
            <span
              style={{
                "font-size": "var(--openbot-text-sm, 12px)",
                color: "var(--openbot-text-muted)",
                "line-height": "1.45",
              }}
            >
              自由选择启动时的盲盒开屏动画展示频率，或点击右侧按钮完整预览开屏效果。
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            style={{ "flex-shrink": "0" }}
            data-starbot-silent=""
            onClick={() => {
              unlockKawaiiAudio();
              triggerStartupSplashPreview();
            }}
          >
            <Play class="size-3.5" aria-hidden="true" />
            立即预览动画
          </Button>
        </div>

        <div
          role="radiogroup"
          aria-label="开屏动画展示频率"
          style={{
            display: "grid",
            "grid-template-columns": "repeat(2, minmax(0, 1fr))",
            gap: "10px",
          }}
        >
          <For each={STARTUP_MODE_OPTIONS}>
            {(opt) => {
              const active = () => splashConfig().mode === opt.id;
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={active() ? "true" : "false"}
                  onClick={() => updateStartupAnimationConfig({ mode: opt.id })}
                  style={{
                    display: "flex",
                    "flex-direction": "column",
                    "align-items": "flex-start",
                    gap: "4px",
                    padding: "11px 13px",
                    "border-radius": "12px",
                    "text-align": "left",
                    cursor: "pointer",
                    border: active() ? "1.5px solid var(--openbot-accent)" : "1px solid var(--openbot-border-strong)",
                    background: active()
                      ? "color-mix(in srgb, var(--openbot-accent) 10%, var(--openbot-bg-surface))"
                      : "var(--openbot-bg-canvas)",
                    transition: "border-color 140ms ease, background-color 140ms ease",
                  }}
                >
                  <span
                    style={{
                      "font-size": "12.5px",
                      "font-weight": "600",
                      color: active() ? "var(--openbot-accent-text)" : "var(--openbot-text-primary)",
                    }}
                  >
                    {opt.label}
                  </span>
                  <span style={{ "font-size": "11.5px", color: "var(--openbot-text-muted)", "line-height": "1.4" }}>
                    {opt.desc}
                  </span>
                </button>
              );
            }}
          </For>
        </div>

        <Show when={splashConfig().mode === "every_n_days"}>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: "8px",
              padding: "10px 14px",
              "border-radius": "10px",
              border: "1px solid color-mix(in srgb, var(--openbot-accent) 28%, var(--openbot-border))",
              background: "color-mix(in srgb, var(--openbot-accent) 7%, var(--openbot-bg-canvas))",
              "font-size": "12.5px",
              color: "var(--openbot-text-primary)",
            }}
          >
            <span>每隔</span>
            <input
              type="number"
              min="1"
              max="365"
              value={splashConfig().intervalDays}
              onInput={(e) => {
                const n = Number(e.currentTarget.value);
                if (Number.isFinite(n) && n >= 1) {
                  updateStartupAnimationConfig({ intervalDays: n });
                }
              }}
              style={{
                width: "64px",
                padding: "4px 8px",
                "border-radius": "7px",
                border: "1px solid var(--openbot-border-strong)",
                background: "var(--openbot-bg-surface)",
                color: "var(--openbot-text-primary)",
                "text-align": "center",
                "font-weight": "600",
              }}
            />
            <span>天打开星友时展示一次开屏盲盒动画</span>
          </div>
        </Show>
      </div>
    </>
  );
}
