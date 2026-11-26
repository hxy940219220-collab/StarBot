import { INPUT_LIMITS } from "@openbot/contracts/input-limits";
import type { RoutineCalendar as HostCalendar, RoutineSchedule } from "@openbot/contracts/ipc";
import {
  addCalendarDays,
  addCalendarMonths,
  type CalendarDay,
  calendarDayDate,
  calendarDayOf,
  calendarDays,
  calendarMonthStart,
  calendarWeekStart,
} from "@openbot/team-client/routine-calendar-dates";
import {
  ROUTINE_EVERY_DAY,
  ROUTINE_WORKDAYS,
  type RoutineScheduleDraft,
  sameRoutineDays,
} from "@openbot/team-client/routine-schedule-draft";
import { Button, ChevronLeft, ChevronRight, Clock3, Input, Plus, Switch, Textarea, Trash2, X } from "@openbot/ui";
import type { AgentProfile } from "@openbot/ui/data";
import { AgentAvatar } from "@openbot/ui/features/agents/AgentAvatar";
import {
  routineScheduleFromDraft,
  routineScheduleToDraft,
} from "@openbot/ui/features/conversation/routine-schedule-saved";
import { Portal } from "@solidjs/web";
import { createEffect, createMemo, createSignal, For, onCleanup, onSettled, Show } from "solid-js";
import { actionToast } from "../../action-toast";
import { isEventRoutine, routineScheduleOf } from "../conversation/routine-summary";
import type { RoutineEditorRecord, RoutinesPort } from "../conversation/routines-port";
import type { ScheduleSource } from "./schedule-port";

const DAY_MS = 86_400_000;
const MONTHS_BEFORE = 4;
const MONTHS_AFTER = 10;
const WEEKDAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"] as const;
const JS_WEEKDAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"] as const;

type RepeatMode = "daily" | "workdays" | "weekly" | "once" | "keep";

interface AgentRoutineItem {
  agentId: string;
  agent: AgentProfile;
  routine: RoutineEditorRecord;
  draft: RoutineScheduleDraft;
}

interface DayOccurrence {
  key: string;
  day: CalendarDay;
  time: string;
  item: AgentRoutineItem;
}

interface MonthBlock {
  monthStart: CalendarDay;
  label: string;
  days: CalendarDay[];
  rows: number;
}

type ModalState =
  | {
      mode: "create";
      day: CalendarDay;
    }
  | {
      mode: "edit";
      day: CalendarDay;
      item: AgentRoutineItem;
    };

function shortTaskTitle(name: string, maxChars = 6): string {
  const clean = name.trim();
  const chars = Array.from(clean);
  if (chars.length <= maxChars) return clean;
  return `${chars.slice(0, maxChars).join("")}…`;
}

function parseDayParts(day: CalendarDay): { year: number; month: number; date: number; jsWeekday: number } {
  const dt = calendarDayDate(day);
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    date: dt.getUTCDate(),
    jsWeekday: dt.getUTCDay(),
  };
}

function formatMonthHeading(anchor: CalendarDay): string {
  const { year, month } = parseDayParts(anchor);
  return `${year}年 ${month}月`;
}

function formatDayReadable(day: CalendarDay): string {
  const { month, date, jsWeekday } = parseDayParts(day);
  return `${month}月${date}日 · ${JS_WEEKDAY_NAMES[jsWeekday] ?? ""}`;
}

function buildMonthDays(monthStart: CalendarDay): CalendarDay[] {
  const start = calendarMonthStart(monthStart);
  const nextMonth = addCalendarMonths(start, 1);
  const result: CalendarDay[] = [];
  for (let week = calendarWeekStart(start, 1); week < nextMonth; ) {
    result.push(...calendarDays(week, 7));
    week = addCalendarDays(week, 7);
    if (result.length >= 42) break;
  }
  return result;
}

function projectItemTimesOnDay(
  item: AgentRoutineItem,
  day: CalendarDay,
  backendRunsByRoutineDay: ReadonlyMap<string, readonly string[]>,
): string[] {
  const d = item.draft;
  const { month, date, jsWeekday } = parseDayParts(day);
  if (d.kind === "once") {
    return d.date === day ? [d.time] : [];
  }
  if (d.kind === "daily") {
    return d.days.includes(jsWeekday) ? [d.time] : [];
  }
  if (d.kind === "weekly") {
    return d.weekday === jsWeekday ? [d.time] : [];
  }
  if (d.kind === "monthly") {
    return d.day === date ? [d.time] : [];
  }
  if (d.kind === "yearly") {
    return d.month === month && d.day === date ? [d.time] : [];
  }
  if (d.kind === "hourly") {
    if (!d.days.includes(jsWeekday)) return [];
    const start = d.window?.start ?? "09:00";
    return [start];
  }
  const fromBackend = backendRunsByRoutineDay.get(`${item.routine.id}@${day}`);
  return fromBackend ? [...fromBackend] : [];
}

function repeatModeFromDraft(draft: RoutineScheduleDraft): RepeatMode {
  if (draft.kind === "once") return "once";
  if (draft.kind === "weekly") return "weekly";
  if (draft.kind === "daily") {
    if (sameRoutineDays(draft.days, ROUTINE_EVERY_DAY)) return "daily";
    if (sameRoutineDays(draft.days, ROUTINE_WORKDAYS)) return "workdays";
  }
  return "keep";
}

function buildScheduleFromModal(
  mode: RepeatMode,
  time: string,
  date: CalendarDay,
  weekday: number,
  originalSchedule?: RoutineSchedule,
): RoutineSchedule {
  const safeTime = /^\d{2}:\d{2}$/u.test(time) ? time : "09:00";
  if (mode === "once") {
    return routineScheduleFromDraft({ kind: "once", date, time: safeTime });
  }
  if (mode === "workdays") {
    return routineScheduleFromDraft({ kind: "daily", days: [...ROUTINE_WORKDAYS], time: safeTime });
  }
  if (mode === "weekly") {
    return routineScheduleFromDraft({ kind: "weekly", weekday, time: safeTime });
  }
  if (mode === "keep" && originalSchedule) {
    return originalSchedule;
  }
  return routineScheduleFromDraft({ kind: "daily", days: [...ROUTINE_EVERY_DAY], time: safeTime });
}

export interface StarBotScheduleCalendarProps {
  serverId: string;
  agents: readonly AgentProfile[];
  source: ScheduleSource;
  routinePorts?: ((agentId: string) => RoutinesPort) | undefined;
}

export function StarBotScheduleCalendar(props: StarBotScheduleCalendarProps) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const [now, setNow] = createSignal(new Date());
  const today = () => calendarDayOf(now(), timeZone);
  const initialMonth = calendarMonthStart(today());

  const [windowCenter, setWindowCenter] = createSignal<CalendarDay>(initialMonth);
  const [visibleMonth, setVisibleMonth] = createSignal<CalendarDay>(initialMonth);
  const [agentRoutines, setAgentRoutines] = createSignal<AgentRoutineItem[]>([]);
  const [hostCalendar, setHostCalendar] = createSignal<HostCalendar | null>(null);
  const [loading, setLoading] = createSignal(true);

  const [modal, setModal] = createSignal<ModalState | null>(null);
  const [expandedDay, setExpandedDay] = createSignal<CalendarDay | null>(null);

  const [formAgentId, setFormAgentId] = createSignal("");
  const [formName, setFormName] = createSignal("");
  const [formInstruction, setFormInstruction] = createSignal("");
  const [formActive, setFormActive] = createSignal(true);
  const [formRepeat, setFormRepeat] = createSignal<RepeatMode>("daily");
  const [formTime, setFormTime] = createSignal("09:00");
  const [formDate, setFormDate] = createSignal<CalendarDay>(today());
  const [formWeekday, setFormWeekday] = createSignal<number>(1);
  const [saving, setSaving] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);
  const [confirmDelete, setConfirmDelete] = createSignal(false);

  let scrollContainerEl: HTMLDivElement | undefined;
  let scrollSyncRaf: number | null = null;
  let programmaticScrollUntil = 0;

  // 15 consecutive months rendered in one smooth vertical scroll stream
  const monthBlocks = createMemo<MonthBlock[]>(() => {
    const center = calendarMonthStart(windowCenter());
    const blocks: MonthBlock[] = [];
    for (let offset = -MONTHS_BEFORE; offset <= MONTHS_AFTER; offset++) {
      const mStart = addCalendarMonths(center, offset);
      const days = buildMonthDays(mStart);
      blocks.push({
        monthStart: mStart,
        label: formatMonthHeading(mStart),
        days,
        rows: Math.ceil(days.length / 7),
      });
    }
    return blocks;
  });

  const allUniqueDays = createMemo(() => {
    const set = new Set<CalendarDay>();
    for (const block of monthBlocks()) {
      for (const d of block.days) set.add(d);
    }
    return [...set];
  });

  function scrollToMonth(targetMonth: CalendarDay, behavior: ScrollBehavior = "smooth"): void {
    const normalized = calendarMonthStart(targetMonth);
    const blocks = monthBlocks();
    const first = blocks[0]?.monthStart;
    const last = blocks.at(-1)?.monthStart;
    if (!first || !last || normalized < first || normalized > last) {
      setWindowCenter(normalized);
      setVisibleMonth(normalized);
      requestAnimationFrame(() => {
        const el = scrollContainerEl?.querySelector<HTMLElement>(`[data-month-start="${normalized}"]`);
        if (el && scrollContainerEl) {
          programmaticScrollUntil = performance.now() + 450;
          scrollContainerEl.scrollTo({ top: Math.max(0, el.offsetTop - 8), behavior: "auto" });
        }
      });
      return;
    }
    setVisibleMonth(normalized);
    const el = scrollContainerEl?.querySelector<HTMLElement>(`[data-month-start="${normalized}"]`);
    if (el && scrollContainerEl) {
      programmaticScrollUntil = performance.now() + (behavior === "smooth" ? 520 : 120);
      scrollContainerEl.scrollTo({ top: Math.max(0, el.offsetTop - 8), behavior });
    }
  }

  onSettled(() => {
    requestAnimationFrame(() => {
      scrollToMonth(calendarMonthStart(today()), "auto");
    });
    onCleanup(() => {
      if (scrollSyncRaf !== null) cancelAnimationFrame(scrollSyncRaf);
    });
  });

  function handleScroll(): void {
    if (performance.now() < programmaticScrollUntil) return;
    if (scrollSyncRaf !== null) return;
    scrollSyncRaf = requestAnimationFrame(() => {
      scrollSyncRaf = null;
      const container = scrollContainerEl;
      if (!container) return;
      const probeY = container.scrollTop + 96;
      const sections = container.querySelectorAll<HTMLElement>("[data-month-start]");
      let active: CalendarDay | null = null;
      for (const sec of sections) {
        if (sec.offsetTop <= probeY) {
          active = (sec.dataset.monthStart as CalendarDay | undefined) ?? active;
        } else {
          break;
        }
      }
      if (active && active !== visibleMonth()) {
        setVisibleMonth(active);
      }
    });
  }

  // Gentle damped wheel handler so scrolling feels silky and never overshoots too fast
  function handleGentleWheel(e: WheelEvent & { currentTarget: HTMLDivElement }): void {
    if (e.ctrlKey || e.metaKey) return;
    const container = e.currentTarget;
    if (Math.abs(e.deltaY) < 0.5) return;
    e.preventDefault();
    const rawPx = e.deltaMode === 1 ? e.deltaY * 22 : e.deltaMode === 2 ? e.deltaY * 240 : e.deltaY;
    const damped = Math.max(-64, Math.min(64, rawPx * 0.48));
    container.scrollTop += damped;
  }

  let loadSeq = 0;
  async function reloadAll(silent = false): Promise<void> {
    const seq = ++loadSeq;
    if (!silent) setLoading(true);
    const ports = props.routinePorts;
    const currentAgents = [...props.agents];
    const blocks = monthBlocks();
    const first = blocks[0]?.days[0] ?? windowCenter();
    const last = blocks.at(-1)?.days.at(-1) ?? windowCenter();
    const fromIso = new Date(calendarDayDate(first).getTime() - DAY_MS).toISOString();
    const toIso = new Date(calendarDayDate(last).getTime() + 2 * DAY_MS).toISOString();

    try {
      const [cal, perAgentLists] = await Promise.all([
        props.source.calendar({ from: fromIso, to: toIso }, props.serverId).catch(() => null),
        ports
          ? Promise.all(
              currentAgents.map(async (agent) => {
                try {
                  const list = await ports(agent.id).list();
                  return list
                    .filter((r) => !(isEventRoutine(r) && r.trigger.kind === "webhook"))
                    .map(
                      (routine): AgentRoutineItem => ({
                        agentId: agent.id,
                        agent,
                        routine,
                        draft: routineScheduleToDraft(routineScheduleOf(routine)),
                      }),
                    );
                } catch {
                  return [];
                }
              }),
            )
          : Promise.resolve([]),
      ]);
      if (seq !== loadSeq) return;
      if (cal) setHostCalendar(cal);
      setAgentRoutines(perAgentLists.flat());
    } finally {
      if (seq === loadSeq) setLoading(false);
    }
  }

  createEffect(
    () => [props.serverId, windowCenter(), props.agents.length] as const,
    () => {
      void reloadAll(agentRoutines().length > 0);
    },
  );

  createEffect(
    () => props.serverId,
    (serverId) => {
      const unsub = props.source.onStale(serverId, () => void reloadAll(true));
      const clock = window.setInterval(() => setNow(new Date()), 60_000);
      onCleanup(() => {
        unsub();
        window.clearInterval(clock);
      });
    },
  );

  const backendRunsByRoutineDay = createMemo(() => {
    const map = new Map<string, string[]>();
    const cal = hostCalendar();
    if (!cal) return map;
    const fmt = new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone,
    });
    for (const run of cal.runs) {
      const dt = new Date(run.at);
      const day = calendarDayOf(dt, timeZone);
      const key = `${run.routineId}@${day}`;
      const tStr = fmt.format(dt);
      const list = map.get(key);
      if (list) {
        if (!list.includes(tStr)) list.push(tStr);
      } else {
        map.set(key, [tStr]);
      }
    }
    return map;
  });

  const occurrencesByDay = createMemo(() => {
    const byDay = new Map<CalendarDay, DayOccurrence[]>();
    const items = agentRoutines();
    const runsMap = backendRunsByRoutineDay();
    for (const day of allUniqueDays()) {
      const dayList: DayOccurrence[] = [];
      for (const item of items) {
        const times = projectItemTimesOnDay(item, day, runsMap);
        for (const time of times) {
          dayList.push({
            key: `${item.routine.id}@${day}@${time}`,
            day,
            time,
            item,
          });
        }
      }
      dayList.sort((a, b) => a.time.localeCompare(b.time) || a.item.routine.name.localeCompare(b.item.routine.name));
      byDay.set(day, dayList);
    }
    return byDay;
  });

  function openCreateModal(day: CalendarDay): void {
    if (!props.routinePorts) {
      actionToast.warning("本地日程服务正在准备中，请稍候再试");
      return;
    }
    if (props.agents.length === 0) {
      actionToast.warning("请先在「星友」页创建一个星友，再安排日程");
      return;
    }
    const { jsWeekday } = parseDayParts(day);
    setFormAgentId(props.agents[0]?.id ?? "");
    setFormName("");
    setFormInstruction("");
    setFormActive(true);
    setFormRepeat("once");
    setFormTime("09:00");
    setFormDate(day);
    setFormWeekday(jsWeekday);
    setConfirmDelete(false);
    setModal({ mode: "create", day });
  }

  function openEditModal(item: AgentRoutineItem, day: CalendarDay): void {
    const d = item.draft;
    const { jsWeekday } = parseDayParts(day);
    setFormAgentId(item.agentId);
    setFormName(item.routine.name);
    setFormInstruction(item.routine.instruction);
    setFormActive(item.routine.active);
    setFormRepeat(repeatModeFromDraft(d));
    setFormTime("time" in d ? d.time : "09:00");
    setFormDate(d.kind === "once" ? d.date : day);
    setFormWeekday(d.kind === "weekly" ? d.weekday : jsWeekday);
    setConfirmDelete(false);
    setModal({ mode: "edit", day, item });
  }

  function closeModal(): void {
    if (saving() || deleting()) return;
    setModal(null);
    setConfirmDelete(false);
  }

  async function submitModal(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const current = modal();
    const ports = props.routinePorts;
    if (!current || !ports || saving()) return;
    const name = formName().trim();
    const instruction = formInstruction().trim();
    if (!name || !instruction) {
      actionToast.warning("请填写任务名称和任务指令内容");
      return;
    }

    setSaving(true);
    try {
      const targetAgentId = current.mode === "edit" ? current.item.agentId : formAgentId();
      const port = ports(targetAgentId);
      const originalSchedule = current.mode === "edit" ? routineScheduleOf(current.item.routine) : undefined;
      const schedule = buildScheduleFromModal(formRepeat(), formTime(), formDate(), formWeekday(), originalSchedule);

      if (current.mode === "create") {
        await port.save({
          routineId: null,
          name,
          instruction,
          active: true,
          timezone: timeZone,
          schedule,
          trigger: { kind: "schedule", schedule },
          missedPolicy: formRepeat() === "once" ? "run-once" : "skip",
          limitPolicy: "wait",
        });
      } else {
        const prev = current.item.routine;
        await port.save({
          routineId: prev.id,
          name,
          instruction,
          active: formActive(),
          timezone: prev.timezone || timeZone,
          schedule,
          trigger: { kind: "schedule", schedule },
          ...(!isEventRoutine(prev)
            ? {
                limitPolicy: prev.limitPolicy,
                missedPolicy: prev.missedPolicy,
                runIn: prev.runIn,
              }
            : {}),
        });
      }
      setModal(null);
      await reloadAll(true);
    } catch {
      actionToast.error("保存定时任务失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRoutine(): Promise<void> {
    const current = modal();
    const ports = props.routinePorts;
    if (!current || current.mode !== "edit" || !ports || deleting()) return;
    setDeleting(true);
    try {
      await ports(current.item.agentId).remove(current.item.routine.id);
      setModal(null);
      setConfirmDelete(false);
      await reloadAll(true);
    } catch {
      actionToast.error("删除定时任务失败");
    } finally {
      setDeleting(false);
    }
  }

  const isCurrentMonthShown = () => calendarMonthStart(visibleMonth()) === calendarMonthStart(today());
  const monthInputValue = () => {
    const { year, month } = parseDayParts(visibleMonth());
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
  };

  return (
    <section class="starbot-schedule-page" aria-label="星友日程表">
      {/* Top Calendar Bar */}
      <header class="window-drag starbot-schedule-header">
        <div class="starbot-schedule-title-wrap window-no-drag">
          <label class="starbot-schedule-month-picker" title="点击快速定位年月">
            <span class="starbot-schedule-title">{formatMonthHeading(visibleMonth())}</span>
            <input
              type="month"
              class="starbot-schedule-month-input"
              aria-label="选择年月"
              value={monthInputValue()}
              onInput={(e) => {
                const raw = e.currentTarget.value;
                if (/^\d{4}-\d{2}$/u.test(raw)) {
                  scrollToMonth(`${raw}-01` as CalendarDay, "smooth");
                }
              }}
            />
          </label>
          <div class="starbot-schedule-nav">
            <button
              type="button"
              class="starbot-schedule-icon-btn"
              aria-label="平滑滚动至上个月"
              onClick={() => scrollToMonth(addCalendarMonths(visibleMonth(), -1), "smooth")}
            >
              <ChevronLeft class="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              class="starbot-schedule-today-btn"
              disabled={isCurrentMonthShown()}
              onClick={() => scrollToMonth(calendarMonthStart(today()), "smooth")}
            >
              今天
            </button>
            <button
              type="button"
              class="starbot-schedule-icon-btn"
              aria-label="平滑滚动至下个月"
              onClick={() => scrollToMonth(addCalendarMonths(visibleMonth(), 1), "smooth")}
            >
              <ChevronRight class="size-4" aria-hidden="true" />
            </button>
          </div>
          <span class="starbot-schedule-hint">上下滑动或拖动右侧滑条顺畅浏览 · 点击日期格新建任务</span>
        </div>

        <div class="starbot-schedule-actions window-no-drag">
          <span class="starbot-schedule-tz">{timeZone.replaceAll("_", " ")}</span>
          <Button type="button" size="sm" onClick={() => openCreateModal(today())}>
            <Plus class="size-4" aria-hidden="true" />
            新建定时任务
          </Button>
        </div>
      </header>

      {/* Fixed Weekday Header + Smooth Continuous Scrollable Multi-Month Stream */}
      <div class="starbot-schedule-board window-no-drag" data-loading={loading() ? "" : undefined}>
        <div class="starbot-schedule-weekdays" aria-hidden="true">
          <For each={WEEKDAY_LABELS}>{(label) => <div class="starbot-schedule-weekday">{label}</div>}</For>
        </div>

        <div
          ref={scrollContainerEl}
          class="starbot-schedule-scroll"
          onScroll={handleScroll}
          onWheel={handleGentleWheel}
        >
          <For each={monthBlocks()}>
            {(block) => (
              <section class="starbot-month-section" data-month-start={block.monthStart} aria-label={block.label}>
                <div class="starbot-month-sticky-banner">
                  <span class="starbot-month-sticky-pill">{block.label}</span>
                </div>
                <div class="starbot-schedule-grid" style={{ "--starbot-cal-rows": String(block.rows) }}>
                  <For each={block.days}>
                    {(day) => {
                      const items = () => occurrencesByDay().get(day) ?? [];
                      const visibleItems = () => items().slice(0, 3);
                      const hiddenCount = () => Math.max(0, items().length - 3);
                      const outside = () => calendarMonthStart(day) !== block.monthStart;
                      const isToday = () => day === today();
                      const dayNum = () => parseDayParts(day).date;
                      const monthNum = () => parseDayParts(day).month;

                      return (
                        <div
                          class={[
                            "starbot-cal-cell",
                            {
                              "is-outside": outside(),
                              "is-today": isToday(),
                            },
                          ]}
                          role="gridcell"
                          tabindex={0}
                          aria-label={`${formatDayReadable(day)}，点击新建定时任务`}
                          onClick={() => openCreateModal(day)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openCreateModal(day);
                            }
                          }}
                        >
                          <div class="starbot-cal-cell-head">
                            <span class="starbot-cal-day-num">
                              {dayNum() === 1 ? `${monthNum()}月1日` : `${dayNum()}日`}
                              <Show when={isToday()}> · 今天</Show>
                            </span>
                            <button
                              type="button"
                              class="starbot-cal-cell-add"
                              aria-label={`在 ${formatDayReadable(day)} 新建任务`}
                              title="在此日期新建任务"
                              onClick={(e) => {
                                e.stopPropagation();
                                openCreateModal(day);
                              }}
                            >
                              <Plus class="size-3.5" aria-hidden="true" />
                            </button>
                          </div>

                          <div class="starbot-cal-pills">
                            <For each={visibleItems()}>
                              {(occ) => (
                                <button
                                  type="button"
                                  class={`starbot-cal-pill${occ.item.routine.active ? "" : " is-paused"}`}
                                  title={`${occ.item.agent.name} · ${occ.time} · ${occ.item.routine.name}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditModal(occ.item, day);
                                  }}
                                >
                                  <AgentAvatar agent={occ.item.agent} motion="idle" class="starbot-cal-pill-avatar" />
                                  <span class="starbot-cal-pill-time">{occ.time}</span>
                                  <span class="starbot-cal-pill-title">{shortTaskTitle(occ.item.routine.name, 6)}</span>
                                </button>
                              )}
                            </For>
                            <Show when={hiddenCount() > 0}>
                              <button
                                type="button"
                                class="starbot-cal-more-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedDay(day);
                                }}
                              >
                                还有 {hiddenCount()} 项…
                              </button>
                            </Show>
                          </div>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </section>
            )}
          </For>
        </div>
      </div>

      {/* Day All-Tasks Popover Modal */}
      <Show when={expandedDay()}>
        {(day) => (
          <Portal>
            <div class="starbot-cal-modal-backdrop" onClick={() => setExpandedDay(null)}>
              <div class="starbot-cal-modal starbot-cal-day-modal" onClick={(e) => e.stopPropagation()}>
                <header class="starbot-cal-modal-head">
                  <h2>{formatDayReadable(day())} 的全部任务</h2>
                  <button type="button" class="starbot-cal-modal-close" onClick={() => setExpandedDay(null)}>
                    <X class="size-4" />
                  </button>
                </header>
                <div class="starbot-cal-day-modal-list">
                  <For each={occurrencesByDay().get(day()) ?? []}>
                    {(occ) => (
                      <button
                        type="button"
                        class={`starbot-cal-pill${occ.item.routine.active ? "" : " is-paused"}`}
                        onClick={() => {
                          const targetDay = day();
                          setExpandedDay(null);
                          openEditModal(occ.item, targetDay);
                        }}
                      >
                        <AgentAvatar agent={occ.item.agent} motion="idle" class="starbot-cal-pill-avatar" />
                        <span class="starbot-cal-pill-time">{occ.time}</span>
                        <span class="starbot-cal-pill-title">{occ.item.routine.name}</span>
                      </button>
                    )}
                  </For>
                </div>
                <div class="starbot-cal-modal-foot">
                  <div />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      const targetDay = day();
                      setExpandedDay(null);
                      openCreateModal(targetDay);
                    }}
                  >
                    <Plus class="size-4" />
                    在此日新建任务
                  </Button>
                </div>
              </div>
            </div>
          </Portal>
        )}
      </Show>

      {/* Task Detail / Edit / Delete / Create Modal */}
      <Show when={modal()}>
        {(current) => (
          <Portal>
            <div class="starbot-cal-modal-backdrop" onClick={closeModal}>
              <form
                class="starbot-cal-modal"
                role="dialog"
                aria-modal="true"
                aria-label={current().mode === "create" ? "新建定时任务" : "定时任务详情与编辑"}
                onClick={(e) => e.stopPropagation()}
                onSubmit={(e) => void submitModal(e)}
              >
                <header class="starbot-cal-modal-head">
                  <Show
                    when={current().mode === "edit" ? (current() as Extract<ModalState, { mode: "edit" }>).item : null}
                    fallback={<h2>新建定时任务 · {formatDayReadable(current().day)}</h2>}
                  >
                    {(editItem) => (
                      <div class="starbot-cal-modal-agent-head">
                        <AgentAvatar agent={editItem().agent} motion="always" class="starbot-cal-modal-avatar" />
                        <div>
                          <h2>{editItem().agent.name} 的定时任务</h2>
                          <small>{formActive() ? "已启用自动执行" : "已暂停"}</small>
                        </div>
                      </div>
                    )}
                  </Show>
                  <div class="starbot-cal-modal-head-right">
                    <Show when={current().mode === "edit"}>
                      <Switch
                        checked={formActive()}
                        aria-label="启用或暂停任务"
                        onChange={(checked) => setFormActive(checked)}
                      />
                    </Show>
                    <button type="button" class="starbot-cal-modal-close" aria-label="关闭" onClick={closeModal}>
                      <X class="size-4" />
                    </button>
                  </div>
                </header>

                <div class="starbot-cal-modal-body">
                  <Show when={current().mode === "create"}>
                    <div class="starbot-cal-field">
                      <label class="starbot-cal-label">选择执行星友</label>
                      <div class="starbot-cal-agent-chips">
                        <For each={props.agents}>
                          {(ag) => (
                            <button
                              type="button"
                              class={`starbot-cal-agent-chip${formAgentId() === ag.id ? " is-selected" : ""}`}
                              onClick={() => setFormAgentId(ag.id)}
                            >
                              <AgentAvatar agent={ag} motion="idle" class="starbot-cal-chip-avatar" />
                              <span>{ag.name}</span>
                            </button>
                          )}
                        </For>
                      </div>
                    </div>
                  </Show>

                  <div class="starbot-cal-field">
                    <label class="starbot-cal-label">任务名称</label>
                    <Input
                      value={formName()}
                      maxlength={INPUT_LIMITS.routineName}
                      placeholder="例如：早报整理、行业资讯速递"
                      disabled={saving() || deleting()}
                      onValueChange={setFormName}
                    />
                  </div>

                  <div class="starbot-cal-field-row">
                    <div class="starbot-cal-field">
                      <label class="starbot-cal-label">执行周期</label>
                      <div class="starbot-cal-repeat-pills">
                        <button
                          type="button"
                          class={`starbot-cal-repeat-pill${formRepeat() === "once" ? " is-active" : ""}`}
                          onClick={() => setFormRepeat("once")}
                        >
                          单次
                        </button>
                        <button
                          type="button"
                          class={`starbot-cal-repeat-pill${formRepeat() === "daily" ? " is-active" : ""}`}
                          onClick={() => setFormRepeat("daily")}
                        >
                          每天
                        </button>
                        <button
                          type="button"
                          class={`starbot-cal-repeat-pill${formRepeat() === "workdays" ? " is-active" : ""}`}
                          onClick={() => setFormRepeat("workdays")}
                        >
                          工作日
                        </button>
                        <button
                          type="button"
                          class={`starbot-cal-repeat-pill${formRepeat() === "weekly" ? " is-active" : ""}`}
                          onClick={() => setFormRepeat("weekly")}
                        >
                          每周
                        </button>
                      </div>
                    </div>

                    <div class="starbot-cal-field starbot-cal-time-field">
                      <label class="starbot-cal-label">
                        <Clock3 class="size-3.5" aria-hidden="true" />
                        执行时间
                      </label>
                      <input
                        type="time"
                        class="starbot-cal-time-input"
                        value={formTime()}
                        disabled={saving() || deleting() || formRepeat() === "keep"}
                        onInput={(e) => setFormTime(e.currentTarget.value)}
                      />
                    </div>
                  </div>

                  <Show when={formRepeat() === "once"}>
                    <div class="starbot-cal-field">
                      <label class="starbot-cal-label">执行日期</label>
                      <input
                        type="date"
                        class="starbot-cal-date-input"
                        value={formDate()}
                        disabled={saving() || deleting()}
                        onInput={(e) => {
                          if (e.currentTarget.value) setFormDate(e.currentTarget.value);
                        }}
                      />
                    </div>
                  </Show>

                  <Show when={formRepeat() === "weekly"}>
                    <div class="starbot-cal-field">
                      <label class="starbot-cal-label">星期几执行</label>
                      <div class="starbot-cal-weekday-pills">
                        <For each={[1, 2, 3, 4, 5, 6, 0]}>
                          {(wd) => (
                            <button
                              type="button"
                              class={`starbot-cal-repeat-pill${formWeekday() === wd ? " is-active" : ""}`}
                              onClick={() => setFormWeekday(wd)}
                            >
                              {JS_WEEKDAY_NAMES[wd]}
                            </button>
                          )}
                        </For>
                      </div>
                    </div>
                  </Show>

                  <div class="starbot-cal-field">
                    <label class="starbot-cal-label">任务内容 / 指令</label>
                    <Textarea
                      rows={4}
                      value={formInstruction()}
                      maxlength={INPUT_LIMITS.routineInstruction}
                      placeholder="详细写下到点后让星友帮你执行的事情…"
                      disabled={saving() || deleting()}
                      onValueChange={setFormInstruction}
                    />
                  </div>
                </div>

                <footer class="starbot-cal-modal-foot">
                  <div>
                    <Show when={current().mode === "edit"}>
                      <Show
                        when={confirmDelete()}
                        fallback={
                          <button
                            type="button"
                            class="starbot-cal-delete-btn"
                            disabled={saving() || deleting()}
                            onClick={() => setConfirmDelete(true)}
                          >
                            <Trash2 class="size-4" aria-hidden="true" />
                            删除任务
                          </button>
                        }
                      >
                        <button
                          type="button"
                          class="starbot-cal-delete-btn is-confirm"
                          disabled={deleting()}
                          onClick={() => void handleDeleteRoutine()}
                        >
                          {deleting() ? "删除中…" : "确认删除？"}
                        </button>
                      </Show>
                    </Show>
                  </div>

                  <div class="starbot-cal-modal-foot-actions">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={saving() || deleting()}
                      onClick={closeModal}
                    >
                      取消
                    </Button>
                    <Button type="submit" size="sm" loading={saving()} disabled={deleting()}>
                      {current().mode === "create" ? "创建任务" : "保存修改"}
                    </Button>
                  </div>
                </footer>
              </form>
            </div>
          </Portal>
        )}
      </Show>
    </section>
  );
}
