import { For } from "solid-js";
import { ZodiacClayAvatar } from "./features/agents/ZodiacClayAvatar";
import { cx } from "./utils";

export type PlushMascotFace = "idle" | "wide" | "wink" | "happy";

const STARBOT_ORBS = ["lilac", "mint", "coral"] as const;

export function PlushMascot(props: { face?: PlushMascotFace; class?: string }) {
  const faceState = () => (props.face === "wide" ? "wide" : props.face === "wink" ? "wink" : "idle");
  const faceExpr = () => (props.face === "happy" ? "heureux" : "neutre");
  return (
    <span class={cx("ui-plush-mascot", props.class)} data-face={props.face ?? "idle"} aria-hidden="true">
      <span class="ui-plush-body">
        <ZodiacClayAvatar shape="pentagone" state={faceState()} expression={faceExpr()} class="ui-plush-body-image" />
      </span>
    </span>
  );
}

export interface PlushLoaderProps {
  size?: number;
  layout?: "row" | "stack";
  label?: string;
  class?: string;
}

export function PlushLoader(props: PlushLoaderProps) {
  return (
    <span
      class={cx("ui-plush-loader", props.class)}
      data-layout={props.layout ?? "row"}
      style={{ "--ui-plush-size": `${props.size ?? 32}px` }}
      role="status"
      aria-label={props.label}
      aria-hidden={props.label ? undefined : "true"}
    >
      <PlushMascot />
      <span class="ui-plush-balls" aria-hidden="true">
        <For each={STARBOT_ORBS}>{(tone) => <span class="ui-plush-ball" data-orb={tone} />}</For>
      </span>
    </span>
  );
}
