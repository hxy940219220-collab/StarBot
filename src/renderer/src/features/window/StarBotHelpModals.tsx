import {
  BookMarked,
  Button,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Input,
  Megaphone,
  MessageSquare,
  PanelRight,
  Puzzle,
  Search,
  Sparkles,
  Textarea,
  X,
} from "@openbot/ui";
import { avatarSeedForFace, ZODIAC_AVATAR_LIST } from "@openbot/ui/bloub-avatar";
import { AgentAvatar } from "@openbot/ui/features/agents/AgentAvatar";
import { playKawaiiCue } from "@openbot/ui/features/agents/starbot-kawaii-audio";
import tourCompanionAnim from "./assets/tour-companion.webp";
import tourForwardAnim from "./assets/tour-forward.webp";
import tourQuickAskAnim from "./assets/tour-quick-ask.webp";
import { Portal } from "@solidjs/web";
import { createMemo, createSignal, For, Show } from "solid-js";
import { actionToast } from "../../action-toast";

const GUIDE_MASCOT = {
  id: "starbot-guide-mascot",
  name: "星友向导",
  avatarSeed: avatarSeedForFace("starbot-guide", {
    shape: ZODIAC_AVATAR_LIST[0]!.shape,
    expression: "heureux",
  }),
  avatarHue: null,
  avatarUrl: null,
};

const FEEDBACK_MASCOT = {
  id: "starbot-feedback-mascot",
  name: "星友信使",
  avatarSeed: avatarSeedForFace("starbot-feedback", {
    shape: ZODIAC_AVATAR_LIST[3]?.shape ?? ZODIAC_AVATAR_LIST[0]!.shape,
    expression: "heureux",
  }),
  avatarHue: null,
  avatarUrl: null,
};

type FeedbackCategory = "suggestion" | "ux" | "bug";

const FEEDBACK_CATEGORIES: ReadonlyArray<{ id: FeedbackCategory; label: string }> = [
  { id: "suggestion", label: "功能建议" },
  { id: "ux", label: "体验打磨" },
  { id: "bug", label: "问题反馈" },
];

const FEEDBACK_STORAGE_KEY = "starbot:frontend-feedback-list";

interface GuideStepItem {
  title: string;
  detail: string;
}

interface GuideSection {
  id: string;
  group: string;
  badge: string;
  navTitle: string;
  title: string;
  subtitle: string;
  icon: typeof Sparkles;
  steps: readonly GuideStepItem[];
  tips: readonly string[];
}

const GUIDE_SECTIONS: readonly GuideSection[] = [
  {
    id: "navigation",
    group: "快速入门",
    badge: "01",
    navTitle: "导航栏全景导览",
    title: "认识星友工作台与左侧导航栏",
    subtitle: "一屏看懂左侧导航栏、中间对话区与右侧设定栏的分工逻辑，快速切换所有核心模块。",
    icon: Sparkles,
    steps: [
      {
        title: "左上功能导航区与「⚡ 随手问 · 闪念」",
        detail:
          "从上到下依次为：「星友对话」查看全部十二星座助手与群聊；「日程月历」管理定时任务；「算力看板」统计 Token 消耗；「资料库」集中管理文件；以及闪电图标「随手问 · 闪念」（也可随时按下快捷键 Shift + Space 秒呼出），支持跨界面直接向任意星友提问或记下闪念。",
      },
      {
        title: "左下模型与市集入口",
        detail:
          "左下角带绿环的圆标代表当前已连接的本机 Agent（如 GPT / Claude / Gemini），点击可直达「模型中心」；下方小店图标为「星友市集」，用于连接飞书、即梦 AI 等主流应用与安装 GitHub 高星技能。",
      },
      {
        title: "中间主工作区与右侧「星友设定」栏",
        detail:
          "中间区域负责沉浸式聊天、预览网页与文档；点击对话右上角面板按钮可随时展开或收起右侧「星友设定」，无需离开对话即可调教当前星友。",
      },
    ],
    tips: [
      "按下快捷键 ⌘K（Windows 为 Ctrl+K）可随时唤起全局搜索，秒搜历史聊天记录与星友。",
      "在二级页面（如星友市集、模型中心）点击左上角「←」返回箭头即可一键回到上一步。",
    ],
  },
  {
    id: "create-agent",
    group: "快速入门",
    badge: "02",
    navTitle: "创建与设计专属星友",
    title: "如何捏造并设计一只好用的专属星友",
    subtitle: "从十二星座软陶形象到灵魂人设撰写，四步打造真正懂你工作习惯的 AI 伙伴。",
    icon: BookMarked,
    steps: [
      {
        title: "第一步：挑选星座软陶与专属釉色",
        detail:
          "点击左侧栏顶部的「+」进入新助手页面。右侧可任选 12 星座形象，左侧舞台支持点击「随机抽盒」、试玩「待机 / 开心 / 思考 / 睡眠」表情并切换软陶釉色（注：创建绑定后形象将锁定，满满专属仪式感）。",
      },
      {
        title: "第二步：起一个专属名字并选定驱动模型",
        detail:
          "在「名称」框输入称呼（支持左右方向键与快捷键精准移动光标编辑），对话时星友会始终以该名字自称；在「模型」下拉框选择本机已连接的模型与推理强度。",
      },
      {
        title: "第三步：用「三要素公式」填写角色身份（强烈推荐）",
        detail:
          "虽然选填但极其关键！建议按「身份定位 + 说话语气 + 专门负责领域」填写，例如：“你是我的资深产品合伙人，说话直接干练不绕弯子，专门帮我拆解竞品、打磨 PRD 文档与复盘周报。”",
      },
      {
        title: "第四步：一键套用底部「灵感模板」",
        detail:
          "如果暂时没想好怎么写，直接点击页面底部的「收件箱助手 / 行程规划师 / 写作搭档 / 学习教练」等预设卡片，即可自动填入成熟人设并在此基础上微调。",
      },
    ],
    tips: [
      "创建完成后，你依然可以随时在右侧「星友设定 → 名称 / 角色身份」中修改它的称呼与职责说明，失焦自动保存。",
    ],
  },
  {
    id: "chat-skills",
    group: "核心交互",
    badge: "03",
    navTitle: "跟 AI 聊天与批量删记录",
    title: "高效跟星友聊天、调取技能与清理记录",
    subtitle: "掌握多模态输入、技能点名调用与 Shift 连选批量删除，让聊天框成为你的全能指挥台。",
    icon: MessageSquare,
    steps: [
      {
        title: "发消息、传文件与语音输入",
        detail:
          "点击输入框左侧「+」或直接拖拽图片、PDF、Excel、代码文件到聊天窗口即可让星友精读处理；点击右侧麦克风按钮支持语音转文字及实时语音对话。",
      },
      {
        title: "在输入框点名调用「技能」与「应用」",
        detail:
          "在聊天框输入「/」或点击「+ → 技能」可插入已安装的技能胶囊（如 superpowers、frontend-design、xlsx），让星友严格按专业工作流执行任务。",
      },
      {
        title: "气泡快捷复制、中英文语音朗读与引用",
        detail:
          "星友回复气泡正下方常驻「😊 表情回应」「↩ 引用」「📋 一键复制」快捷按钮；右键点击星友消息还可直接选择「朗读」，调用本机自然语音流畅朗读中英文回复。",
      },
      {
        title: "微信式单条转发、逐条转发、合并转发与批量删除",
        detail:
          "右键任意消息可点击「转发」一键发给其他星友协作；也可点击「多选 / 批量删除」（支持按住 Shift 连选整段对话），通过底部工具栏选择「逐条转发」「合并转发聊天记录」给其他星友，或一键批量删除！",
      },
    ],
    tips: [
      "进入批量选择模式后，按键盘 Esc 键可随时退出选择；也可以点击底部工具栏的「全选当前页」快速清理。",
    ],
  },
  {
    id: "inspector-tune",
    group: "核心交互",
    badge: "04",
    navTitle: "调教性格、记忆与提醒",
    title: "右侧「星友设定」深度调教指南",
    subtitle: "赋予每只星友鲜明的性格脾气、持久记忆力与贴心的主动待办跟进能力。",
    icon: PanelRight,
    steps: [
      {
        title: "三大核心性格风格一键切换",
        detail:
          "在右侧「核心 → 对话风格」中，告别枯燥的系统预设，直接为当前星友切换「温柔（细腻治愈）」、「毒舌（犀利傲娇一针见血）」或「热血（元气激励干劲十足）」三种性格，下一句回复立刻生效！",
      },
      {
        title: "管理长期记忆（越聊越懂你）",
        detail:
          "点击「记忆」可开启自动提炼偏好，也能手动输入你希望它永久记住的背景信息（如你的职业、写作禁忌、常用目录），随时查看或删除单条记忆。",
      },
      {
        title: "主动关怀与自定义闲置待办提醒",
        detail:
          "打开「主动关怀与提醒」：开启「未完成任务主动提醒」后，可自由输入闲置时长并选择「小时」或「分钟」（默认按小时计，如闲置 2 小时）。当聊天中有未收尾事项或意外中断时，星友会主动找你跟进。",
      },
      {
        title: "自定义每日陪伴问候时段",
        detail:
          "在同一面板下可选择「每天 1 / 2 / 3 次」陪伴问候，并自由设定任意时刻（如 09:00、12:30、21:00），到点时星友会结合近期未闭环待办自然打招呼。",
      },
    ],
    tips: [
      "每只星友的性格风格、记忆库与提醒时长都是完全独立的——你可以养一只温柔的生活管家，再养一只毒舌的代码审查官！",
    ],
  },
  {
    id: "models-api",
    group: "扩展与管理",
    badge: "05",
    navTitle: "模型中心与 API 接入",
    title: "连接本机主流 Agent 与第三方 API",
    subtitle: "既能复用你电脑上已登录的 CLI 编程助手，也能三行极简接入任意兼容 OpenAI / Anthropic 的 API。",
    icon: Cpu,
    steps: [
      {
        title: "一键扫描并连接本机主流 Agent",
        detail:
          "点击左下角模型图标打开「星友空间 → 模型中心」，自动识别本机 Codex (ChatGPT)、Claude、Gemini、Grok、WorkBuddy、OpenClaw、Kimi 等 Agent，点击「连接」即可自动拉起浏览器或终端完成官方登录。",
      },
      {
        title: "极简接入第三方 API 服务商",
        detail:
          "点击模型中心顶部的「第三方 API（自定义厂商）」，普通用户只需填入「API 地址（Base URL）」与「API 密钥」，选择兼容格式（OpenAI 或 Anthropic），无需折腾请求头或上下文参数即可立即对话。",
      },
      {
        title: "随时手动切换单个星友的模型",
        detail:
          "无论是新建星友时，还是在聊天右侧「星友设定 → 模型」胶囊中，都可以随时为不同星友指定最擅长该领域的模型与推理档位。",
      },
    ],
    tips: [
      "若 WorkBuddy 或其他 Agent 点击连接后弹出浏览器登录页，完成扫码/授权后回到星友会自动变为绿灯「已连接」。",
    ],
  },
  {
    id: "marketplace",
    group: "扩展与管理",
    badge: "06",
    navTitle: "星友市集：应用与技能",
    title: "打通飞书 / 即梦 AI 等应用与 GitHub 技能",
    subtitle: "不造劣质轮子——直接连接国内外主流办公创作生态，一键搬运 GitHub 数十万星标验证过的顶级技能。",
    icon: Puzzle,
    steps: [
      {
        title: "应用连接：CLI 自动脚本与网页一键授权",
        detail:
          "打开左下角「星友市集 → 应用连接」：国内精选飞书、即梦 AI、钉钉、企业微信、腾讯文档、WPS 金山文档、滴答清单与 Mac 原生全家桶；海外精选 GitHub、Notion、Gmail、Figma、Canva、Linear 与 Vercel。点击「连接」即自动运行官方 CLI 授权脚本或拉起浏览器登录，无需手填繁琐 AppID/Secret。",
      },
      {
        title: "技能管理：精选 GitHub 顶级高星开源技能",
        detail:
          "切换到「技能管理」，内置 superpowers（★326k）、anthropics/skills 官方全套（skill-creator、frontend-design、pdf、xlsx、docx、pptx · ★200k）、impeccable（★116k）与 find-skills（★40k），全部采用中英双语标题并附完整中文译本。",
      },
      {
        title: "粘贴 GitHub 链接或上传本地技能包",
        detail:
          "在技能搜索框直接粘贴任意 GitHub 技能仓库链接即可实时解析安装；点击右上角「+ 添加技能」还能通过查找、拖拽上传 .zip/文件夹或让星友帮你创作专属技能。",
      },
    ],
    tips: [
      "点击任意技能卡片即可预览完整中文导读与原版英文指令，点击「+ 添加」即可勾选要分配给哪几只星友。",
    ],
  },
  {
    id: "schedule-usage",
    group: "扩展与管理",
    badge: "07",
    navTitle: "日程大月历与算力看板",
    title: "可视化管理定时日程与算力消耗",
    subtitle: "让自动化任务排期与 Token 成本开销清晰透明、尽在掌握。",
    icon: CalendarClock,
    steps: [
      {
        title: "大月历视图管理全部定时任务",
        detail:
          "打开左侧「日程」，在大日历表中直观看到每只星友每天的自动任务排期。直接点击任意日期格即可为指定星友新建定时任务（如每日早报、竞品监控、晚间复盘），点击已有胶囊可随时启停、编辑或删除。",
      },
      {
        title: "总体与单星友算力消耗看板",
        detail:
          "打开左侧「算力看板」（图标似柱状图），顶部支持切换「全部星友总览」或筛选任意「单个星友」，清晰查看近 30 天每日 Token 趋势柱状图、预估 API 花费、对话轮次以及具体调用的驱动模型占比。",
      },
    ],
    tips: [
      "在右侧「星友设定 → 用量」中也可以快速瞥一眼当前星友近 30 天的消耗摘要，并一键跳转全屏看板。",
    ],
  },
];

export function StarBotGuideModal(props: {
  open: boolean;
  onClose: () => void;
  onStartTour: () => void;
  onOpenFeedback: () => void;
}) {
  const [activeId, setActiveId] = createSignal<string>(GUIDE_SECTIONS[0]!.id);
  const [searchQuery, setSearchQuery] = createSignal("");

  const filteredSections = createMemo(() => {
    const q = searchQuery().trim().toLowerCase();
    if (!q) return GUIDE_SECTIONS;
    return GUIDE_SECTIONS.filter((sec) => {
      const hay = [
        sec.navTitle,
        sec.title,
        sec.subtitle,
        ...sec.steps.flatMap((s) => [s.title, s.detail]),
        ...sec.tips,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  });

  const groupedNav = createMemo(() => {
    const groups: { name: string; items: GuideSection[] }[] = [];
    for (const sec of filteredSections()) {
      let g = groups.find((x) => x.name === sec.group);
      if (!g) {
        g = { name: sec.group, items: [] };
        groups.push(g);
      }
      g.items.push(sec);
    }
    return groups;
  });

  const currentSection = createMemo(() => {
    const list = filteredSections();
    return list.find((s) => s.id === activeId()) ?? list[0] ?? GUIDE_SECTIONS[0]!;
  });

  const currentIndex = createMemo(() => {
    const list = filteredSections();
    const idx = list.findIndex((s) => s.id === currentSection().id);
    return idx >= 0 ? idx : 0;
  });

  let contentScrollEl: HTMLDivElement | undefined;

  function selectSection(id: string): void {
    setActiveId(id);
    if (contentScrollEl) contentScrollEl.scrollTop = 0;
  }

  return (
    <Show when={props.open}>
      <Portal>
        <div class="starbot-help-backdrop window-no-drag" onClick={() => props.onClose()}>
          <section
            class="starbot-help-dialog starbot-guide-manual-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="星友完整使用指南"
            onClick={(e) => e.stopPropagation()}
          >
            <header class="starbot-help-head">
              <div class="starbot-help-brand">
                <AgentAvatar agent={GUIDE_MASCOT} motion="always" class="starbot-help-mascot" />
                <div>
                  <h2>星友 · 完整使用手册</h2>
                  <p>左侧选择功能目录，查看从创建星友、对话技巧到应用技能打通的分步详解</p>
                </div>
              </div>
              <button type="button" class="starbot-help-close" aria-label="关闭" onClick={() => props.onClose()}>
                <X class="size-4" />
              </button>
            </header>

            <div class="starbot-manual-body">
              {/* Left Table of Contents Sidebar */}
              <aside class="starbot-manual-toc" aria-label="使用指南目录">
                <div class="starbot-manual-search-box">
                  <Search class="size-3.5 starbot-manual-search-icon" aria-hidden="true" />
                  <input
                    type="search"
                    class="starbot-manual-search-input"
                    placeholder="搜索功能说明…"
                    value={searchQuery()}
                    onInput={(e) => setSearchQuery(e.currentTarget.value)}
                  />
                </div>

                <div class="starbot-manual-toc-scroll">
                  <Show
                    when={groupedNav().length > 0}
                    fallback={<div class="starbot-manual-toc-empty">未找到匹配章节</div>}
                  >
                    <For each={groupedNav()}>
                      {(group) => (
                        <div class="starbot-manual-toc-group">
                          <span class="starbot-manual-toc-group-label">{group.name}</span>
                          <For each={group.items}>
                            {(item) => {
                              const Icon = item.icon;
                              const active = () => currentSection().id === item.id;
                              return (
                                <button
                                  type="button"
                                  class={`starbot-manual-toc-item${active() ? " is-active" : ""}`}
                                  onClick={() => selectSection(item.id)}
                                >
                                  <span class="starbot-manual-toc-num">{item.badge}</span>
                                  <Icon class="size-3.5 starbot-manual-toc-icon" aria-hidden="true" />
                                  <span class="starbot-manual-toc-text">{item.navTitle}</span>
                                </button>
                              );
                            }}
                          </For>
                        </div>
                      )}
                    </For>
                  </Show>
                </div>
              </aside>

              {/* Right Detailed Step-by-Step Content */}
              <div class="starbot-manual-content" ref={(el) => (contentScrollEl = el)}>
                <div class="starbot-manual-article">
                  <div class="starbot-manual-article-head">
                    <span class="starbot-manual-chapter-pill">
                      章节 {currentSection().badge} · {currentSection().group}
                    </span>
                    <h3>{currentSection().title}</h3>
                    <p>{currentSection().subtitle}</p>
                  </div>

                  <div class="starbot-manual-steps">
                    <For each={currentSection().steps}>
                      {(step, idx) => (
                        <article class="starbot-manual-step-card">
                          <div class="starbot-manual-step-index">{idx() + 1}</div>
                          <div class="starbot-manual-step-body">
                            <h4>{step.title}</h4>
                            <p>{step.detail}</p>
                          </div>
                        </article>
                      )}
                    </For>
                  </div>

                  <Show when={currentSection().tips.length > 0}>
                    <div class="starbot-manual-tips-box">
                      <strong>✦ 实用小贴士</strong>
                      <ul>
                        <For each={currentSection().tips}>{(tip) => <li>{tip}</li>}</For>
                      </ul>
                    </div>
                  </Show>

                  <div class="starbot-manual-pager">
                    <button
                      type="button"
                      class="starbot-manual-pager-btn"
                      disabled={currentIndex() <= 0}
                      onClick={() => {
                        const prev = filteredSections()[currentIndex() - 1];
                        if (prev) selectSection(prev.id);
                      }}
                    >
                      <ChevronLeft class="size-4" aria-hidden="true" />
                      <span>
                        {currentIndex() > 0 ? `上一节：${filteredSections()[currentIndex() - 1]!.navTitle}` : "已是第一节"}
                      </span>
                    </button>

                    <button
                      type="button"
                      class="starbot-manual-pager-btn is-next"
                      disabled={currentIndex() >= filteredSections().length - 1}
                      onClick={() => {
                        const next = filteredSections()[currentIndex() + 1];
                        if (next) selectSection(next.id);
                      }}
                    >
                      <span>
                        {currentIndex() < filteredSections().length - 1
                          ? `下一节：${filteredSections()[currentIndex() + 1]!.navTitle}`
                          : "已读完全部章节"}
                      </span>
                      <ChevronRight class="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <footer class="starbot-help-foot">
              <div class="starbot-help-foot-left">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    props.onClose();
                    props.onStartTour();
                  }}
                >
                  <Sparkles class="size-3.5" aria-hidden="true" />
                  核心玩法动态演示
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    props.onClose();
                    props.onOpenFeedback();
                  }}
                >
                  <Megaphone class="size-3.5" aria-hidden="true" />
                  发送反馈建议
                </Button>
              </div>
              <Button type="button" size="sm" onClick={() => props.onClose()}>
                开始使用星友
              </Button>
            </footer>
          </section>
        </div>
      </Portal>
    </Show>
  );
}

export function StarBotFeedbackModal(props: { open: boolean; onClose: () => void }) {
  const [category, setCategory] = createSignal<FeedbackCategory>("suggestion");
  const [content, setContent] = createSignal("");
  const [contact, setContact] = createSignal("");
  const [submitted, setSubmitted] = createSignal(false);

  function resetAndClose(): void {
    setSubmitted(false);
    setContent("");
    setContact("");
    setCategory("suggestion");
    props.onClose();
  }

  function handleSubmit(e: SubmitEvent): void {
    e.preventDefault();
    const text = content().trim();
    if (!text) {
      actionToast.warning("请先写下你的反馈或建议内容");
      return;
    }
    try {
      const existing = JSON.parse(window.localStorage.getItem(FEEDBACK_STORAGE_KEY) ?? "[]");
      const list = Array.isArray(existing) ? existing : [];
      list.unshift({
        id: `${Date.now()}`,
        category: category(),
        content: text,
        contact: contact().trim(),
        createdAt: new Date().toISOString(),
      });
      window.localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(list.slice(0, 50)));
    } catch {}
    setSubmitted(true);
    actionToast.success("反馈已收到，感谢帮星友变得更好！");
  }

  return (
    <Show when={props.open}>
      <Portal>
        <div class="starbot-help-backdrop window-no-drag" onClick={resetAndClose}>
          <section
            class="starbot-help-dialog starbot-feedback-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="发送反馈建议"
            onClick={(e) => e.stopPropagation()}
          >
            <header class="starbot-help-head">
              <div class="starbot-help-brand">
                <AgentAvatar agent={FEEDBACK_MASCOT} motion="always" class="starbot-help-mascot" />
                <div>
                  <h2>发送反馈建议</h2>
                  <p>你的每一条想法都会直接帮助星友进化</p>
                </div>
              </div>
              <button type="button" class="starbot-help-close" aria-label="关闭" onClick={resetAndClose}>
                <X class="size-4" />
              </button>
            </header>

            <Show
              when={!submitted()}
              fallback={
                <div class="starbot-feedback-thanks">
                  <div class="starbot-feedback-thanks-check">
                    <Check class="size-5" />
                  </div>
                  <h3>已收到你的宝贵建议！</h3>
                  <p>感谢你的用心反馈，我们会持续打磨星友的每一处细节。</p>
                  <Button type="button" size="sm" onClick={resetAndClose}>
                    完成
                  </Button>
                </div>
              }
            >
              <form class="starbot-feedback-form" onSubmit={handleSubmit}>
                <div class="starbot-feedback-field">
                  <label class="starbot-feedback-label">反馈类型</label>
                  <div class="starbot-feedback-pills">
                    <For each={FEEDBACK_CATEGORIES}>
                      {(cat) => (
                        <button
                          type="button"
                          class={`starbot-feedback-pill${category() === cat.id ? " is-active" : ""}`}
                          onClick={() => setCategory(cat.id)}
                        >
                          {cat.label}
                        </button>
                      )}
                    </For>
                  </div>
                </div>

                <div class="starbot-feedback-field">
                  <label class="starbot-feedback-label">你的建议或遇到的问题</label>
                  <Textarea
                    rows={4}
                    maxlength={1000}
                    placeholder="希望增加什么新能力？或者哪里用起来不够顺手？欢迎畅所欲言…"
                    value={content()}
                    onValueChange={setContent}
                  />
                </div>

                <div class="starbot-feedback-field">
                  <label class="starbot-feedback-label">联系方式（选填）</label>
                  <Input
                    placeholder="微信号或邮箱，方便我们与你交流"
                    maxlength={120}
                    value={contact()}
                    onValueChange={setContact}
                  />
                </div>

                <footer class="starbot-help-foot starbot-feedback-foot">
                  <span class="starbot-feedback-count">{content().trim().length} / 1000</span>
                  <div class="starbot-help-foot-right">
                    <Button type="button" variant="outline" size="sm" onClick={resetAndClose}>
                      取消
                    </Button>
                    <Button type="submit" size="sm">
                      提交反馈
                    </Button>
                  </div>
                </footer>
              </form>
            </Show>
          </section>
        </div>
      </Portal>
    </Show>
  );
}

export function StarBotFeatureTourModal(props: {
  open: boolean;
  onClose: () => void;
  onOpenGuides: () => void;
  onOpenAvatarSetup: () => void;
}) {
  const [step, setStep] = createSignal(0);

  const slides = [
    {
      anim: tourQuickAskAnim,
      title: "划选文字，按 Shift + Space 随手问",
      desc: "跨页面一键唤起悬浮窗，直接向星友提问或存入长期记忆。",
    },
    {
      anim: tourForwardAnim,
      title: "多选聊天记录，一键合并转发",
      desc: "像微信一样勾选多条对话，逐条或合并转发给另一只星友接力。",
    },
    {
      anim: tourCompanionAnim,
      title: "戳一戳软陶星友，随心切换性格",
      desc: "轻触或点击触发专属软萌音效，支持温柔、毒舌、热血三种性格。",
    },
  ] as const;

  return (
    <Show when={props.open}>
      <Portal>
        <div class="starbot-help-backdrop window-no-drag" onClick={() => props.onClose()}>
          <section
            class="starbot-help-dialog starbot-tour-showcase-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="星友新手指引"
            onClick={(e) => e.stopPropagation()}
          >
            <div class="starbot-tour-video-hero">
              <button
                type="button"
                class="starbot-tour-floating-close"
                aria-label="关闭"
                onClick={() => props.onClose()}
              >
                <X class="size-4" />
              </button>
              <For each={slides}>
                {(slide, idx) => (
                  <Show when={step() === idx()}>
                    <img
                      class="starbot-tour-video"
                      src={slide.anim}
                      alt={slide.title}
                      draggable={false}
                    />
                  </Show>
                )}
              </For>
            </div>

            <div class="starbot-tour-minimal-body">
              <div class="starbot-tour-minimal-copy">
                <h3>{slides[step()]!.title}</h3>
                <p>{slides[step()]!.desc}</p>
              </div>

              <div class="starbot-tour-minimal-footer">
                <button
                  type="button"
                  class="starbot-tour-skip-link"
                  onClick={() => props.onClose()}
                >
                  跳过引导
                </button>

                <div class="starbot-tour-dots" role="tablist" aria-label="引导步骤">
                  <For each={slides}>
                    {(_, idx) => (
                      <button
                        type="button"
                        class={`starbot-tour-dot${step() === idx() ? " is-active" : ""}`}
                        aria-label={`第 ${idx() + 1} 步`}
                        onClick={() => {
                          void playKawaiiCue("toggle-on");
                          setStep(idx());
                        }}
                      />
                    )}
                  </For>
                </div>

                <div class="starbot-tour-nav-btns">
                  <Show when={step() > 0}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setStep((s) => Math.max(0, s - 1))}
                    >
                      上一步
                    </Button>
                  </Show>
                  <Show
                    when={step() < slides.length - 1}
                    fallback={
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          void playKawaiiCue("success");
                          props.onClose();
                        }}
                      >
                        开始体验
                      </Button>
                    }
                  >
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        void playKawaiiCue("toggle-on");
                        setStep((s) => Math.min(slides.length - 1, s + 1));
                      }}
                    >
                      下一步
                    </Button>
                  </Show>
                </div>
              </div>
            </div>
          </section>
        </div>
      </Portal>
    </Show>
  );
}
