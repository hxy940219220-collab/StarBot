import { avatarHeadColor } from "@openbot/brand/bloub-avatar";
import type { RoutineCalendarRoutine, RoutineCalendarRun, RoutineCalendarRunStatus } from "@openbot/contracts/ipc";
import type { MobileTextKey } from "@openbot/i18n/mobile";
import { type CalendarDay, calendarDayOf } from "@openbot/team-client/routine-calendar-dates";
import { useQuery } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Typography } from "heroui-native";
import { useThemeColor } from "heroui-native/hooks";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Clock from "lucide-react-native/icons/clock";
import Plus from "lucide-react-native/icons/plus";
import X from "lucide-react-native/icons/x";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";
import { BloubAvatar } from "@/features/agents/components/bloub-avatar";
import { useQueryScope } from "@/features/auth/context/mobile-session-context";
import { useChannels } from "@/features/channels/components/use-channels";
import { useMobileWorkspace } from "@/features/workspace/context/mobile-workspace-context";
import { queryKeys } from "@/features/workspace/model/query-keys";
import type { MobileAgent } from "@/features/workspace/model/workspace-types";
import { LargeTitleScrollView } from "@/shared/components/large-title";
import { SpringPressable } from "@/shared/components/spring-pressable";
import { isAndroid } from "@/shared/lib/platform";
import { useText } from "@/shared/lib/text";
import { uiFeedback } from "@/shared/lib/ui-feedback";

const BRAND_PURPLE = "#7c3aed";
const DOT_PALETTE = ["#7c3aed", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444"] as const;
const DAY_MS = 86_400_000;

type RunStatus = "active" | "paused" | "failed" | "completed";

const STATUS_LABEL = {
  active: "mobile.server.routines.status.active",
  paused: "mobile.server.routines.status.paused",
  failed: "mobile.server.routines.status.failed",
  completed: "mobile.server.routines.status.completed",
} as const satisfies Record<RunStatus, MobileTextKey>;

interface CalendarEntry {
  run: RoutineCalendarRun;
  routine: RoutineCalendarRoutine;
  status: RunStatus;
  day: CalendarDay;
  agents: MobileAgent[];
  owner: string | undefined;
  dotColor: string;
}

interface GridCell {
  iso: CalendarDay;
  year: number;
  month: number;
  day: number;
  inMonth: boolean;
}

function formatDayIso(year: number, monthIndex: number, day: number): CalendarDay {
  return calendarDayOf(new Date(Date.UTC(year, monthIndex, day)), "UTC");
}

function buildMonthGrid(year: number, monthIndex: number): GridCell[] {
  const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1));
  // Monday = 0 ... Sunday = 6
  const startOffset = (firstOfMonth.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const cells: GridCell[] = [];
  for (let i = 0; i < totalCells; i += 1) {
    const dayNum = i - startOffset + 1;
    const d = new Date(Date.UTC(year, monthIndex, dayNum));
    cells.push({
      iso: formatDayIso(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === monthIndex,
    });
  }
  return cells;
}

function runStatus(status: RoutineCalendarRunStatus, routineActive: boolean): RunStatus {
  switch (status) {
    case "scheduled":
      return routineActive ? "active" : "paused";
    case "queued":
    case "running":
      return "active";
    case "succeeded":
    case "cancelled":
      return "completed";
    case "failed":
    case "interrupted":
    case "needs-attention":
      return "failed";
  }
}

export function ServerRoutinesScreen() {
  const { t, format } = useText();
  const insets = useSafeAreaInsets();
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const queryScope = useQueryScope();
  const { servers, agents, loadRoutineCalendar } = useMobileWorkspace();
  const { channels } = useChannels(serverId);
  const server = servers.find((item) => item.id === serverId);
  const serverAgents = useMemo(() => agents.filter((agent) => agent.serverId === serverId), [agents, serverId]);
  const online = server?.state === "online";
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [foreground, muted] = useThemeColor(["foreground", "muted"]);
  const cardBg = String(useCSSVariable("--openbot-bg-grouped") ?? "#ffffff");
  const borderColor = String(useCSSVariable("--openbot-border-grouped") ?? "rgba(0,0,0,0.08)");
  const sheetBg = String(useCSSVariable("--openbot-bg-sheet") ?? "#ffffff");

  const todayDate = useMemo(() => new Date(), []);
  const todayIso = calendarDayOf(todayDate, timeZone);
  const [viewYear, setViewYear] = useState(() => todayDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => todayDate.getMonth());
  const [selectedIso, setSelectedIso] = useState<CalendarDay>(todayIso);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [botPickerOpen, setBotPickerOpen] = useState(false);

  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const firstCell = grid[0]?.iso ?? todayIso;
  const lastCell = grid.at(-1)?.iso ?? todayIso;

  const queryRange = useMemo(
    () => ({
      from: new Date(Date.parse(firstCell) - DAY_MS).toISOString(),
      to: new Date(Date.parse(lastCell) + 2 * DAY_MS).toISOString(),
    }),
    [firstCell, lastCell],
  );

  const calendarQuery = useQuery({
    queryKey: queryKeys.serverRoutines(queryScope, serverId, queryRange.from, queryRange.to),
    enabled: Boolean(serverId && online),
    retry: false,
    staleTime: 60_000,
    queryFn: () => loadRoutineCalendar(queryRange, serverId),
  });

  const entries = useMemo<CalendarEntry[]>(() => {
    const data = calendarQuery.data;
    if (!data) return [];
    const routinesById = new Map(data.routines.map((routine) => [routine.id, routine]));
    const agentById = new Map(serverAgents.map((agent) => [agent.id, agent]));
    const channelById = new Map(channels.map((channel) => [channel.id, channel]));

    return data.runs
      .flatMap((run, idx): CalendarEntry[] => {
        const routine = routinesById.get(run.routineId);
        if (!routine) return [];
        const channel = routine.owner.kind === "channel" ? channelById.get(routine.owner.channelId) : undefined;
        const ids =
          routine.owner.kind === "agent"
            ? [routine.owner.agentId]
            : (channel?.members.map((member) => member.agentId) ?? []);
        const runAgents = ids.flatMap((id) => agentById.get(id) ?? []);
        const primaryAgent = runAgents[0];
        const dotColor = primaryAgent
          ? avatarHeadColor(primaryAgent.avatarSeed, primaryAgent.avatarHue, primaryAgent.avatarColor)
          : (DOT_PALETTE[idx % DOT_PALETTE.length] ?? BRAND_PURPLE);
        return [
          {
            run,
            routine,
            status: runStatus(run.status, routine.active),
            day: calendarDayOf(new Date(run.at), timeZone),
            agents: runAgents,
            owner: routine.owner.kind === "agent" ? primaryAgent?.name : channel?.name,
            dotColor,
          },
        ];
      })
      .sort((a, b) => Date.parse(a.run.at) - Date.parse(b.run.at));
  }, [calendarQuery.data, serverAgents, channels, timeZone]);

  const entriesByDay = useMemo(() => {
    const map = new Map<CalendarDay, CalendarEntry[]>();
    for (const entry of entries) {
      const list = map.get(entry.day);
      if (list) list.push(entry);
      else map.set(entry.day, [entry]);
    }
    return map;
  }, [entries]);

  const dayEntries = entriesByDay.get(selectedIso) ?? [];
  const activeEntry = useMemo(
    () => dayEntries.find((entry) => entry.run.id === selectedEntryId) ?? dayEntries[0] ?? null,
    [dayEntries, selectedEntryId],
  );

  useEffect(() => {
    if (dayEntries.length > 0 && !dayEntries.some((item) => item.run.id === selectedEntryId)) {
      setSelectedEntryId(dayEntries[0]?.run.id ?? null);
    } else if (dayEntries.length === 0) {
      setSelectedEntryId(null);
    }
  }, [dayEntries, selectedEntryId]);

  const selectedCell = grid.find((cell) => cell.iso === selectedIso);
  const selectedDayHeading = selectedCell
    ? t("mobile.app.calendar.daySelectedTitle", { month: selectedCell.month, day: selectedCell.day })
    : selectedIso;

  const weekdays = [
    t("mobile.app.calendar.weekdayMon"),
    t("mobile.app.calendar.weekdayTue"),
    t("mobile.app.calendar.weekdayWed"),
    t("mobile.app.calendar.weekdayThu"),
    t("mobile.app.calendar.weekdayFri"),
    t("mobile.app.calendar.weekdaySat"),
    t("mobile.app.calendar.weekdaySun"),
  ];

  const shiftMonth = (delta: number) => {
    uiFeedback.tick();
    const next = new Date(Date.UTC(viewYear, viewMonth + delta, 1));
    setViewYear(next.getUTCFullYear());
    setViewMonth(next.getUTCMonth());
  };

  const jumpToday = () => {
    uiFeedback.tap();
    setViewYear(todayDate.getFullYear());
    setViewMonth(todayDate.getMonth());
    setSelectedIso(todayIso);
  };

  const openCreateForAgent = (agent: MobileAgent) => {
    uiFeedback.open();
    setBotPickerOpen(false);
    router.push({
      pathname: "/server-routines/agent-routine",
      params: { agentId: agent.id, serverId },
    });
  };

  const openNewTaskPicker = () => {
    uiFeedback.open();
    if (serverAgents.length === 1 && serverAgents[0]) {
      openCreateForAgent(serverAgents[0]);
      return;
    }
    setBotPickerOpen(true);
  };

  const openRoutineDetail = (routine: RoutineCalendarRoutine) => {
    uiFeedback.open();
    if (routine.owner.kind === "agent") {
      router.push({
        pathname: "/server-routines/agent-routine",
        params: { agentId: routine.owner.agentId, serverId, recordId: routine.id },
      });
    } else {
      router.push({
        pathname: "/server-routines/channel-routine",
        params: { channelId: routine.owner.channelId, serverId, recordId: routine.id },
      });
    }
  };

  const timeText = (at: string) => format.date(new Date(at), { hour: "2-digit", minute: "2-digit", timeZone });

  const headerButton = isAndroid ? (
    <Stack.Screen
      options={{
        headerRight: () => (
          <SpringPressable
            feedback="none"
            onPress={openNewTaskPicker}
            className="flex-row items-center gap-1 rounded-full px-3 py-1.5"
            style={{ backgroundColor: BRAND_PURPLE }}
          >
            <Plus color="#ffffff" size={15} strokeWidth={2.4} />
            <Typography className="font-semibold text-xs" style={{ color: "#ffffff" }}>
              {t("mobile.app.calendar.newTask")}
            </Typography>
          </SpringPressable>
        ),
      }}
    />
  ) : (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button icon="plus" onPress={openNewTaskPicker}>
        {t("mobile.app.calendar.newTask")}
      </Stack.Toolbar.Button>
    </Stack.Toolbar>
  );

  return (
    <>
      {headerButton}
      <LargeTitleScrollView title={t("mobile.app.route.schedule")} contentContainerClassName="gap-4 px-4 pt-2 pb-10">
        {/* Month Switcher + Today + Add */}
        <View className="flex-row items-center justify-between gap-2">
          <View className="flex-row items-center gap-1.5">
            <SpringPressable
              feedback="none"
              accessibilityRole="button"
              onPress={() => shiftMonth(-1)}
              className="size-8 items-center justify-center rounded-full bg-control"
            >
              <ChevronLeft color={String(foreground)} size={18} strokeWidth={2.2} />
            </SpringPressable>
            <Typography className="min-w-28 text-center font-bold text-base text-foreground">
              {t("mobile.app.calendar.monthTitle", { year: viewYear, month: viewMonth + 1 })}
            </Typography>
            <SpringPressable
              feedback="none"
              accessibilityRole="button"
              onPress={() => shiftMonth(1)}
              className="size-8 items-center justify-center rounded-full bg-control"
            >
              <ChevronRight color={String(foreground)} size={18} strokeWidth={2.2} />
            </SpringPressable>
          </View>

          <View className="flex-row items-center gap-2">
            <SpringPressable feedback="none" onPress={jumpToday} className="rounded-full bg-control px-3 py-1.5">
              <Typography className="font-medium text-xs text-foreground">{t("mobile.app.calendar.today")}</Typography>
            </SpringPressable>
            <SpringPressable
              feedback="none"
              onPress={openNewTaskPicker}
              className="flex-row items-center gap-1 rounded-full px-3 py-1.5"
              style={{ backgroundColor: BRAND_PURPLE }}
            >
              <Plus color="#ffffff" size={14} strokeWidth={2.5} />
              <Typography className="font-semibold text-xs" style={{ color: "#ffffff" }}>
                {t("mobile.app.calendar.newTask")}
              </Typography>
            </SpringPressable>
          </View>
        </View>

        {/* Calendar Grid Card */}
        <View className="overflow-hidden rounded-2xl" style={{ backgroundColor: cardBg, borderWidth: 1, borderColor }}>
          {/* Weekday Headers */}
          <View className="flex-row py-2.5" style={{ borderBottomWidth: 1, borderBottomColor: borderColor }}>
            {weekdays.map((dayLabel) => (
              <View key={dayLabel} className="flex-1 items-center">
                <Typography className="font-medium text-xs text-text-secondary">{dayLabel}</Typography>
              </View>
            ))}
          </View>

          {/* 7-column Square Cells */}
          <View className="flex-row flex-wrap">
            {grid.map((cell, index) => {
              const isToday = cell.iso === todayIso;
              const isSelected = cell.iso === selectedIso;
              const list = entriesByDay.get(cell.iso) ?? [];
              const rowIdx = Math.floor(index / 7);
              const colIdx = index % 7;

              return (
                <Pressable
                  key={cell.iso}
                  onPress={() => {
                    uiFeedback.tick();
                    setSelectedIso(cell.iso);
                    if (!cell.inMonth) {
                      setViewYear(cell.year);
                      setViewMonth(cell.month - 1);
                    }
                  }}
                  style={{
                    width: `${100 / 7}%`,
                    minHeight: 60,
                    paddingTop: 6,
                    paddingBottom: 6,
                    paddingHorizontal: 3,
                    borderTopWidth: rowIdx > 0 ? 1 : 0,
                    borderLeftWidth: colIdx > 0 ? 1 : 0,
                    borderColor,
                    backgroundColor: isSelected ? "rgba(124, 58, 237, 0.08)" : "transparent",
                    opacity: cell.inMonth ? 1 : 0.36,
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View
                    className="min-w-6 items-center justify-center rounded-full px-1.5 py-0.5"
                    style={{
                      backgroundColor: isToday ? BRAND_PURPLE : "transparent",
                    }}
                  >
                    <Typography
                      className={
                        isToday
                          ? "font-bold text-xs"
                          : isSelected
                            ? "font-bold text-xs"
                            : "font-medium text-xs text-foreground"
                      }
                      style={isToday ? { color: "#ffffff" } : isSelected ? { color: BRAND_PURPLE } : undefined}
                    >
                      {cell.day}
                    </Typography>
                  </View>

                  {/* Compact numbered colored dots (1, 2, 3...) */}
                  <View className="mt-1 flex-row flex-wrap items-center justify-center gap-1">
                    {list.slice(0, 3).map((entry, dotIdx) => (
                      <Pressable
                        key={entry.run.id}
                        hitSlop={4}
                        onPress={() => {
                          uiFeedback.tick();
                          setSelectedIso(cell.iso);
                          setSelectedEntryId(entry.run.id);
                          if (!cell.inMonth) {
                            setViewYear(cell.year);
                            setViewMonth(cell.month - 1);
                          }
                        }}
                        className="size-4 items-center justify-center rounded-full"
                        style={{ backgroundColor: entry.dotColor }}
                      >
                        <Typography className="font-bold text-[9px]" style={{ color: "#ffffff", lineHeight: 11 }}>
                          {dotIdx + 1}
                        </Typography>
                      </Pressable>
                    ))}
                    {list.length > 3 ? (
                      <Typography className="font-semibold text-[9px] text-text-secondary">
                        {`+${list.length - 3}`}
                      </Typography>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Selected Day Schedule Detail Section */}
        <Animated.View
          key={selectedIso}
          entering={FadeInDown.duration(180)}
          className="gap-3 rounded-2xl p-4"
          style={{ backgroundColor: cardBg, borderWidth: 1, borderColor }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Typography className="font-bold text-base text-foreground">{selectedDayHeading}</Typography>
              {selectedIso === todayIso ? (
                <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: "rgba(124,58,237,0.14)" }}>
                  <Typography className="font-semibold text-[11px]" style={{ color: BRAND_PURPLE }}>
                    {t("mobile.app.calendar.today")}
                  </Typography>
                </View>
              ) : null}
              {dayEntries.length > 0 ? (
                <Typography className="text-xs text-text-secondary">
                  {t("mobile.app.calendar.taskCount", { count: dayEntries.length })}
                </Typography>
              ) : null}
            </View>
            <SpringPressable
              feedback="none"
              onPress={openNewTaskPicker}
              className="flex-row items-center gap-1 rounded-full bg-control px-3 py-1.5"
            >
              <Plus color={BRAND_PURPLE} size={14} strokeWidth={2.4} />
              <Typography className="font-semibold text-xs" style={{ color: BRAND_PURPLE }}>
                {t("mobile.app.calendar.addForDay")}
              </Typography>
            </SpringPressable>
          </View>

          {dayEntries.length === 0 ? (
            <View className="items-center gap-2 py-5">
              <Typography className="text-sm text-text-secondary">{t("mobile.app.calendar.emptyDay")}</Typography>
            </View>
          ) : (
            <>
              {/* Numbered dot selector row */}
              <View className="gap-1.5">
                <Typography className="text-[11px] text-text-secondary">
                  {t("mobile.app.calendar.tapDotHint")}
                </Typography>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {dayEntries.map((entry, idx) => {
                    const selected = activeEntry?.run.id === entry.run.id;
                    return (
                      <SpringPressable
                        key={entry.run.id}
                        feedback="tick"
                        scaleTo={0.95}
                        onPress={() => setSelectedEntryId(entry.run.id)}
                        className="flex-row items-center gap-2 rounded-full py-1.5 pr-3 pl-1.5"
                        style={{
                          backgroundColor: selected ? "rgba(124,58,237,0.12)" : "transparent",
                          borderWidth: 1.5,
                          borderColor: selected ? entry.dotColor : borderColor,
                        }}
                      >
                        <View
                          className="size-6 items-center justify-center rounded-full"
                          style={{ backgroundColor: entry.dotColor }}
                        >
                          <Typography className="font-bold text-xs" style={{ color: "#ffffff" }}>
                            {idx + 1}
                          </Typography>
                        </View>
                        <Typography className="font-semibold text-xs text-foreground tabular-nums">
                          {timeText(entry.run.at)}
                        </Typography>
                      </SpringPressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Expanded Task Detail Card */}
              {activeEntry ? (
                <Animated.View
                  key={activeEntry.run.id}
                  entering={FadeIn.duration(150)}
                  className="gap-3 rounded-2xl bg-control/60 p-3.5"
                >
                  <View className="flex-row items-center gap-3">
                    {activeEntry.agents[0] ? (
                      <BloubAvatar
                        agentId={activeEntry.agents[0].id}
                        serverId={serverId}
                        hue={activeEntry.agents[0].avatarHue}
                        color={activeEntry.agents[0].avatarColor}
                        seed={activeEntry.agents[0].avatarSeed}
                        avatarUrl={activeEntry.agents[0].avatarUrl}
                        size={46}
                        animateIdle={false}
                      />
                    ) : null}
                    <View className="min-w-0 flex-1 gap-0.5">
                      <View className="flex-row items-center justify-between gap-2">
                        <Typography className="min-w-0 flex-1 font-bold text-[15px] text-foreground" numberOfLines={1}>
                          {activeEntry.routine.name}
                        </Typography>
                        <View className="rounded-full bg-background px-2 py-0.5">
                          <Typography className="font-medium text-[11px] text-text-secondary">
                            {t(STATUS_LABEL[activeEntry.status])}
                          </Typography>
                        </View>
                      </View>
                      <View className="flex-row items-center gap-2">
                        {activeEntry.owner ? (
                          <Typography className="font-medium text-xs" style={{ color: activeEntry.dotColor }}>
                            {activeEntry.owner}
                          </Typography>
                        ) : null}
                        <View className="flex-row items-center gap-1">
                          <Clock color={String(muted)} size={12} />
                          <Typography className="text-xs text-text-secondary tabular-nums">
                            {timeText(activeEntry.run.at)}
                          </Typography>
                        </View>
                      </View>
                    </View>
                  </View>

                  <SpringPressable
                    feedback="none"
                    onPress={() => openRoutineDetail(activeEntry.routine)}
                    className="flex-row items-center justify-center gap-1 rounded-xl bg-background py-2.5"
                  >
                    <Typography className="font-semibold text-xs text-foreground">
                      {t("mobile.app.calendar.editTask")}
                    </Typography>
                    <ChevronRight color={String(muted)} size={14} />
                  </SpringPressable>
                </Animated.View>
              ) : null}
            </>
          )}
        </Animated.View>

        <Typography className="text-center text-xs text-text-secondary">
          {t("mobile.server.routines.timeZone", { zone: timeZone })}
        </Typography>
      </LargeTitleScrollView>

      {/* Pick which Bot to create a scheduled task for */}
      <Modal
        visible={botPickerOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setBotPickerOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/35">
          <Pressable style={{ flex: 1 }} onPress={() => setBotPickerOpen(false)} />
          <View
            style={{
              backgroundColor: sheetBg,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
              maxHeight: "65%",
            }}
          >
            <View className="items-center pt-3 pb-2">
              <View className="h-1.5 w-10 rounded-full bg-foreground/20" />
            </View>
            <View className="flex-row items-center justify-between px-5 pb-1">
              <Typography className="font-bold text-lg text-foreground">
                {t("mobile.app.calendar.pickBotTitle")}
              </Typography>
              <SpringPressable
                feedback="close"
                accessibilityRole="button"
                accessibilityLabel={t("common.close")}
                className="size-8 items-center justify-center rounded-full bg-control"
                onPress={() => setBotPickerOpen(false)}
              >
                <X color={String(muted)} size={17} strokeWidth={2.2} />
              </SpringPressable>
            </View>
            <Typography className="px-5 pb-3 text-xs text-text-secondary">
              {t("mobile.app.calendar.pickBotSubtitle")}
            </Typography>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }}>
              <View
                className="overflow-hidden rounded-2xl"
                style={{ backgroundColor: cardBg, borderWidth: 1, borderColor }}
              >
                {serverAgents.map((agent, idx) => (
                  <SpringPressable
                    key={agent.id}
                    feedback="none"
                    scaleTo={0.985}
                    onPress={() => openCreateForAgent(agent)}
                    className="flex-row items-center justify-between px-4 py-3"
                    style={idx > 0 ? { borderTopWidth: 1, borderTopColor: borderColor } : undefined}
                  >
                    <View className="min-w-0 flex-1 flex-row items-center gap-3">
                      <BloubAvatar
                        agentId={agent.id}
                        serverId={agent.serverId}
                        hue={agent.avatarHue}
                        color={agent.avatarColor}
                        seed={agent.avatarSeed}
                        avatarUrl={agent.avatarUrl}
                        size={42}
                        animateIdle={false}
                      />
                      <Typography
                        className="min-w-0 flex-1 font-semibold text-[15px] text-foreground"
                        numberOfLines={1}
                      >
                        {agent.name}
                      </Typography>
                    </View>
                    <ChevronRight color={String(muted)} size={17} />
                  </SpringPressable>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
