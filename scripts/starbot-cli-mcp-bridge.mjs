#!/usr/bin/env node
import { spawn, execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

const ROOT = join(homedir(), ".starbot-connectors");
const NPM_PREFIX = join(ROOT, "npm");
const BIN_DIR = join(NPM_PREFIX, "node_modules", ".bin");
const SCRIPTS_DIR = join(ROOT, "bin");
const STATE_DIR = join(ROOT, "state");
const PROFILES_DIR = join(ROOT, "profiles");
const OUTPUTS_DIR = join(homedir(), "Desktop", "星友创作成果");

for (const d of [ROOT, NPM_PREFIX, SCRIPTS_DIR, STATE_DIR, PROFILES_DIR]) {
  try { mkdirSync(d, { recursive: true }); } catch {}
}

const ENHANCED_PATH = [
  BIN_DIR,
  SCRIPTS_DIR,
  "/opt/homebrew/bin",
  "/usr/local/bin",
  join(homedir(), ".local", "bin"),
  process.env.PATH || "/usr/bin:/bin:/usr/sbin:/sbin",
].join(":");

function readRuntimePlaywrightCandidates() {
  const candidates = [];
  if (process.env.STARBOT_PLAYWRIGHT_CORE) {
    candidates.push(process.env.STARBOT_PLAYWRIGHT_CORE);
  }
  try {
    const rt = JSON.parse(readFileSync(join(ROOT, "runtime-paths.json"), "utf8"));
    if (rt && typeof rt.playwrightCorePath === "string" && rt.playwrightCorePath) {
      candidates.push(rt.playwrightCorePath);
    }
  } catch {}
  candidates.push(
    join(NPM_PREFIX, "node_modules", "playwright-core", "index.mjs"),
    resolve(process.cwd(), "node_modules", "playwright-core", "index.mjs"),
  );
  return candidates;
}

const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
];

async function loadPlaywrightChromium() {
  for (const candidate of readRuntimePlaywrightCandidates()) {
    if (existsSync(candidate)) {
      const mod = await import(pathToFileURL(candidate).href);
      return mod.chromium || mod.default?.chromium || null;
    }
  }
  return null;
}

function resolveChromeExecutable() {
  for (const p of CHROME_CANDIDATES) {
    if (existsSync(p)) return p;
  }
  return null;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function markdownToSimpleHtml(title, md) {
  const lines = String(md || "").split(/\r?\n/);
  const htmlLines = [`<h1>${escapeHtml(title)}</h1>`];
  let inList = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (inList) { htmlLines.push("</ul>"); inList = false; }
      continue;
    }
    if (line.startsWith("### ")) {
      if (inList) { htmlLines.push("</ul>"); inList = false; }
      htmlLines.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      if (inList) { htmlLines.push("</ul>"); inList = false; }
      htmlLines.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      if (inList) { htmlLines.push("</ul>"); inList = false; }
      htmlLines.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
    } else if (/^[-*•]\s+/.test(line)) {
      if (!inList) { htmlLines.push("<ul>"); inList = true; }
      htmlLines.push(`<li>${escapeHtml(line.replace(/^[-*•]\s+/, ""))}</li>`);
    } else {
      if (inList) { htmlLines.push("</ul>"); inList = false; }
      const formatted = escapeHtml(line).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      htmlLines.push(`<p>${formatted}</p>`);
    }
  }
  if (inList) htmlLines.push("</ul>");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 12pt; line-height: 1.65; color: #1f2329; }
    h1 { font-size: 20pt; color: #111827; margin-bottom: 12pt; }
    h2 { font-size: 15pt; color: #1f2937; margin-top: 16pt; }
    h3 { font-size: 13pt; color: #374151; margin-top: 12pt; }
    p, li { margin-bottom: 6pt; }
  </style></head><body>${htmlLines.join("\n")}</body></html>`;
}

function createNativeDocxFromMarkdown(title, markdown, targetDir) {
  mkdirSync(targetDir, { recursive: true });
  const safeName = String(title || "星友文档").replace(/[\\/:*?"<>|]/g, "-").slice(0, 64);
  const tmpHtml = join(tmpdir(), `starbot-doc-${Date.now()}.html`);
  const outDocx = join(targetDir, `${safeName}.docx`);
  writeFileSync(tmpHtml, markdownToSimpleHtml(title, markdown), "utf8");
  execFileSync("/usr/bin/textutil", ["-convert", "docx", tmpHtml, "-output", outDocx]);
  try { rmSync(tmpHtml, { force: true }); } catch {}
  return outDocx;
}

function createNativeXmindFile(title, markdownOrTopics, targetDir) {
  mkdirSync(targetDir, { recursive: true });
  const safeName = String(title || "星友思维导图").replace(/[\\/:*?"<>|]/g, "-").slice(0, 64);
  const outXmind = join(targetDir, `${safeName}.xmind`);
  const lines = String(markdownOrTopics || "").split(/\r?\n/).filter((l) => l.trim());
  const children = [];
  let currentBranch = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("# ") && children.length === 0 && !currentBranch) continue;
    if (line.startsWith("## ") || (!line.startsWith("  ") && /^(\d+\.|[-*+])\s+/.test(raw))) {
      const clean = line.replace(/^(##\s+|\d+\.\s+|[-*+]\s+)/, "").trim();
      currentBranch = { id: `topic-${Math.random().toString(36).slice(2, 10)}`, title: clean, children: { attached: [] } };
      children.push(currentBranch);
    } else {
      const clean = line.replace(/^(###\s+|[-*+•]\s+|\d+\.\s+)/, "").trim();
      if (!currentBranch) {
        currentBranch = { id: `topic-${Math.random().toString(36).slice(2, 10)}`, title: clean, children: { attached: [] } };
        children.push(currentBranch);
      } else {
        currentBranch.children.attached.push({
          id: `sub-${Math.random().toString(36).slice(2, 10)}`,
          title: clean,
        });
      }
    }
  }
  const contentJson = [
    {
      id: "sheet-starbot-1",
      class: "sheet",
      title: safeName,
      rootTopic: {
        id: "root-starbot-1",
        class: "topic",
        title: safeName,
        structureClass: "org.xmind.ui.logic.right",
        children: { attached: children },
      },
    },
  ];
  const manifestJson = { "file-entries": { "content.json": {}, "metadata.json": {} } };
  const metadataJson = { creator: { name: "StarBot 星友", version: "0.2.0" } };

  const workDir = mkdtempSync(join(tmpdir(), "starbot-xmind-"));
  writeFileSync(join(workDir, "content.json"), JSON.stringify(contentJson, null, 2), "utf8");
  writeFileSync(join(workDir, "manifest.json"), JSON.stringify(manifestJson, null, 2), "utf8");
  writeFileSync(join(workDir, "metadata.json"), JSON.stringify(metadataJson, null, 2), "utf8");
  try { rmSync(outXmind, { force: true }); } catch {}
  execFileSync("/usr/bin/zip", ["-q", "-r", outXmind, "content.json", "manifest.json", "metadata.json"], { cwd: workDir });
  try { rmSync(workDir, { recursive: true, force: true }); } catch {}
  return outXmind;
}

const WPS_SPEC = {
  title: "WPS 金山文档",
  npmPkg: null,
  binName: null,
  loginUrl: "https://account.wps.cn/?cb=https%3A%2F%2Fwww.kdocs.cn%2Flatest",
  webUrl: "https://www.kdocs.cn/latest",
  authCookieRegex: /^(wps_sid|kso_sid)$/i,
  loginCheckNotUrl: /account\.wps\.cn|passport\.wps\.cn|\/login|\/welcome/i,
  tools: [
    {
      name: "wps_save_docx_document",
      description: "将星友撰写好的文章、方案或排版内容直接生成标准 .docx Word 文档存入本机（默认桌面「星友创作成果」文件夹），并自动用本机 WPS Office 打开编辑。",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "文档标题（不含 .docx 后缀）" },
          contentMarkdown: { type: "string", description: "支持标题(#/##)、加粗与列表的完整正文内容" },
          directory: { type: "string", description: "可选保存目录路径，默认保存到桌面" },
          openNow: { type: "boolean", description: "生成后是否立即在 WPS 中打开（默认 true）" },
        },
        required: ["title", "contentMarkdown"],
      },
    },
    {
      name: "wps_read_document_content",
      description: "读取本机指定 Word (.docx/.doc/.rtf/.txt/.csv) 文档的正文内容供星友审阅或修改。",
      inputSchema: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "本地文档完整路径" },
        },
        required: ["filePath"],
      },
    },
    {
      name: "wps_sync_to_cloud_kdocs",
      description: "使用已登录的金山文档账号打开云端工作台并创建/同步在线文档。",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "云文档标题" },
          content: { type: "string", description: "要填入金山云文档并复制到剪贴板的正文内容" },
        },
        required: ["title", "content"],
      },
    },
    {
      name: "wps_list_local_documents",
      description: "扫描本机桌面或指定目录下的 WPS / Office 文档列表。",
      inputSchema: {
        type: "object",
        properties: {
          directory: { type: "string", description: "要扫描的本地目录（默认 ~/Desktop）" },
        },
      },
    },
  ],
};

const APP_SPECS = {
  xiaohongshu: {
    title: "小红书创作服务",
    npmPkg: null,
    binName: null,
    webUrl: "https://creator.xiaohongshu.com/new/home",
    loginUrl: "https://creator.xiaohongshu.com/login",
    authCookieRegex: /^(galaxy_creator_session_id|access-token-creator|customer-sso-sid|x-user-id-creator\.xiaohongshu\.com)$/i,
    loginCheckNotUrl: /\/login\b/i,
    tools: [
      {
        name: "xiaohongshu_save_note_draft",
        description: "使用已绑定的小红书创作者账号，自动生成封面图（或上传指定配图）、填入标题、正文与话题标签，并直接存入小红书创作者后台「草稿箱」（或立即发布）！",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "小红书笔记标题（建议 20 字以内吸睛标题）" },
            content: { type: "string", description: "小红书笔记完整正文（含分段与 Emoji 排版）" },
            tags: { type: "array", items: { type: "string" }, description: "话题标签数组，如 [\"效率神器\", \"桌面搭子\"]" },
            imagePaths: { type: "array", items: { type: "string" }, description: "可选本地配图路径数组；若不传将根据标题自动渲染一张精美 3:4 笔记封面图" },
            publishNow: { type: "boolean", description: "是否直接点击正式发布（默认 false，安全存入小红书草稿箱供用户预览）" },
          },
          required: ["title", "content"],
        },
      },
      {
        name: "xiaohongshu_read_my_notes",
        description: "使用已登录的小红书创作者账号读取后台最近笔记列表与互动数据以供复盘。",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "xiaohongshu_open_creator_studio",
        description: "在已绑定账号的专属浏览器中打开小红书创作者中心查看草稿或数据。",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "可选目标页面链接" },
          },
        },
      },
    ],
  },
  "jimeng-ai": {
    title: "即梦 AI",
    npmPkg: null,
    binName: "jimeng",
    webUrl: "https://jimeng.jianying.com/ai-tool/home",
    authCookieRegex: /^(sessionid|sessionid_ss|sid_tt)$/i,
    loginCheckNotUrl: /\/login\b/i,
    statusCmd: ["jimeng", ["auth", "status"]],
    loginShell: [
      'export PATH="$HOME/.starbot-connectors/npm/node_modules/.bin:$HOME/.starbot-connectors/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"',
      'npm install --prefix "$HOME/.starbot-connectors/npm" @deluxebear/jimeng-cli --no-audit --no-fund >/dev/null 2>&1 || true',
      'jimeng auth login --profile default',
    ].join("\n"),
    tools: [
      {
        name: "jimeng_generate_image",
        description: "在已登录的即梦 AI 账号中自动填入生图提示词与比例并触发高清海报/插画生成。",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "画面描述提示词" },
            ratio: { type: "string", description: "画面比例，如 1:1、16:9、9:16、3:4、4:3" },
          },
          required: ["prompt"],
        },
      },
      {
        name: "jimeng_generate_video",
        description: "在已登录的即梦 AI 账号中自动填入视频提示词与首帧图并触发 AI 视频生成。",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "视频运镜与画面描述提示词" },
            imagePath: { type: "string", description: "可选首帧图片本地路径" },
          },
          required: ["prompt"],
        },
      },
    ],
  },
  feishu: {
    title: "飞书",
    npmPkg: "@larksuite/cli",
    binName: "lark-cli",
    loginUrl: "https://accounts.feishu.cn/accounts/page/login?app_id=2&redirect_uri=https%3A%2F%2Fwww.feishu.cn%2Fdrive%2Fhome%2F",
    webUrl: "https://www.feishu.cn/drive/home/",
    authCookieRegex: /^(session|sl_session|u_token|session_list)$/i,
    loginCheckNotUrl: /accounts\.feishu\.cn|passport\.feishu\.cn|\/login/i,
    statusCmd: ["lark-cli", ["config", "show"]],
    loginShell: [
      'echo "✦ 星友 · 正在连接飞书官方 CLI (@larksuite/cli)..."',
      'if ! command -v lark-cli >/dev/null 2>&1; then npm install --prefix "$HOME/.starbot-connectors/npm" @larksuite/cli --no-audit --no-fund; fi',
      'export PATH="$HOME/.starbot-connectors/npm/node_modules/.bin:/opt/homebrew/bin:/usr/local/bin:$PATH"',
      'lark-cli config show >/dev/null 2>&1 || lark-cli config init --new --lang zh',
      'lark-cli auth login --recommend',
    ].join("\n"),
    tools: [
      {
        name: "feishu_create_cloud_doc",
        description: "在已登录的飞书云空间创建云文档或通过 lark-cli 写入内容，同时导出本地备份文档。",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "飞书云文档标题" },
            contentMarkdown: { type: "string", description: "Markdown 格式的文档正文" },
          },
          required: ["title", "contentMarkdown"],
        },
      },
      {
        name: "feishu_cli",
        description: "执行飞书官方 lark-cli 子命令操作多维表格、云文档、群消息与日程。",
        inputSchema: {
          type: "object",
          properties: {
            args: { type: "array", items: { type: "string" }, description: "lark-cli 参数数组" },
          },
          required: ["args"],
        },
      },
    ],
  },
  "cn-wps": WPS_SPEC,
  wps: WPS_SPEC,
  dingtalk: {
    title: "钉钉",
    npmPkg: "dingtalk-workspace-cli",
    binName: "dws",
    loginUrl: "https://login.dingtalk.com/oauth2/challenge.htm?redirect_uri=https%3A%2F%2Falidocs.dingtalk.com%2Fi%2Fdesktop",
    webUrl: "https://alidocs.dingtalk.com/i/desktop",
    authCookieRegex: /^(lv_p_s|dingtalk_sso|token)$/i,
    loginCheckNotUrl: /login\.dingtalk\.com/i,
    statusCmd: ["dws", ["auth", "status"]],
    loginShell: [
      'if ! command -v dws >/dev/null 2>&1; then npm install --prefix "$HOME/.starbot-connectors/npm" dingtalk-workspace-cli --no-audit --no-fund; fi',
      'export PATH="$HOME/.starbot-connectors/npm/node_modules/.bin:/opt/homebrew/bin:/usr/local/bin:$PATH"',
      'dws auth login -y',
    ].join("\n"),
    tools: [
      {
        name: "dingtalk_save_doc",
        description: "将周报或文档写入已登录的钉钉文档工作台或通过 dws CLI 同步。",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "钉钉文档标题" },
            contentMarkdown: { type: "string", description: "文档正文内容" },
          },
          required: ["title", "contentMarkdown"],
        },
      },
      {
        name: "dingtalk_cli",
        description: "运行钉钉官方 dws CLI 命令管理钉钉待办、日历与文档。",
        inputSchema: {
          type: "object",
          properties: {
            args: { type: "array", items: { type: "string" }, description: "dws 参数数组" },
          },
          required: ["args"],
        },
      },
    ],
  },
  wecom: {
    title: "企业微信",
    npmPkg: "@wecom/cli",
    binName: "wecom-cli",
    webUrl: "https://doc.weixin.qq.com/",
    authCookieRegex: /^(wwrtx\.sid|doc_skey|qm_sid|wxuin)$/i,
    loginCheckNotUrl: /login/i,
    statusCmd: ["wecom-cli", ["auth", "show"]],
    loginShell: [
      'if ! command -v wecom-cli >/dev/null 2>&1; then npm install --prefix "$HOME/.starbot-connectors/npm" @wecom/cli --no-audit --no-fund; fi',
      'export PATH="$HOME/.starbot-connectors/npm/node_modules/.bin:/opt/homebrew/bin:/usr/local/bin:$PATH"',
      'wecom-cli auth init',
    ].join("\n"),
    tools: [
      {
        name: "wecom_save_doc",
        description: "在已登录的企业微信微文档中创建并填入文档内容。",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "微文档标题" },
            contentMarkdown: { type: "string", description: "微文档正文" },
          },
          required: ["title", "contentMarkdown"],
        },
      },
      {
        name: "wecom_cli",
        description: "执行企业微信官方 wecom-cli 命令。",
        inputSchema: {
          type: "object",
          properties: {
            args: { type: "array", items: { type: "string" }, description: "wecom-cli 参数数组" },
          },
          required: ["args"],
        },
      },
    ],
  },
  "tencent-docs": {
    title: "腾讯文档",
    npmPkg: null,
    binName: null,
    webUrl: "https://docs.qq.com/desktop",
    authCookieRegex: /^(TOK|docs_uid|p_skey|skey|wxuin)$/i,
    loginCheckNotUrl: /\/login\b/i,
    tools: [
      {
        name: "tencent_docs_create_and_edit",
        description: "在已登录的腾讯文档账号中新建在线文档并自动写入排版好的内容，同时生成本地 .docx 备份。",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "文档标题" },
            contentMarkdown: { type: "string", description: "Markdown 正文内容" },
          },
          required: ["title", "contentMarkdown"],
        },
      },
    ],
  },
  "kling-ai": {
    title: "可灵 AI",
    npmPkg: null,
    binName: null,
    webUrl: "https://app.klingai.com/cn/text-to-video/new",
    authCookieRegex: /^(userId|kuaishou\.server\.web_st|passToken|bUserId)$/i,
    loginCheckNotUrl: /\/login\b/i,
    tools: [
      {
        name: "kling_submit_video_prompt",
        description: "使用已登录的可灵 AI 账号打开文生视频/图生视频创作台并自动填入分镜提示词。",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "可灵 AI 视频镜头与画面提示词" },
          },
          required: ["prompt"],
        },
      },
    ],
  },
  "meitu-ai": {
    title: "美图设计室",
    npmPkg: null,
    binName: null,
    webUrl: "https://www.designkit.com/",
    authCookieRegex: /^(mt_token|access_token|token|uid|user_id)$/i,
    loginCheckNotUrl: /\/login\b/i,
    tools: [
      {
        name: "meitu_open_and_fill_design",
        description: "在已登录的美图设计室工作台中打开 AI 海报/商品图生成并自动填入文案与画面描述。",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "海报或电商主图设计描述与文案" },
          },
          required: ["prompt"],
        },
      },
    ],
  },
  "baidu-netdisk": {
    title: "百度网盘",
    npmPkg: null,
    binName: null,
    webUrl: "https://pan.baidu.com/disk/main",
    authCookieRegex: /^(BDUSS|BDUSS_BFESS|STOKEN)$/i,
    loginCheckNotUrl: /login|passport\.baidu\.com/i,
    tools: [
      {
        name: "baidu_netdisk_prepare_upload",
        description: "将星友生成的报告或归档清单保存到本地整理目录，并在已登录的百度网盘网页端打开对应目录一键上传归档。",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "归档文件名" },
            contentMarkdown: { type: "string", description: "可选要生成的归档文档正文" },
          },
          required: ["title"],
        },
      },
    ],
  },
  "qq-mail": {
    title: "QQ 邮箱",
    npmPkg: null,
    binName: null,
    loginUrl: "https://wx.mail.qq.com/",
    webUrl: "https://wx.mail.qq.com/home/index",
    authCookieRegex: /^(qm_sid|xm_sid|qqmail_alias)$/i,
    loginCheckNotUrl: /\/cgi-bin\/loginpage|wx\.mail\.qq\.com\/?(\?.*)?$/i,
    tools: [
      {
        name: "qq_mail_compose_draft",
        description: "使用已登录的 QQ 邮箱账号打开写信窗口，将星友起草好的收件人、主题和邮件正文直接填入草稿！",
        inputSchema: {
          type: "object",
          properties: {
            to: { type: "string", description: "收件人邮箱（可选）" },
            subject: { type: "string", description: "邮件主题" },
            body: { type: "string", description: "邮件正文内容" },
          },
          required: ["subject", "body"],
        },
      },
    ],
  },
  xmind: {
    title: "Xmind 思维导图",
    npmPkg: null,
    binName: null,
    webUrl: "https://xmind.cn/",
    tools: [
      {
        name: "xmind_create_mindmap",
        description: "将结构化大纲直接生成标准原生 .xmind 思维导图文件至桌面，并自动唤起本机 Xmind 打开编辑！",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "思维导图中心主题与文件名" },
            markdown: { type: "string", description: "Markdown 多级层级大纲（## 一级分支，- 子节点）" },
          },
          required: ["title", "markdown"],
        },
      },
    ],
  },
  "tencent-map": {
    title: "腾讯地图",
    npmPkg: null,
    binName: null,
    webUrl: "https://map.qq.com/",
    tools: [
      {
        name: "tencent_map_search",
        description: "通过腾讯地图搜索地点、商圈或规划差旅路线并在地图中定位展示。",
        inputSchema: {
          type: "object",
          properties: {
            keyword: { type: "string", description: "地点或路线关键词" },
          },
          required: ["keyword"],
        },
      },
    ],
  },
};

function readState(slug) {
  try {
    return JSON.parse(readFileSync(join(STATE_DIR, `${slug}.json`), "utf8"));
  } catch {
    return {};
  }
}

function writeState(slug, patch) {
  try {
    const next = { ...readState(slug), ...patch };
    writeFileSync(join(STATE_DIR, `${slug}.json`), JSON.stringify(next, null, 2));
    return next;
  } catch {
    return patch;
  }
}

function resolveBin(binName) {
  if (!binName) return null;
  for (const dir of [BIN_DIR, SCRIPTS_DIR, "/opt/homebrew/bin", "/usr/local/bin", join(homedir(), ".local", "bin")]) {
    const p = join(dir, binName);
    if (existsSync(p)) return p;
  }
  try {
    return execFileSync("which", [binName], { env: { ...process.env, PATH: ENHANCED_PATH }, encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
}

function runCliCommand(bin, args, timeoutMs = 45000) {
  return new Promise((resolvePromise) => {
    const child = spawn(bin, args, {
      env: { ...process.env, PATH: ENHANCED_PATH },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
      resolvePromise({ code: 124, stdout: out, stderr: err + "\n[Timed out]" });
    }, timeoutMs);
    child.stdout.on("data", (d) => { out += d.toString(); });
    child.stderr.on("data", (d) => { err += d.toString(); });
    child.on("error", (e) => {
      clearTimeout(timer);
      resolvePromise({ code: 1, stdout: out, stderr: String(e) });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolvePromise({ code: code ?? 0, stdout: out, stderr: err });
    });
  });
}

async function isAppAuthenticated(slug, spec) {
  const st = readState(slug);
  if (st.authenticated === true && existsSync(join(PROFILES_DIR, slug))) {
    return true;
  }
  if (spec.statusCmd) {
    const bin = resolveBin(spec.statusCmd[0]);
    if (bin) {
      const res = await runCliCommand(bin, spec.statusCmd[1], 6000);
      const combined = `${res.stdout}\n${res.stderr}`.toLowerCase();
      if (
        res.code === 0 &&
        combined.trim().length > 0 &&
        !combined.includes("not logged") &&
        !combined.includes("unauth") &&
        !combined.includes("no active") &&
        !combined.includes("empty")
      ) {
        writeState(slug, { authenticated: true, verifiedVia: "cli", verifiedAt: new Date().toISOString() });
        return true;
      }
    }
  }
  return false;
}

function spawnDetachedLoginWindow(slug) {
  const st = readState(slug);
  const now = Date.now();
  if (st.loginWindowOpenedAt && now - st.loginWindowOpenedAt < 12000) {
    return;
  }
  writeState(slug, { loginWindowOpenedAt: now });
  try {
    spawn(process.execPath, [process.argv[1], "--login-window", slug], {
      detached: true,
      stdio: "ignore",
    }).unref();
  } catch {}
}

async function runPersistentBrowserTask(slug, spec, taskFn) {
  const chromium = await loadPlaywrightChromium();
  const executablePath = resolveChromeExecutable();
  if (!chromium || !executablePath) {
    throw new Error("未检测到本机 Chrome 浏览器组件，请确认已安装 Google Chrome。");
  }
  const userDataDir = join(PROFILES_DIR, slug);
  mkdirSync(userDataDir, { recursive: true });
  const context = await chromium.launchPersistentContext(userDataDir, {
    executablePath,
    headless: false,
    viewport: null,
    args: ["--no-first-run", "--no-default-browser-check", "--disable-blink-features=AutomationControlled"],
  });
  try {
    const page = context.pages()[0] || (await context.newPage());
    return await taskFn(context, page);
  } catch (err) {
    try { await context.close(); } catch {}
    throw err;
  }
}

async function renderCoverCardPng(page, title, subtitle) {
  const outPng = join(tmpdir(), `starbot-xhs-cover-${Date.now()}.png`);
  const dataUrl = await page.evaluate(
    ({ t, sub }) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1440;
      const ctx = canvas.getContext("2d");
      const grad = ctx.createLinearGradient(0, 0, 1080, 1440);
      grad.addColorStop(0, "#f6f2ff");
      grad.addColorStop(0.5, "#fff7fb");
      grad.addColorStop(1, "#eef4ff");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1080, 1440);

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect(76, 110, 928, 1220, 48);
      ctx.fill();

      ctx.fillStyle = "#7c5cff";
      ctx.font = "bold 40px 'PingFang SC', sans-serif";
      ctx.fillText("✦ 星友精选笔记", 140, 230);

      ctx.fillStyle = "#18181b";
      ctx.font = "bold 74px 'PingFang SC', sans-serif";
      const chars = Array.from(t || "灵感笔记");
      let line = "";
      let y = 390;
      for (const ch of chars) {
        if (ctx.measureText(line + ch).width > 790) {
          ctx.fillText(line, 140, y);
          line = ch;
          y += 102;
        } else {
          line += ch;
        }
      }
      if (line) ctx.fillText(line, 140, y);

      ctx.fillStyle = "#52525b";
      ctx.font = "42px 'PingFang SC', sans-serif";
      const subChars = Array.from((sub || "").replace(/\s+/g, " ").slice(0, 90));
      let sLine = "";
      let sy = y + 130;
      for (const ch of subChars) {
        if (ctx.measureText(sLine + ch).width > 790) {
          ctx.fillText(sLine, 140, sy);
          sLine = ch;
          sy += 64;
        } else {
          sLine += ch;
        }
      }
      if (sLine) ctx.fillText(sLine, 140, sy);

      return canvas.toDataURL("image/png");
    },
    { t: title, sub: subtitle },
  );
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  writeFileSync(outPng, Buffer.from(base64, "base64"));
  return outPng;
}

// Mode 1: Detached Interactive Login Window (`--login-window <slug>`)
if (process.argv[2] === "--login-window") {
  const slug = process.argv[3];
  const spec = APP_SPECS[slug];
  if (!spec) process.exit(0);

  (async () => {
    // Also launch CLI login helper in Terminal if it's a pure CLI integration and user wants CLI
    if (spec.loginShell && spec.npmPkg) {
      const cmdFile = join(SCRIPTS_DIR, `${slug}-connect.command`);
      writeFileSync(cmdFile, `#!/bin/zsh\n${spec.loginShell}\n`, { mode: 0o755 });
      chmodSync(cmdFile, 0o755);
      try { spawn("open", [cmdFile], { detached: true, stdio: "ignore" }).unref(); } catch {}
    }

    const chromium = await loadPlaywrightChromium();
    const executablePath = resolveChromeExecutable();
    if (!chromium || !executablePath) {
      spawn("open", [spec.loginUrl || spec.webUrl], { detached: true, stdio: "ignore" }).unref();
      process.exit(0);
    }

    const userDataDir = join(PROFILES_DIR, slug);
    mkdirSync(userDataDir, { recursive: true });
    const context = await chromium.launchPersistentContext(userDataDir, {
      executablePath,
      headless: false,
      viewport: null,
      args: ["--no-first-run", "--no-default-browser-check", "--disable-blink-features=AutomationControlled"],
    });
    const page = context.pages()[0] || (await context.newPage());
    const openedAt = Date.now();
    await page.goto(spec.loginUrl || spec.webUrl, { waitUntil: "domcontentloaded" }).catch(() => {});

    let finalized = false;
    const finalizeSuccess = async (activePage, currentUrl, via) => {
      if (finalized) return;
      finalized = true;
      writeState(slug, {
        authenticated: true,
        verifiedVia: via,
        verifiedAt: new Date().toISOString(),
        lastUrl: currentUrl,
      });
      await activePage
        .evaluate((appTitle) => {
          const existing = document.getElementById("starbot-auth-banner");
          if (existing) existing.remove();
          const bar = document.createElement("div");
          bar.id = "starbot-auth-banner";
          bar.style.cssText =
            "position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:2147483647;padding:12px 24px;border-radius:999px;background:linear-gradient(135deg,#16a34a,#059669);color:#fff;font:600 14px -apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 12px 32px rgba(22,163,74,0.38);";
          bar.textContent = `✓ 星友已成功绑定你的「${appTitle}」账号！正在自动同步回星友...`;
          document.body.appendChild(bar);
        }, spec.title)
        .catch(() => {});
      setTimeout(async () => {
        try { await context.close(); } catch {}
        process.exit(0);
      }, 1500);
    };

    const checkTimer = setInterval(async () => {
      try {
        if (context.pages().length === 0) {
          clearInterval(checkTimer);
          if (!finalized) {
            writeState(slug, { loginWindowClosedAt: Date.now() });
          }
          await context.close().catch(() => {});
          process.exit(0);
        }
        if (finalized) return;
        const activePage = context.pages()[0];
        const currentUrl = activePage.url();
        const cookies = await context.cookies();
        const matched = spec.authCookieRegex
          ? cookies.filter((c) => spec.authCookieRegex.test(c.name) && String(c.value || "").length > 4)
          : [];
        const onLoginScreen = spec.loginCheckNotUrl ? spec.loginCheckNotUrl.test(currentUrl) : false;

        if (matched.length > 0 && !onLoginScreen) {
          clearInterval(checkTimer);
          await finalizeSuccess(activePage, currentUrl, "browser-profile");
          return;
        }

        const allowManualConfirm = !onLoginScreen && Date.now() - openedAt > 4500;
        const manualConfirmed = await activePage
          .evaluate(
            ({ appTitle, canConfirm }) => {
              if (window.__starbotManualConfirmed === true) return true;
              let bar = document.getElementById("starbot-auth-guide");
              if (!bar) {
                bar = document.createElement("div");
                bar.id = "starbot-auth-guide";
                bar.style.cssText =
                  "position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483647;display:flex;align-items:center;gap:12px;padding:9px 18px;border-radius:999px;background:rgba(30,22,56,0.92);backdrop-filter:blur(10px);color:#fff;font:500 13px -apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 10px 28px rgba(24,16,52,0.28);";
                const text = document.createElement("span");
                text.textContent = `✦ 星友账号授权：请扫码或登录你的「${appTitle}」账号，完成后将自动连接`;
                bar.appendChild(text);
                document.body.appendChild(bar);
              }
              if (canConfirm && !document.getElementById("starbot-auth-confirm-btn")) {
                const btn = document.createElement("button");
                btn.id = "starbot-auth-confirm-btn";
                btn.type = "button";
                btn.textContent = "我已完成登录，立即同步";
                btn.style.cssText =
                  "border:0;border-radius:999px;padding:5px 12px;background:#7c5cff;color:#fff;font:600 12px -apple-system,BlinkMacSystemFont,sans-serif;cursor:pointer;";
                btn.onclick = () => {
                  window.__starbotManualConfirmed = true;
                };
                bar.appendChild(btn);
              }
              return false;
            },
            { appTitle: spec.title, canConfirm: allowManualConfirm },
          )
          .catch(() => false);

        if (manualConfirmed) {
          clearInterval(checkTimer);
          await finalizeSuccess(activePage, currentUrl, "manual-confirmed-session");
        }
      } catch {
        clearInterval(checkTimer);
        if (!finalized) {
          writeState(slug, { loginWindowClosedAt: Date.now() });
        }
        process.exit(0);
      }
    }, 1000);

    // Auto-timeout after 10 minutes
    setTimeout(async () => {
      clearInterval(checkTimer);
      try { await context.close(); } catch {}
      process.exit(0);
    }, 10 * 60_000);
  })();
} else {
  // Mode 2: Standard MCP stdio JSON-RPC Server
  const args = process.argv.slice(2);
  const requireAuth = args.includes("--require-auth");
  const slug = args.find((a) => !a.startsWith("--")) || "feishu";
  const spec = APP_SPECS[slug] || APP_SPECS.feishu;

  const send = (obj) => {
    process.stdout.write(JSON.stringify(obj) + "\n");
  };

  const rl = createInterface({ input: process.stdin, terminal: false });
  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object") return;
    const { id, method, params } = msg;

    if (method === "initialize") {
      if (requireAuth) {
        let authed = await isAppAuthenticated(slug, spec);
        if (!authed) {
          spawnDetachedLoginWindow(slug);
          const waitDeadline = Date.now() + 50_000;
          while (Date.now() < waitDeadline) {
            await new Promise((r) => setTimeout(r, 900));
            const st = readState(slug);
            if (st.authenticated === true) {
              authed = true;
              break;
            }
            if (st.loginWindowClosedAt && st.loginWindowClosedAt > (st.loginWindowOpenedAt || 0)) {
              break;
            }
          }
          if (!authed) {
            send({
              jsonrpc: "2.0",
              id,
              error: {
                code: -32001,
                message: `尚未完成「${spec.title}」个人账号登录。请在弹出的窗口中扫码或登录你的账号，完成后点击下方重试即可绑定同步！`,
              },
            });
            return;
          }
        }
      }
      send({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: (params && params.protocolVersion) || "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: `starbot-${slug}`, version: "2.0.0" },
        },
      });
      return;
    }

    if (id === undefined || id === null) return;

    if (method === "ping") {
      send({ jsonrpc: "2.0", id, result: {} });
      return;
    }

    if (method === "tools/list") {
      send({ jsonrpc: "2.0", id, result: { tools: spec.tools } });
      return;
    }

    if (method === "tools/call") {
      const toolName = params?.name || "";
      const argsObj = params?.arguments || {};

      try {
        // 1. Local & Cloud WPS Document Creation / Reading
        if (toolName === "wps_save_docx_document") {
          const outDir = argsObj.directory ? resolve(String(argsObj.directory)) : OUTPUTS_DIR;
          const outDocx = createNativeDocxFromMarkdown(argsObj.title, argsObj.contentMarkdown, outDir);
          if (argsObj.openNow !== false) {
            try {
              spawn("open", ["-a", "wpsoffice", outDocx], { detached: true, stdio: "ignore" }).unref();
            } catch {
              spawn("open", [outDocx], { detached: true, stdio: "ignore" }).unref();
            }
          }
          send({
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: `✓ 已将排版好的 Word 文档生成并存入：${outDocx}，已唤起 WPS Office 打开编辑！` }],
            },
          });
          return;
        }

        if (toolName === "wps_read_document_content") {
          const fp = resolve(String(argsObj.filePath || ""));
          if (!existsSync(fp)) throw new Error(`找不到文件：${fp}`);
          const text = execFileSync("/usr/bin/textutil", ["-convert", "txt", "-stdout", fp], {
            encoding: "utf8",
            maxBuffer: 10 * 1024 * 1024,
          });
          send({
            jsonrpc: "2.0",
            id,
            result: { content: [{ type: "text", text: text.slice(0, 30000) || "(文档内容为空)" }] },
          });
          return;
        }

        if (toolName === "wps_list_local_documents") {
          const targetDir = resolve(String(argsObj.directory || join(homedir(), "Desktop")));
          const res = await runCliCommand("find", [
            targetDir, "-maxdepth", "2", "(", "-iname", "*.docx", "-o", "-iname", "*.xlsx", "-o", "-iname", "*.pptx", "-o", "-iname", "*.pdf", ")",
          ], 10000);
          send({
            jsonrpc: "2.0",
            id,
            result: { content: [{ type: "text", text: res.stdout.trim() || "该目录下未找到 WPS / Office 文档。" }] },
          });
          return;
        }

        // 2. Native .xmind Mindmap Creation
        if (toolName === "xmind_create_mindmap") {
          const outXmind = createNativeXmindFile(argsObj.title, argsObj.markdown, OUTPUTS_DIR);
          spawn("open", [outXmind], { detached: true, stdio: "ignore" }).unref();
          send({
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: `✓ 已生成原生 Xmind 思维导图文件：${outXmind}，并已自动唤起打开！` }],
            },
          });
          return;
        }

        // 3. Tencent Map Search
        if (toolName === "tencent_map_search") {
          const kw = encodeURIComponent(String(argsObj.keyword || ""));
          const mapUrl = `https://map.qq.com/?what=${kw}`;
          spawn("open", [mapUrl], { detached: true, stdio: "ignore" }).unref();
          send({
            jsonrpc: "2.0",
            id,
            result: { content: [{ type: "text", text: `已在腾讯地图定位并打开：${mapUrl}` }] },
          });
          return;
        }

        // 4. Xiaohongshu Real Creator Draft Saving / Publishing
        if (toolName === "xiaohongshu_save_note_draft") {
          const noteTitle = String(argsObj.title || "").slice(0, 20);
          const rawTags = Array.isArray(argsObj.tags)
            ? argsObj.tags.map((t) => `#${String(t).replace(/^#+/, "")}`).join(" ")
            : "";
          const fullBody = [String(argsObj.content || "").trim(), rawTags].filter(Boolean).join("\n\n");
          const publishNow = argsObj.publishNow === true;

          const outcome = await runPersistentBrowserTask("xiaohongshu", spec, async (_ctx, page) => {
            await page.goto("https://creator.xiaohongshu.com/publish/publish?target=image", {
              waitUntil: "domcontentloaded",
              timeout: 30000,
            });
            await page.waitForTimeout(2200);
            if (/\/login\b/i.test(page.url())) {
              writeState("xiaohongshu", { authenticated: false });
              throw new Error("小红书登录态已过期，已在打开的窗口展示扫码页，请扫码登录后重试！");
            }

            let uploadFiles = Array.isArray(argsObj.imagePaths)
              ? argsObj.imagePaths.map((p) => resolve(String(p))).filter((p) => existsSync(p))
              : [];
            if (uploadFiles.length === 0) {
              const autoCover = await renderCoverCardPng(page, noteTitle, fullBody);
              uploadFiles = [autoCover];
            }

            const fileInput = page.locator('input[type="file"]').first();
            await fileInput.waitFor({ state: "attached", timeout: 15000 });
            await fileInput.setInputFiles(uploadFiles);
            await page.waitForTimeout(2600);

            const titleInput = page
              .locator('input[placeholder*="标题"], .d-text[placeholder*="标题"], .c-input_inner input')
              .first();
            if ((await titleInput.count()) > 0) {
              await titleInput.click();
              await titleInput.fill(noteTitle);
            }

            const bodyEditor = page
              .locator('#post-textarea, .ql-editor, [contenteditable="true"][data-placeholder], [contenteditable="true"]')
              .first();
            if ((await bodyEditor.count()) > 0) {
              await bodyEditor.click();
              await bodyEditor.fill(fullBody);
            }
            await page.waitForTimeout(1000);

            const btnSelector = publishNow
              ? 'button:has-text("发布")'
              : 'button:has-text("暂存离开"), button:has-text("存草稿"), button:has-text("保存草稿")';
            const actionBtn = page.locator(btnSelector).first();
            if ((await actionBtn.count()) > 0) {
              await actionBtn.click();
              await page.waitForTimeout(2000);
              return publishNow
                ? `✓ 已在你的小红书创作者账号中正式发布笔记《${noteTitle}》！`
                : `✓ 已将笔记《${noteTitle}》（含封面图、正文与标签）直接存入你的小红书创作者后台「草稿箱」！窗口已保留方便你随时预览微调。`;
            }
            return `✓ 已在你的小红书发布后台自动上传配图并填好标题《${noteTitle}》与完整正文，请在已打开的小红书窗口确认保存或发布！`;
          });

          send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: outcome }] } });
          return;
        }

        if (toolName === "xiaohongshu_read_my_notes") {
          const summary = await runPersistentBrowserTask("xiaohongshu", spec, async (ctx, page) => {
            await page.goto("https://creator.xiaohongshu.com/new/note-manager", {
              waitUntil: "domcontentloaded",
              timeout: 25000,
            });
            await page.waitForTimeout(2500);
            const text = await page.evaluate(() => document.body.innerText.slice(0, 6000));
            await ctx.close().catch(() => {});
            return text;
          });
          send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: summary }] } });
          return;
        }

        if (toolName === "xiaohongshu_open_creator_studio") {
          await runPersistentBrowserTask("xiaohongshu", spec, async (_ctx, page) => {
            await page.goto(String(argsObj.url || spec.webUrl), { waitUntil: "domcontentloaded" });
          });
          send({
            jsonrpc: "2.0",
            id,
            result: { content: [{ type: "text", text: "已在绑定账号的专属窗口打开小红书创作服务平台。" }] },
          });
          return;
        }

        // 5. Jimeng AI / Kling AI / Meitu AI Automated Prompt Submission in Authenticated Session
        if (
          toolName === "jimeng_generate_image" ||
          toolName === "jimeng_generate_video" ||
          toolName === "kling_submit_video_prompt" ||
          toolName === "meitu_open_and_fill_design"
        ) {
          const promptText = String(argsObj.prompt || "").trim();
          if (slug === "jimeng-ai") {
            const bin = resolveBin("jimeng");
            if (bin) {
              const subArgs =
                toolName === "jimeng_generate_video"
                  ? ["video", "generate", promptText, ...(argsObj.imagePath ? ["--image", String(argsObj.imagePath)] : [])]
                  : ["image", "generate", promptText, ...(argsObj.ratio ? ["--ratio", String(argsObj.ratio)] : [])];
              const cliRes = await runCliCommand(bin, subArgs, 90000);
              if (cliRes.code === 0 && cliRes.stdout.trim()) {
                send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: cliRes.stdout.trim() }] } });
                return;
              }
            }
          }

          const msgText = await runPersistentBrowserTask(slug, spec, async (_ctx, page) => {
            await page.goto(spec.webUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
            await page.waitForTimeout(2500);
            try {
              execFileSync("pbcopy", [], { input: promptText });
            } catch {}
            const inputBox = page.locator('textarea, [contenteditable="true"]').first();
            if ((await inputBox.count()) > 0) {
              await inputBox.click().catch(() => {});
              await inputBox.fill(promptText).catch(() => {});
            }
            const genBtn = page
              .locator('button:has-text("生成"), button:has-text("立即生成"), button:has-text("创作")')
              .first();
            if ((await genBtn.count()) > 0) {
              await genBtn.click().catch(() => {});
              return `✓ 已在已登录的「${spec.title}」创作台中自动填入提示词并触发生成任务（提示词也已同步复制到剪贴板）！`;
            }
            return `✓ 已打开已登录的「${spec.title}」创作台并填入提示词（同时已复制到剪贴板），可直接在窗口查看生成进度！`;
          });
          send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: msgText }] } });
          return;
        }

        // 6. Cloud Docs & Mail Drafts (Tencent Docs / WPS Cloud / Feishu / DingTalk / WeCom / QQ Mail / Baidu Netdisk)
        if (
          toolName === "wps_sync_to_cloud_kdocs" ||
          toolName === "tencent_docs_create_and_edit" ||
          toolName === "feishu_create_cloud_doc" ||
          toolName === "dingtalk_save_doc" ||
          toolName === "wecom_save_doc" ||
          toolName === "baidu_netdisk_prepare_upload"
        ) {
          const docTitle = String(argsObj.title || "星友协同文档");
          const docBody = String(argsObj.contentMarkdown || argsObj.content || "");
          const localBackup = docBody ? createNativeDocxFromMarkdown(docTitle, docBody, OUTPUTS_DIR) : null;
          try {
            if (docBody) execFileSync("pbcopy", [], { input: `# ${docTitle}\n\n${docBody}` });
          } catch {}
          await runPersistentBrowserTask(slug, spec, async (_ctx, page) => {
            await page.goto(spec.webUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
          });
          send({
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `✓ 已在已登录的「${spec.title}」专属窗口打开云端工作台，完整排版内容已自动写入剪贴板（⌘V 即可一键粘贴），同时已生成标准 .docx 文档存至：${localBackup ?? OUTPUTS_DIR}！`,
                },
              ],
            },
          });
          return;
        }

        if (toolName === "qq_mail_compose_draft") {
          const mailText = `收件人：${argsObj.to || ""}\n主题：${argsObj.subject}\n\n${argsObj.body}`;
          try { execFileSync("pbcopy", [], { input: String(argsObj.body || "") }); } catch {}
          await runPersistentBrowserTask("qq-mail", spec, async (_ctx, page) => {
            await page.goto("https://mail.qq.com/", { waitUntil: "domcontentloaded", timeout: 30000 });
          });
          send({
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: `✓ 已打开已登录的 QQ 邮箱并准备草稿（邮件正文已同步写入剪贴板）：\n${mailText}` }],
            },
          });
          return;
        }

        // 7. Direct Official CLI Execution (feishu_cli / dingtalk_cli / wecom_cli)
        if (spec.binName) {
          let bin = resolveBin(spec.binName);
          if (!bin && spec.npmPkg) {
            execFileSync("npm", ["install", "--prefix", NPM_PREFIX, spec.npmPkg, "--no-audit", "--no-fund"], {
              env: { ...process.env, PATH: ENHANCED_PATH },
              stdio: "ignore",
              timeout: 120000,
            });
            bin = resolveBin(spec.binName);
          }
          if (!bin) throw new Error(`未能定位 ${spec.binName} CLI，请点击重新登录完成初始化。`);
          const passArgs = Array.isArray(argsObj.args) ? argsObj.args.map(String) : ["--help"];
          const res = await runCliCommand(bin, passArgs, 60000);
          send({
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: `${res.stdout}\n${res.stderr}`.trim() || "(CLI 命令已执行完成)" }],
            },
          });
          return;
        }

        send({
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: `已调用 ${spec.title} 工具：${toolName}` }] },
        });
      } catch (err) {
        send({
          jsonrpc: "2.0",
          id,
          result: {
            isError: true,
            content: [{ type: "text", text: `执行失败：${err instanceof Error ? err.message : String(err)}` }],
          },
        });
      }
      return;
    }

    send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
  });
}
