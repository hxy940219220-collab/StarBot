export interface AcpAgentPreset {
  id: string;
  name: string;
  command: string;
  args: readonly string[];
}

export const ACP_AGENT_PRESETS: readonly AcpAgentPreset[] = [
  { id: "qwen", name: "阿里千问 · Qwen Code (本机 CLI)", command: "qwen", args: ["--acp"] },
  {
    id: "qwen-npx",
    name: "阿里千问 · Qwen Code (npx 免安装直连)",
    command: "npx",
    args: ["-y", "@qwen-code/qwen-code@latest", "--acp"],
  },
  { id: "goose", name: "Goose Agent", command: "goose", args: ["acp"] },
  { id: "omp", name: "Oh My Pi", command: "omp", args: ["acp"] },
];
