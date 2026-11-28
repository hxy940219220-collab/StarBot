import type { MarketplacePluginDetail } from "@openbot/ui/features/settings/marketplace-plugins";
import { MARKETPLACE_PLUGINS } from "./marketplace-plugin-catalog";
import { STARBOT_OFFICIAL_APP_ICONS } from "./starbot-official-app-icons";

function findUpstreamPlugin(slug: string): MarketplacePluginDetail | undefined {
  return MARKETPLACE_PLUGINS.find((p) => p.slug === slug);
}

function localizedUpstream(
  slug: string,
  overrides: {
    name?: string;
    tagline: string;
    description: string;
    iconUrl: string;
    prompts?: string[];
    authLabel?: string;
  },
): MarketplacePluginDetail | null {
  const found = findUpstreamPlugin(slug);
  if (!found) return null;
  const apps = found.apps.map((app) => ({
    ...app,
    ...(overrides.name ? { name: overrides.name } : {}),
    description: overrides.tagline,
    iconUrl: overrides.iconUrl,
    server: {
      ...app.server,
      ...(app.server.auth && overrides.authLabel
        ? {
            auth: app.server.auth.map((flow) => ({
              ...flow,
              label: overrides.authLabel!,
            })),
          }
        : {}),
    },
  }));
  return {
    ...found,
    ...(overrides.name ? { name: overrides.name } : {}),
    iconUrl: overrides.iconUrl,
    tagline: overrides.tagline,
    description: overrides.description,
    ...(overrides.prompts
      ? {
          prompts: overrides.prompts.map((text, idx) => ({
            id: `${slug}-zh-${idx + 1}`,
            text,
          })),
        }
      : {}),
    apps,
    featured: true,
  };
}

const LOCAL_NO_LOGIN_SLUGS = new Set<string>(["xmind", "tencent-map"]);

function buildCliBridgeApp(spec: {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  creatorName: string;
  websiteUrl: string;
  iconUrl: string;
  category: MarketplacePluginDetail["category"];
  prompts: string[];
}): MarketplacePluginDetail {
  const needsAccountLogin = !LOCAL_NO_LOGIN_SLUGS.has(spec.slug);
  const cmdSuffix = needsAccountLogin ? `${spec.slug} --require-auth` : spec.slug;
  return {
    id: `plugin-${spec.slug}`,
    slug: spec.slug,
    name: spec.name,
    tagline: spec.tagline,
    description: spec.description,
    category: spec.category,
    creatorName: spec.creatorName,
    iconUrl: spec.iconUrl,
    version: "1.1.0",
    prompts: spec.prompts.map((text, idx) => ({ id: `${spec.slug}-p-${idx + 1}`, text })),
    apps: [
      {
        id: `app-${spec.slug}-cli-mcp`,
        name: spec.name,
        description: spec.tagline,
        iconUrl: spec.iconUrl,
        server: {
          name: spec.slug,
          transport: "stdio",
          command: "/bin/sh",
          args: [
            "-c",
            `PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$PATH" exec node "$HOME/.starbot-connectors/starbot-cli-mcp-bridge.mjs" ${cmdSuffix}`,
          ],
          ...(needsAccountLogin
            ? {
                auth: [
                  {
                    id: `${spec.slug}-account-login`,
                    label: `登录 ${spec.name} 账号`,
                    kind: "local" as const,
                    steps: [
                      `星友已自动为你拉起「${spec.name}」专属持久化登录窗口（或 CLI 授权脚本）。`,
                      `请在弹出的窗口中扫码或登录你的「${spec.name}」真实账号（登录态将持久保存在星友独立安全沙盒）。`,
                      `登录成功后，点击下方「已完成登录，验证并连接」即可打通写入、存草稿与执行权限！`,
                    ],
                    note: `打通账号后，你在星友里写好的文案、文档、表格或生图提示词，可直接存入「${spec.name}」草稿箱或在线编辑执行。`,
                    docsUrl: spec.websiteUrl,
                    docsLabel: "手动打开官网",
                  },
                ],
              }
            : {}),
        },
      },
    ],
    websiteUrl: spec.websiteUrl,
    privacyPolicyUrl: spec.websiteUrl,
    termsUrl: spec.websiteUrl,
    skills: [],
    installs: 0,
    featured: true,
    updatedAt: "2026-11-26T00:00:00.000Z",
    shareUrl: spec.websiteUrl,
  };
}

function buildZeroSecretStdioApp(spec: {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  creatorName: string;
  websiteUrl: string;
  iconUrl: string;
  category: MarketplacePluginDetail["category"];
  commandArgs: string[];
  prompts: string[];
}): MarketplacePluginDetail {
  return {
    id: `plugin-${spec.slug}`,
    slug: spec.slug,
    name: spec.name,
    tagline: spec.tagline,
    description: spec.description,
    category: spec.category,
    creatorName: spec.creatorName,
    iconUrl: spec.iconUrl,
    version: "1.0.0",
    prompts: spec.prompts.map((text, idx) => ({ id: `${spec.slug}-p-${idx + 1}`, text })),
    apps: [
      {
        id: `app-${spec.slug}-mcp`,
        name: spec.name,
        description: spec.tagline,
        iconUrl: spec.iconUrl,
        server: {
          name: spec.slug,
          transport: "stdio",
          command: "npx",
          args: spec.commandArgs,
        },
      },
    ],
    websiteUrl: spec.websiteUrl,
    privacyPolicyUrl: spec.websiteUrl,
    termsUrl: spec.websiteUrl,
    skills: [],
    installs: 0,
    featured: true,
    updatedAt: "2026-11-25T00:00:00.000Z",
    shareUrl: spec.websiteUrl,
  };
}

// 1. 国内主流国民级生态（全部采用官方真实图标 + 官方 CLI 自动脚本 / 网页一键授权，剔除小众金融/非主流插件）
const DOMESTIC_PLUGINS: MarketplacePluginDetail[] = [
  buildCliBridgeApp({
    slug: "feishu",
    name: "飞书",
    tagline: "官方 CLI 自动脚本接入 · 云文档、多维表格、群消息与日历协同",
    description:
      "采用飞书官方 @larksuite/cli 自动化脚本打通连接（彻底解决远程 MCP 客户端白名单拦截问题），点击连接即可一键拉起飞书官方网页扫码登录，让星友直接读写云文档、多维表格、群消息与日程。",
    creatorName: "字节跳动 · 飞书开放平台",
    websiteUrl: "https://www.feishu.cn/",
    iconUrl: STARBOT_OFFICIAL_APP_ICONS.feishu,
    category: "productivity",
    prompts: ["帮我把今天的会议讨论要点整理成一篇飞书云文档。", "查询我飞书多维表格里的本周项目排期并汇总风险项。"],
  }),
  buildCliBridgeApp({
    slug: "jimeng-ai",
    name: "即梦 AI",
    tagline: "内置封装 CLI 一键连接 · 抖音旗下 AI 海报生图、插画与视频生成",
    description:
      "已内置打包封装即梦 AI CLI（jimeng）与自动化登录脚本，点击连接即可一键绑定即梦创作台会话，支持在星友对话中直接调用即梦生成高清海报、配图与短视频。",
    creatorName: "字节跳动 · 即梦 AI (Dreamina)",
    websiteUrl: "https://jimeng.jianying.com/",
    iconUrl: STARBOT_OFFICIAL_APP_ICONS.jimeng,
    category: "design",
    prompts: [
      "调用即梦 AI 帮我生成一张 16:9 治愈系紫色星空的桌面壁纸插画。",
      "用即梦 AI 为我们的新品发布会生成一组 3:4 竖版宣传海报配图。",
    ],
  }),
  buildCliBridgeApp({
    slug: "cn-wps",
    name: "WPS 金山文档",
    tagline: "本机 WPS / Office 文档读写 + 金山云文档一键联动",
    description:
      "连接本机 WPS Office 与金山文档（KDocs）能力：无需填写任何密钥，即可扫描、读取与排版电脑上的 Word（.docx）、Excel（.xlsx）、PPT（.pptx）和 PDF 文件，并一键联动金山云文档在线编辑。",
    creatorName: "金山办公 · WPS Office",
    websiteUrl: "https://www.kdocs.cn/",
    iconUrl: STARBOT_OFFICIAL_APP_ICONS.wps,
    category: "documents",
    prompts: [
      "扫描我桌面上的 WPS / Excel 销售报表，统计各品类环比增长并生成汇总表。",
      "把这份方案提纲整理好并调用本机 WPS 打开预览。",
    ],
  }),
  buildCliBridgeApp({
    slug: "dingtalk",
    name: "钉钉",
    tagline: "官方 dws CLI 自动接入 · 钉钉文档、待办事项、日程与工作台",
    description:
      "集成钉钉官方 dingtalk-workspace-cli（dws）自动化接入脚本，点击连接自动安装并拉起钉钉网页授权登录，免填 AppKey/Secret 即可读写钉钉文档、管理待办与查看日程。",
    creatorName: "阿里巴巴 · 钉钉开放平台",
    websiteUrl: "https://www.dingtalk.com/",
    iconUrl: STARBOT_OFFICIAL_APP_ICONS.dingtalk,
    category: "productivity",
    prompts: ["查看我钉钉里今天的待办事项与下午的会议日程安排。", "把这份周报草稿同步整理到我的钉钉文档。"],
  }),
  buildCliBridgeApp({
    slug: "wecom",
    name: "企业微信",
    tagline: "官方 CLI 自动脚本接入 · 企微消息、微文档与团队日程协同",
    description:
      "基于企业微信官方 @wecom/cli 打包自动化脚本，点击连接自动部署 CLI 并引导完成企微账号授权，让星友协助管理企微微文档、日程与工作沟通。",
    creatorName: "腾讯 · 企业微信团队",
    websiteUrl: "https://work.weixin.qq.com/",
    iconUrl: STARBOT_OFFICIAL_APP_ICONS.wecom,
    category: "productivity",
    prompts: ["帮我检查企业微信 CLI 授权状态并梳理今日客户跟进纪要。", "起草一份部门通知并准备同步到企业微信微文档。"],
  }),
  buildCliBridgeApp({
    slug: "tencent-docs",
    name: "腾讯文档",
    tagline: "一键网页授权连接 · 在线 Word、智能表格与收集表协同",
    description:
      "一键连接腾讯文档工作台并拉起浏览器登录你的微信/QQ 账号，方便星友配合你快速整理在线文档、汇总智能表格与导出本地报告。",
    creatorName: "腾讯文档",
    websiteUrl: "https://docs.qq.com/",
    iconUrl: STARBOT_OFFICIAL_APP_ICONS.tencentDocs,
    category: "documents",
    prompts: [
      "打开腾讯文档工作台，帮我把这份活动策划案整理成在线协作表格结构。",
      "提炼这份在线收集表的反馈结果并输出重点结论。",
    ],
  }),
  buildCliBridgeApp({
    slug: "kling-ai",
    name: "可灵 AI",
    tagline: "一键直连创作台 · 快手旗下电影级 AI 视频生成与视觉创作",
    description:
      "一键打通快手可灵 AI（Kling AI）创作工作台，配合星友自动撰写专业分镜提示词、运镜脚本并快速发起图生视频与文生视频创作。",
    creatorName: "快手 · 可灵 AI",
    websiteUrl: "https://klingai.kuaishou.com/",
    iconUrl: STARBOT_OFFICIAL_APP_ICONS.klingAi,
    category: "design",
    prompts: [
      "帮我设计一段 5 秒产品特写运镜提示词并打开可灵 AI 生成视频。",
      "把这张角色设定图转化为可灵 AI 动态视频分镜脚本。",
    ],
  }),
  buildCliBridgeApp({
    slug: "meitu-ai",
    name: "美图设计室",
    tagline: "一键直连设计工作台 · 电商商品图、海报排版与智能抠图精修",
    description:
      "连接美图设计室 AI 工作台，支持配合星友策划电商详情页视觉文案、社媒封面尺寸规范并一键跳转生成高清成图。",
    creatorName: "美图公司 · Meitu AI",
    websiteUrl: "https://www.designkit.com/",
    iconUrl: STARBOT_OFFICIAL_APP_ICONS.meituAi,
    category: "design",
    prompts: [
      "帮我策划一套新品护肤品电商主图文案并打开美图设计室制作。",
      "整理小红书 3:4 封面标题字号排版建议并打开美图设计室。",
    ],
  }),
  buildCliBridgeApp({
    slug: "xiaohongshu",
    name: "小红书创作服务",
    tagline: "创作者工作台一键直连 · 爆款选题、种草文案排版与发布管理",
    description:
      "一键连接小红书创作者服务平台，让星友帮你完成热门选题拆解、标题痛点打磨、Emoji 排版润色后直接跳转创作者中心发布。",
    creatorName: "小红书 · 创作服务平台",
    websiteUrl: "https://creator.xiaohongshu.com/",
    iconUrl: STARBOT_OFFICIAL_APP_ICONS.xiaohongshu,
    category: "productivity",
    prompts: [
      "帮我写一篇桌面效率神器种草笔记（含 5 个备选爆款标题）并打开小红书发布后台。",
      "复盘我最近三篇笔记的标题结构并给出优化方案。",
    ],
  }),
  buildCliBridgeApp({
    slug: "baidu-netdisk",
    name: "百度网盘",
    tagline: "云盘资料一键联动 · 项目素材归档、分享链接整理与本地检索",
    description:
      "一键打通百度网盘网页与桌面端工作流，方便星友协助整理网盘资料目录清单、归档下载文件与快速访问云端知识库。",
    creatorName: "百度网盘",
    websiteUrl: "https://pan.baidu.com/",
    iconUrl: STARBOT_OFFICIAL_APP_ICONS.baiduNetdisk,
    category: "documents",
    prompts: [
      "打开我的百度网盘并帮我规划一套清晰的年度项目资料归档目录结构。",
      "整理我下载文件夹里的近期资料清单准备上传网盘备份。",
    ],
  }),
  buildCliBridgeApp({
    slug: "qq-mail",
    name: "QQ 邮箱",
    tagline: "一键连接邮箱工作台 · 商务邮件起草、中英润色与附件核对",
    description: "连接腾讯 QQ 邮箱，配合星友快速提炼往来邮件重点、起草得体的商务合作/汇报邮件并一键打开 QQ 邮箱发送。",
    creatorName: "腾讯 · QQ 邮箱",
    websiteUrl: "https://mail.qq.com/",
    iconUrl: STARBOT_OFFICIAL_APP_ICONS.qqMail,
    category: "productivity",
    prompts: ["帮我起草一封给合作方的合同确认邮件并打开 QQ 邮箱。", "把这段中文项目进度翻译成地道英文商务邮件。"],
  }),
  buildCliBridgeApp({
    slug: "xmind",
    name: "Xmind 思维导图",
    tagline: "本机与在线导图联动 · 一键生成结构化思维导图大纲并唤起打开",
    description:
      "支持让星友将复杂读书笔记、会议纪要或项目拆解直接导出为结构化思维导图文件至桌面，并一键唤起本机 Xmind 打开编辑。",
    creatorName: "Xmind 思维导图",
    websiteUrl: "https://xmind.cn/",
    iconUrl: STARBOT_OFFICIAL_APP_ICONS.xmind,
    category: "productivity",
    prompts: [
      "把今天的产品上线方案拆解成四层思维导图并用 Xmind 导出到桌面。",
      "将这篇长文章的核心论点整理成 Xmind 导图大纲。",
    ],
  }),
  buildCliBridgeApp({
    slug: "tencent-map",
    name: "腾讯地图",
    tagline: "地点检索与行程路线联动 · 差旅动线规划、商圈探索与导航直达",
    description:
      "内置腾讯地图检索工具，让星友在做差旅行程规划、团建选址或门店调研时可直接调起腾讯地图定位具体地点与路线。",
    creatorName: "腾讯位置服务",
    websiteUrl: "https://map.qq.com/",
    iconUrl: STARBOT_OFFICIAL_APP_ICONS.tencentMap,
    category: "productivity",
    prompts: [
      "帮我规划上海两天一夜看展美食路线，并在腾讯地图打开第一站位置。",
      "在腾讯地图搜索深圳南山科技园附近适合 10 人商务聚餐的餐厅。",
    ],
  }),
  localizedUpstream("dida365", {
    name: "滴答清单",
    tagline: "网页一键 OAuth 授权 · 待办清单、番茄专注与日程提醒同步",
    description:
      "通过滴答清单（Dida365）官方 MCP 服务拉起浏览器一键授权登录你的个人账号，免填任何密钥，支持自然语言查询今日待办、添加提醒事项与复盘完成记录。",
    iconUrl: STARBOT_OFFICIAL_APP_ICONS.dida365,
    authLabel: "跳转滴答清单授权",
    prompts: ["帮我看看滴答清单里今天有哪些到期的重要待办？", "把刚刚聊到的三项跟进任务添加到我的滴答清单收件箱。"],
  }),
  localizedUpstream("apple-apps", {
    name: "Mac 原生办公全家桶",
    tagline: "系统级一键授权 · 日历、备忘录、提醒事项、邮件与 Safari",
    description:
      "无需注册任何账号或填写密钥，直接通过 macOS 系统自动化权限打通本机「日历、备忘录、提醒事项、邮件、通讯录与 Safari」，让星友直接帮你查日程、记备忘与管待办。",
    iconUrl: STARBOT_OFFICIAL_APP_ICONS.appleMac,
    prompts: [
      "查看我今天 Mac 日历里的日程安排，并在提醒事项里加上下午 4 点复盘。",
      "在我的 Mac 备忘录里搜索最近记录的产品灵感并整理成清单。",
    ],
  }),
].filter((item): item is MarketplacePluginDetail => item !== null);

// 2. 海外主流精选（全部采用官方真实应用图标 + 网页一键 OAuth / 免密直连）
const OVERSEAS_GMAIL: MarketplacePluginDetail = buildZeroSecretStdioApp({
  slug: "google-gmail",
  name: "Google Gmail",
  tagline: "浏览器自动 OAuth 登录 · 邮件智能摘要、检索与草拟回复",
  description:
    "连接你的 Gmail 邮箱，点击连接即通过本地自动 OAuth 流程完成授权，无需手填繁琐参数，支持快速检索重要邮件、提炼长邮件摘要与起草回信。",
  creatorName: "Google Workspace",
  websiteUrl: "https://mail.google.com/",
  iconUrl: STARBOT_OFFICIAL_APP_ICONS.gmail,
  category: "productivity",
  commandArgs: ["-y", "@gongrzhe/server-gmail-autoauth-mcp"],
  prompts: [
    "帮我汇总最近 24 小时 Gmail 里需要我回复的重要邮件。",
    "查找上周关于合作报价的邮件并起草一封得体的确认回信。",
  ],
});

const OVERSEAS_FROM_CATALOG: MarketplacePluginDetail[] = [
  localizedUpstream("notion", {
    name: "Notion",
    tagline: "网页一键登录授权 · 页面、数据库与知识库空间双向读写",
    description: "通过浏览器一键登录你的 Notion 账号授权，让星友直接搜索工作区页面、读写数据库并持续维护项目笔记。",
    iconUrl: STARBOT_OFFICIAL_APP_ICONS.notion,
    authLabel: "跳转 Notion 网页授权",
    prompts: [
      "在我的 Notion 工作区搜索最新产品需求文档并提炼待确认问题。",
      "把刚刚讨论的行动清单写入我的 Notion 项目跟进页面。",
    ],
  }),
  localizedUpstream("figma", {
    name: "Figma",
    tagline: "桌面端免密直连 · 读取设计稿图层结构、组件规范与色板",
    description:
      "直接连接本机已打开的 Figma 桌面应用内置 MCP 服务，免填 Token 即可读取设计稿布局、间距与样式变量并转化为前端代码。",
    iconUrl: STARBOT_OFFICIAL_APP_ICONS.figma,
    prompts: [
      "读取当前 Figma 设计稿页面中的组件层级、字号与颜色规范。",
      "对照设计稿检查当前页面的间距和圆角是否一致。",
    ],
  }),
  localizedUpstream("canva", {
    name: "Canva 可画",
    tagline: "网页一键登录授权 · 海报配图、社媒视觉与演示文稿导出",
    description:
      "通过浏览器一键登录 Canva 账号授权，在对话中检索你的设计库、套用视觉模板生成配图或演示文稿并导出 PNG / PDF。",
    iconUrl: STARBOT_OFFICIAL_APP_ICONS.canva,
    authLabel: "跳转 Canva 网页授权",
    prompts: ["打开我最近编辑的 Canva 海报设计并导出高清图片。", "基于今天的产品亮点在 Canva 生成一套社媒宣传配图。"],
  }),
  localizedUpstream("linear", {
    name: "Linear",
    tagline: "网页一键登录授权 · 研发 Issue 追踪、排期与缺陷管理",
    description: "通过浏览器一键登录 Linear 账号，让星友帮你查看本周分配任务、梳理需求池优先级或快速创建结构化 Issue。",
    iconUrl: STARBOT_OFFICIAL_APP_ICONS.linear,
    authLabel: "跳转 Linear 网页授权",
    prompts: [
      "列出本周指派给我的所有 Linear 任务并按优先级排序。",
      "为刚刚发现的界面问题创建一个带复现步骤的 Linear Issue。",
    ],
  }),
  localizedUpstream("vercel", {
    name: "Vercel",
    tagline: "网页一键登录授权 · 应用部署状态、预览链接与线上日志监控",
    description: "通过浏览器一键登录你的 Vercel 账号授权，直接查看最新部署进度、预览链接、环境变量与运行错误日志。",
    iconUrl: STARBOT_OFFICIAL_APP_ICONS.vercel,
    authLabel: "跳转 Vercel 网页授权",
    prompts: ["查看我最近的 Vercel 部署列表，排查上一次构建失败的原因。", "检查当前生产环境部署项目的最新运行日志。"],
  }),
  localizedUpstream("cloudflare", {
    name: "Cloudflare",
    tagline: "网页一键登录授权 · Workers、DNS 解析、R2 存储与日志",
    description:
      "通过浏览器一键登录 Cloudflare 账号授权，轻松查询域名 DNS 记录、Workers 部署状态、D1/KV 存储与线上报错日志。",
    iconUrl: STARBOT_OFFICIAL_APP_ICONS.cloudflare,
    authLabel: "跳转 Cloudflare 授权",
    prompts: ["列出我 Cloudflare 账号下正在运行的 Workers 服务及最近错误日志。", "查看当前主域名的全部 DNS 解析记录。"],
  }),
].filter((item): item is MarketplacePluginDetail => item !== null);

export const STARBOT_DOMESTIC_APP_IDS: ReadonlySet<string> = new Set(DOMESTIC_PLUGINS.map((p) => p.slug));

export const STARBOT_OVERSEAS_APP_IDS: ReadonlySet<string> = new Set([
  "github",
  OVERSEAS_GMAIL.slug,
  ...OVERSEAS_FROM_CATALOG.map((p) => p.slug),
]);

export const STARBOT_CURATED_PLUGINS: readonly MarketplacePluginDetail[] = [
  ...DOMESTIC_PLUGINS,
  OVERSEAS_GMAIL,
  ...OVERSEAS_FROM_CATALOG,
];
