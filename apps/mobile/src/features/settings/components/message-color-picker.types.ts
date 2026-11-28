import type { AvatarColor } from "@starbot/contracts/ipc";

export interface MessageColorPickerProps {
  value: AvatarColor;
  disabled: boolean;
  dark: boolean;
  onChange: (value: AvatarColor) => void;
}
