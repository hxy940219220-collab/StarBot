import { Link } from "@tanstack/solid-router";
import { EXTERNAL_LINK_REL, STARBOT_LINKS } from "../../lib/landing-links";

export function DownloadResources() {
  return (
    <p class="download-resources">
      <Link to="/changelog">Release notes</Link>
      <a href={STARBOT_LINKS.releases} target="_blank" rel={EXTERNAL_LINK_REL}>
        All releases on GitHub
      </a>
      <a href={STARBOT_LINKS.troubleshooting} target="_blank" rel={EXTERNAL_LINK_REL}>
        Troubleshooting
      </a>
    </p>
  );
}
