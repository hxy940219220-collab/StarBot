import { faqStructuredData, type LandingQuestion } from "./landing-faq";
import { STARBOT_ALTERNATE_DOWNLOAD_LINKS, STARBOT_DOWNLOAD_LINKS, STARBOT_LINKS } from "./landing-links";

export const STARBOT_SITE_URL = "https://starbot.app/";
export const STARBOT_SITE_TITLE = "StarBot: Run a team of AI agents on your computer";
export const STARBOT_SITE_DESCRIPTION =
  "A free desktop app that runs AI agents as a team on your own computer, with the ChatGPT, Claude, Gemini or Grok plan you already pay for, or your own model.";
export const STARBOT_SOCIAL_IMAGE_URL = `${STARBOT_SITE_URL}starbot-social.png`;
export const STARBOT_X_HANDLE = "@StarBot_";
const STARBOT_X_URL = "https://x.com/StarBot_";
const STARBOT_REPOSITORY_URL = "https://github.com/nightly-labs/starbot";
const STARBOT_PRODUCT_HUNT_URL = "https://www.producthunt.com/products/starbot-3";
const STARBOT_LICENSE_URL = "https://polyformproject.org/licenses/noncommercial/1.0.0/";
const STARBOT_ORGANIZATION_ID = `${STARBOT_SITE_URL}#organization`;
const STARBOT_WEBSITE_ID = `${STARBOT_SITE_URL}#website`;
const STARBOT_APPLICATION_ID = `${STARBOT_SITE_URL}#app`;
export const STARBOT_LOGO_URL = `${STARBOT_SITE_URL}icon-512x512.png`;
export const STARBOT_SOCIAL_IMAGE_ALT = "Meet StarBot on a dark grid background";

export const STARBOT_SOCIAL_IMAGE_META = [
  { property: "og:image", content: STARBOT_SOCIAL_IMAGE_URL },
  { property: "og:image:type", content: "image/png" },
  { property: "og:image:width", content: "1600" },
  { property: "og:image:height", content: "900" },
  { property: "og:image:alt", content: STARBOT_SOCIAL_IMAGE_ALT },
] as const;

export const STARBOT_SOCIAL_IMAGE_TAGS = {
  openGraph: STARBOT_SOCIAL_IMAGE_META,
  twitter: [
    { name: "twitter:image", content: STARBOT_SOCIAL_IMAGE_URL },
    { name: "twitter:image:alt", content: STARBOT_SOCIAL_IMAGE_ALT },
  ],
} as const;

export interface PageSocialImage {
  path: string;
  alt: string;
}

export const STARBOT_LEGAL_SOCIAL_IMAGE: PageSocialImage = {
  path: "/social/legal.jpg",
  alt: "Plain terms. No surprises. StarBot agents beside a paper map",
};

export function pageSocialImageMeta(image: PageSocialImage, siteUrl: string) {
  const url = new URL(image.path, siteUrl).toString();
  return {
    openGraph: [
      { property: "og:image", content: url },
      { property: "og:image:type", content: "image/jpeg" },
      { property: "og:image:width", content: "1600" },
      { property: "og:image:height", content: "900" },
      { property: "og:image:alt", content: image.alt },
    ],
    twitter: [
      { name: "twitter:image", content: url },
      { name: "twitter:image:alt", content: image.alt },
    ],
  } as const;
}

const STARBOT_PRODUCTION_HOSTS = new Set(["starbot.app", "api.starbot.app"]);

export function siteUrlForPage(pageUrl: URL): string {
  return STARBOT_PRODUCTION_HOSTS.has(pageUrl.hostname) ? STARBOT_SITE_URL : `${pageUrl.origin}/`;
}

export interface StarBotApplicationFacts {
  version: string;
  screenshot: string;
}

export function starBotSoftwareApplication(facts: StarBotApplicationFacts) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": STARBOT_APPLICATION_ID,
    name: "StarBot",
    url: STARBOT_SITE_URL,
    image: STARBOT_SOCIAL_IMAGE_URL,
    description: STARBOT_SITE_DESCRIPTION,
    applicationCategory: "DeveloperApplication",
    applicationSubCategory: "AI agent app",
    operatingSystem: [
      "macOS 13 or later (Apple silicon or Intel)",
      "Windows 10 or later (x64)",
      "Linux (x64 or arm64)",
    ],
    downloadUrl: [
      STARBOT_DOWNLOAD_LINKS.macos,
      STARBOT_ALTERNATE_DOWNLOAD_LINKS.macos,
      STARBOT_DOWNLOAD_LINKS.windows,
      STARBOT_DOWNLOAD_LINKS.linux,
      STARBOT_ALTERNATE_DOWNLOAD_LINKS.linux,
    ].map((path) => new URL(path, STARBOT_SITE_URL).toString()),
    featureList: [
      "Runs Codex, Claude Code, Gemini (Antigravity), Grok and OpenCode agents",
      "Uses your ChatGPT, Claude, Google AI Pro or Ultra, or Grok plan",
      "Any OpenAI-compatible model server, also one on your own computer",
      "Agents that work as a team and keep their workspace and history",
      "Chats, files and workspaces stay on your computer",
      "iPhone and Android apps that connect to your own computer",
      "Free for noncommercial use",
    ],
    isAccessibleForFree: true,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    softwareVersion: facts.version,
    screenshot: facts.screenshot,
    license: STARBOT_LICENSE_URL,
    publisher: { "@id": STARBOT_ORGANIZATION_ID },
    sameAs: [STARBOT_REPOSITORY_URL, STARBOT_PRODUCT_HUNT_URL],
  } as const;
}

export type StarBotSoftwareApplication = ReturnType<typeof starBotSoftwareApplication>;

const STARBOT_ORGANIZATION = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": STARBOT_ORGANIZATION_ID,
  name: "StarBot",
  url: STARBOT_SITE_URL,
  logo: STARBOT_LOGO_URL,
  sameAs: [
    STARBOT_REPOSITORY_URL,
    STARBOT_X_URL,
    STARBOT_LINKS.threads,
    STARBOT_LINKS.linkedin,
    STARBOT_LINKS.reddit,
    STARBOT_LINKS.instagram,
    STARBOT_LINKS.tiktok,
    STARBOT_LINKS.facebook,
    STARBOT_PRODUCT_HUNT_URL,
  ],
} as const;

const STARBOT_WEBSITE = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": STARBOT_WEBSITE_ID,
  name: "StarBot",
  url: STARBOT_SITE_URL,
  publisher: { "@id": STARBOT_ORGANIZATION_ID },
} as const;

export const STARBOT_SECURITY_HEADERS = {
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
} as const;

export function starBotRootHead(interLatinFont: string) {
  return {
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: STARBOT_SITE_TITLE },
      { name: "description", content: STARBOT_SITE_DESCRIPTION },
      { name: "application-name", content: "StarBot" },
      { name: "color-scheme", content: "dark" },
      { name: "theme-color", content: "#1a1a1a" },
    ],
    links: [
      {
        rel: "preload",
        as: "font" as const,
        type: "font/woff2",
        href: interLatinFont,
        crossorigin: "anonymous" as const,
      },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", href: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
  };
}

const STARBOT_HOME_SOCIAL_IMAGE: PageSocialImage = {
  path: "/social/home.jpg",
  alt: "Models come and go. Your team stays. StarBot agents on a paper planet",
};

export interface HomePageHead {
  title: string;
  description: string;
  questions: readonly LandingQuestion[];
  path: string;
  openGraphLocale: string;
  alternates: readonly { hreflang: string; path: string }[];
}

export function starBotHomeHead(application: StarBotSoftwareApplication, siteUrl: string, page: HomePageHead) {
  const image = pageSocialImageMeta(STARBOT_HOME_SOCIAL_IMAGE, siteUrl);
  const url = new URL(page.path, STARBOT_SITE_URL).toString();
  const [fallback] = page.alternates;
  return {
    meta: [
      { title: page.title },
      { name: "description", content: page.description },
      { "script:ld+json": application },
      { "script:ld+json": STARBOT_ORGANIZATION },
      { "script:ld+json": STARBOT_WEBSITE },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "StarBot" },
      { property: "og:locale", content: page.openGraphLocale },
      { property: "og:url", content: url },
      { property: "og:title", content: page.title },
      { property: "og:description", content: page.description },
      ...image.openGraph,
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: STARBOT_X_HANDLE },
      { name: "twitter:title", content: page.title },
      { name: "twitter:description", content: page.description },
      ...image.twitter,
      { "script:ld+json": faqStructuredData(page.questions) },
    ],
    links: [
      { rel: "canonical", href: url },
      ...page.alternates.map((alternate) => ({
        rel: "alternate",
        hreflang: alternate.hreflang,
        href: new URL(alternate.path, STARBOT_SITE_URL).toString(),
      })),
      ...(fallback
        ? [{ rel: "alternate", hreflang: "x-default", href: new URL(fallback.path, STARBOT_SITE_URL).toString() }]
        : []),
    ],
  };
}
