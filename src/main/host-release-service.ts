import { readFile } from "node:fs/promises";
import type { HostReleaseStatus, UpdateStatus } from "@openbot/contracts/ipc";
import { isNewerRelease, isValidSemver } from "@openbot/contracts/release-version";
import { Deferred, Effect, Exit, Schema } from "effect";

class ReleaseCheckFailed extends Schema.TaggedError<ReleaseCheckFailed>()("ReleaseCheckFailed", {}) {}

type ReleaseTarget = { feed: string; asset: (version: string) => string };

function releaseTarget(platform: NodeJS.Platform, arch: string): ReleaseTarget | null {
  if (arch !== "x64" && arch !== "arm64") return null;
  if (platform === "linux")
    return {
      feed: arch === "arm64" ? "latest-linux-arm64.yml" : "latest-linux.yml",
      asset: (version) => `StarBot-${version}-${arch === "x64" ? "x86_64" : "arm64"}.AppImage`,
    };
  if (platform === "darwin")
    return {
      feed: "latest-mac.yml",
      asset: (version) => `StarBot-${version}-${arch}.zip`,
    };
  if (platform === "win32" && arch === "x64")
    return {
      feed: "latest.yml",
      asset: (version) => `StarBot-${version}-x64.exe`,
    };
  return null;
}

interface HostReleaseOptions {
  currentVersion: string;
  packaged: boolean;
  platform: NodeJS.Platform;
  arch: string;
  environment: NodeJS.ProcessEnv;
  updateStatus: () => Pick<UpdateStatus, "phase" | "managedByHost">;
  installationMode: string | null;
  fetch?: typeof fetch;
}

export const readInstallationMode = Effect.fn("HostRelease.readInstallationMode")(function* () {
  return yield* Effect.tryPromise({
    try: (signal) => readFile("/opt/OpenBot/hosted/mode", { encoding: "utf8", signal }),
    catch: () => new ReleaseCheckFailed(),
  }).pipe(
    Effect.map((value) => value.trim()),
    Effect.catch(() => Effect.succeed(null)),
  );
});

export class HostReleaseService {
  readonly #options: HostReleaseOptions;
  readonly #target: ReleaseTarget | null;
  #phase: HostReleaseStatus["phase"] = "idle";
  #latestVersion: string | null = null;
  #pending: Deferred.Deferred<HostReleaseStatus> | null = null;

  constructor(options: HostReleaseOptions) {
    this.#options = options;
    this.#target =
      options.packaged && isValidSemver(options.currentVersion) ? releaseTarget(options.platform, options.arch) : null;
  }

  snapshot(): HostReleaseStatus {
    return {
      currentVersion: this.#options.currentVersion,
      latestVersion: this.#latestVersion,
      phase: this.#target ? this.#phase : "unavailable",
      method: this.#method(),
    };
  }

  #method(): HostReleaseStatus["method"] {
    if (!this.#options.packaged) return "unavailable";
    if (this.#options.updateStatus().managedByHost) return "host-manager";
    if (this.#options.platform === "linux") {
      if (this.#options.updateStatus().phase !== "unsupported") return "self-update";
      if (this.#options.installationMode === "container") return "container";
      if (this.#options.environment.OPENBOT_HOSTED_SERVER === "1") return "hosted";
      if (this.#options.installationMode === "self") return "system";
    }
    return this.#options.updateStatus().phase === "unsupported" ? "manual" : "self-update";
  }

  readonly check = Effect.fn("HostRelease.check")(function* (this: HostReleaseService) {
    if (!this.#target) return this.snapshot();
    if (this.#pending) return yield* Deferred.await(this.#pending);
    const pending = Deferred.makeUnsafe<HostReleaseStatus>();
    this.#pending = pending;
    this.#phase = "checking";
    this.#latestVersion = null;
    const target = this.#target;
    return yield* Effect.gen({ self: this }, function* () {
      const version = yield* Effect.tryPromise({
        try: (signal) => fetchLatestRelease(target, this.#options.fetch ?? fetch, signal),
        catch: () => new ReleaseCheckFailed(),
      });
      this.#latestVersion = version;
      this.#phase = isNewerRelease(version, this.#options.currentVersion) ? "available" : "up-to-date";
    }).pipe(
      Effect.catch(() =>
        Effect.sync(() => {
          this.#phase = "error";
        }),
      ),
      Effect.onExit(() =>
        Effect.gen({ self: this }, function* () {
          if (this.#phase === "checking") this.#phase = "error";
          yield* Deferred.done(pending, Exit.succeed(this.snapshot()));
          this.#pending = null;
        }),
      ),
      Effect.map(() => this.snapshot()),
    );
  }).bind(this);
}

async function fetchLatestRelease(
  _target: ReleaseTarget,
  _request: typeof fetch,
  _signal: AbortSignal,
): Promise<string> {
  throw new Error("Release feed disabled for local StarBot build");
}

export function fetchLatestLinuxRelease(arch: string, request: typeof fetch, signal: AbortSignal): Promise<string> {
  const target = releaseTarget("linux", arch);
  if (!target) return Promise.reject(new Error("No release for this machine"));
  return fetchLatestRelease(target, request, signal);
}
