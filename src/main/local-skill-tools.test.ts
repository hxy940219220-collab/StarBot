import type { InstalledSkill } from "@starbot/contracts/ipc";
import { redactText, registerSecretValue } from "@starbot/logging";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { keepSkillIdsReadable } from "./local-skill-tools";

const SAVED_PASSWORD = "starbot";
const CURATED_ID = "starbot-curated-skill-daily-brief";
const GITHUB_ID = `github:starbot/skills@${"a".repeat(40)}:skills/starbot-notes`;
const WORKSPACE_ID = "home:starbot-notes";

function installed(skillId: string, origin: NonNullable<InstalledSkill["origin"]>): InstalledSkill {
  return {
    skillId,
    slug: skillId,
    name: skillId,
    installedVersion: 1,
    availableVersion: 1,
    state: "installed",
    enabled: true,
    origin,
  };
}

describe("installed skill ids and a short saved password", () => {
  it("keeps the ids of installed skills readable and masks the password everywhere else", async () => {
    registerSecretValue(SAVED_PASSWORD, { allowShort: true });
    const ids = JSON.stringify([CURATED_ID, GITHUB_ID, WORKSPACE_ID]);
    expect(JSON.parse(redactText(ids))).toEqual(["[redacted]", "github:[redacted]:[redacted]", "home:[redacted]"]);

    await Effect.runPromise(
      keepSkillIdsReadable([
        installed(CURATED_ID, "marketplace"),
        installed(GITHUB_ID, "marketplace"),
        installed(WORKSPACE_ID, "workspace"),
      ]),
    );

    expect(JSON.parse(redactText(ids))).toEqual([CURATED_ID, GITHUB_ID, "home:[redacted]"]);
    expect(redactText(`pw=${SAVED_PASSWORD}; ${SAVED_PASSWORD}-other-word "${SAVED_PASSWORD}"`)).toBe(
      'pw=[redacted]; [redacted] "[redacted]"',
    );
  });
});
