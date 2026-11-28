import type { PinnedMessagesProps } from "@starbot/ui/features/conversation/PinnedMessages";
import { createSignal } from "solid-js";

const [activeConversationPins, setActiveConversationPins] = createSignal<PinnedMessagesProps | undefined>(undefined);

export { activeConversationPins, setActiveConversationPins };
