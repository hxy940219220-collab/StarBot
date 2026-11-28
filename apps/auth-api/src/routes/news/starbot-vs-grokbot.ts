import { createFileRoute } from "@tanstack/solid-router";
import { movedPermanently } from "../../server/moved-content";

export const Route = createFileRoute("/news/starbot-vs-grokbot")({
  server: { handlers: { GET: () => movedPermanently("/compare/grok-bot") } },
});
