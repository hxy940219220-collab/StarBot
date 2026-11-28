import { createFileRoute } from "@tanstack/solid-router";
import { ClaPage } from "../components/legal/ClaPage";
import { CLA_META, CLA_ROUTE } from "../lib/cla";
import { STARBOT_SOCIAL_IMAGE_ALT, STARBOT_SOCIAL_IMAGE_URL, STARBOT_X_HANDLE } from "../lib/site-metadata";

export const Route = createFileRoute("/cla")({
  head: ({ match }) => {
    const url = new URL(CLA_ROUTE, match.context.siteUrl).toString();
    const { title, description } = CLA_META;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "StarBot" },
        { property: "og:locale", content: "en_US" },
        { property: "og:url", content: url },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:image", content: STARBOT_SOCIAL_IMAGE_URL },
        { property: "og:image:alt", content: STARBOT_SOCIAL_IMAGE_ALT },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:site", content: STARBOT_X_HANDLE },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: STARBOT_SOCIAL_IMAGE_URL },
        { name: "twitter:image:alt", content: STARBOT_SOCIAL_IMAGE_ALT },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: ClaPage,
});
