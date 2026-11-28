import { useCSSVariable } from "uniwind";

export function useSignInColors() {
  const surface = useCSSVariable("--starbot-bg-control-active");
  const brand = useCSSVariable("--starbot-logo-production");
  const onBrand = useCSSVariable("--starbot-logo-eye");
  const text = useCSSVariable("--starbot-text-primary");
  const muted = useCSSVariable("--starbot-text-muted");
  const danger = useCSSVariable("--starbot-danger");
  const success = useCSSVariable("--starbot-success");
  const radius = useCSSVariable("--starbot-radius-lg");
  return {
    surface: String(surface ?? "#2a2a2a"),
    brand: String(brand ?? "#d6adf2"),
    onBrand: String(onBrand ?? "#040007"),
    text: String(text ?? "#ffffff"),
    muted: String(muted ?? "#979797"),
    danger: String(danger ?? "#fd2f3b"),
    success: String(success ?? "#31cf76"),
    radius: Number.parseFloat(String(radius ?? "12")),
  };
}

export type SignInColors = ReturnType<typeof useSignInColors>;

export const SIGN_IN_CONTROL_HEIGHT = 52;
