import { createSignal } from "solid-js";

interface DevWorktree {
  readonly branch: string | null;
  readonly color: string;
}

const [worktree, setWorktree] = createSignal<DevWorktree | null>(null);

const hot = import.meta.hot;
if (hot) {
  const apply = (next: DevWorktree) => {
    setWorktree(next);
    document.documentElement.style.setProperty("--starbot-logo-dev", next.color);
  };
  hot.on("starbot:dev-worktree", apply);
  hot.send("starbot:dev-worktree-request");
  hot.dispose(() => hot.off("starbot:dev-worktree", apply));
}

export const devWorktree = worktree;
