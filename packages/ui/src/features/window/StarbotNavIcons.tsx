import type { JSX } from "@solidjs/web";

type NavIconProps = JSX.SvgSVGAttributes<SVGSVGElement>;

/** 星友 (Agents) — rounded blind-box star-friend silhouette with cute eyes & star antenna */
export function StarbotAgentsIcon(props: NavIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.9"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...props}
    >
      <rect x="4" y="6.5" width="16" height="13.5" rx="6.5" fill="currentColor" fill-opacity="0.14" />
      <path
        d="M12 2.5l.85 1.85L14.7 5.2l-1.85.85L12 7.9l-.85-1.85L9.3 5.2l1.85-.85L12 2.5z"
        fill="currentColor"
        stroke="none"
      />
      <rect x="8.3" y="11.4" width="2.2" height="3.6" rx="1.1" fill="currentColor" stroke="none" />
      <rect x="13.5" y="11.4" width="2.2" height="3.6" rx="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 话题 (Topics / Tasks) — rounded conversation bubbles with spark */
export function StarbotTopicsIcon(props: NavIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.9"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...props}
    >
      <rect x="3.5" y="4.5" width="17" height="13" rx="4.5" fill="currentColor" fill-opacity="0.14" />
      <path d="M8.5 17.5l-2.5 2.7v-2.7" fill="currentColor" fill-opacity="0.14" />
      <path d="M8.5 9.8h7" />
      <path d="M8.5 13.3h4.5" />
    </svg>
  );
}

/** 日程 (Schedule / Routines) — rounded pill calendar with clock dot */
export function StarbotScheduleIcon(props: NavIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.9"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...props}
    >
      <rect x="3.5" y="5" width="17" height="15.5" rx="4.5" fill="currentColor" fill-opacity="0.14" />
      <path d="M8.5 3v3.2M15.5 3v3.2" />
      <path d="M3.8 9.8h16.4" />
      <circle cx="12" cy="14.7" r="2.7" />
      <path d="M12 13.4v1.4l1 .7" stroke-width="1.55" />
    </svg>
  );
}

/** 数据 (Usage / Insights) — soft rounded pastel bar columns */
export function StarbotUsageIcon(props: NavIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.9"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...props}
    >
      <rect x="3.5" y="4" width="17" height="16" rx="4.5" fill="currentColor" fill-opacity="0.12" />
      <path d="M8.2 15.8v-3.4" stroke-width="2.3" />
      <path d="M12 15.8V9.2" stroke-width="2.3" />
      <path d="M15.8 15.8v-5" stroke-width="2.3" />
    </svg>
  );
}

/** 资料库 (Library / Knowledge Files) — rounded cute folder with bookmark notch */
export function StarbotLibraryIcon(props: NavIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.9"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...props}
    >
      <path
        d="M3.5 8.2a3.2 3.2 0 0 1 3.2-3.2h3.1c.9 0 1.7.45 2.2 1.2l.4.6c.45.65 1.15 1 1.9 1h3a3.2 3.2 0 0 1 3.2 3.2v5.8a3.5 3.5 0 0 1-3.5 3.5H7a3.5 3.5 0 0 1-3.5-3.5V8.2z"
        fill="currentColor"
        fill-opacity="0.14"
      />
      <path d="M8.5 13.2h7" />
      <path d="M8.5 16.2h4.2" />
    </svg>
  );
}

/** 模型中心 (Providers / Models) — sparkling 4-point star & orbit dot */
export function StarbotProvidersIcon(props: NavIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.85"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...props}
    >
      <path
        d="M11.2 3.4l1.75 4.9c.3.82.95 1.47 1.77 1.77l4.9 1.75-4.9 1.75a2.6 2.6 0 0 0-1.77 1.77l-1.75 4.9-1.75-4.9a2.6 2.6 0 0 0-1.77-1.77l-4.9-1.75 4.9-1.75a2.6 2.6 0 0 0 1.77-1.77l1.75-4.9z"
        fill="currentColor"
        fill-opacity="0.16"
      />
      <circle cx="18.2" cy="5.8" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 星友市集 (Marketplace) — cute rounded boutique stall */
export function StarbotMarketplaceIcon(props: NavIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.9"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...props}
    >
      <path
        d="M4.2 9.4l1.2-4a2 2 0 0 1 1.9-1.4h9.4a2 2 0 0 1 1.9 1.4l1.2 4a2.4 2.4 0 0 1-2.3 3.1H6.5a2.4 2.4 0 0 1-2.3-3.1z"
        fill="currentColor"
        fill-opacity="0.16"
      />
      <path d="M6 12.5v5.2A2.3 2.3 0 0 0 8.3 20h7.4a2.3 2.3 0 0 0 2.3-2.3v-5.2" />
      <rect x="10" y="15.2" width="4" height="4.8" rx="1.4" />
    </svg>
  );
}

/** 使用指南 (Help) — rounded soft bubble with question mark */
export function StarbotHelpIcon(props: NavIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.9"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...props}
    >
      <rect x="3.5" y="3.5" width="17" height="17" rx="6" fill="currentColor" fill-opacity="0.14" />
      <path d="M9.6 9.6a2.5 2.5 0 0 1 4.8.8c0 1.6-2.4 2-2.4 3.3" />
      <circle cx="12" cy="16.6" r="1.05" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 偏好设置 (Settings) — soft tactile sliders */
export function StarbotSettingsIcon(props: NavIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.9"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...props}
    >
      <rect x="3.5" y="3.5" width="17" height="17" rx="5.5" fill="currentColor" fill-opacity="0.12" />
      <path d="M7.5 9.2h9" />
      <circle cx="10.2" cy="9.2" r="1.9" fill="var(--openbot-bg-surface, #ffffff)" />
      <path d="M7.5 14.8h9" />
      <circle cx="14.2" cy="14.8" r="1.9" fill="var(--openbot-bg-surface, #ffffff)" />
    </svg>
  );
}

/** 更多 (More) — 3 soft rounded clay dots */
export function StarbotMoreIcon(props: NavIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <circle cx="6.2" cy="12" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="17.8" cy="12" r="1.9" />
    </svg>
  );
}
