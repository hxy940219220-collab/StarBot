declare module "@starbot/renderer-preview" {
  import type { JSX } from "@solidjs/web";

  export interface StarBotPlaygroundProps {
    variant?: "default" | "landing";
    theme?: "dark" | "light";
  }

  export function StarBotPlayground(props: StarBotPlaygroundProps): JSX.Element;
}
