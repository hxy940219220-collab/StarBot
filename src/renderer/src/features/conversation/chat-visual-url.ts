import { CHAT_VISUAL_PAGE_LIMIT, isChatVisualMimeType } from "@starbot/contracts/chat-visual";

export function chatVisualPageUrl(previewUrl: string | null | undefined): string | undefined {
  if (!previewUrl) return undefined;
  const local = /^starbot-attachment:\/\/file\/([^/?#]+)$/.exec(previewUrl);
  if (local) return `starbot-visual://file/${local[1]}`;
  const remote = /^starbot-remote-attachment:\/\/([^/?#]+)\/([^/?#]+)$/.exec(previewUrl);
  if (remote) return `starbot-remote-visual://${remote[1]}/${remote[2]}`;
  return undefined;
}

export function htmlAttachmentPageUrl(
  attachment: { mimeType: string; previewUrl: string | null } | null | undefined,
): string | undefined {
  return attachment && isChatVisualMimeType(attachment.mimeType) ? chatVisualPageUrl(attachment.previewUrl) : undefined;
}

export function htmlFilePageHtml(
  attachment: { mimeType: string } | null | undefined,
  preview: { mimeType: string; bytes: Uint8Array | null } | null | undefined,
): string | undefined {
  if (!preview?.bytes || preview.bytes.byteLength > CHAT_VISUAL_PAGE_LIMIT) return undefined;
  if (attachment && !isChatVisualMimeType(attachment.mimeType)) return undefined;
  if (!isChatVisualMimeType(preview.mimeType)) return undefined;
  return new TextDecoder().decode(preview.bytes);
}
