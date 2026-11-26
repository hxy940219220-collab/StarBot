import type { ViewInstance } from "react-native";

export interface MeasuredAgentRow {
  agentId: string;
  top: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

const rowRefs = new Map<string, ViewInstance>();

export function registerAgentRowView(agentId: string, node: ViewInstance | null): void {
  if (node) rowRefs.set(agentId, node);
  else rowRefs.delete(agentId);
}

export function measureRegisteredAgentRows(): Promise<MeasuredAgentRow[]> {
  const entries = [...rowRefs.entries()];
  if (entries.length === 0) return Promise.resolve([]);
  return Promise.all(
    entries.map(
      ([agentId, node]) =>
        new Promise<MeasuredAgentRow | null>((resolve) => {
          try {
            node.measureInWindow((x: number, y: number, width: number, height: number) => {
              if (height <= 0 || width <= 0) {
                resolve(null);
                return;
              }
              resolve({ agentId, left: x, top: y, bottom: y + height, width, height });
            });
          } catch {
            resolve(null);
          }
        }),
    ),
  ).then((list) => list.filter((item): item is MeasuredAgentRow => item !== null).sort((a, b) => a.top - b.top));
}

const HYSTERESIS_PT = 10;

export function hitTestAgentRow(
  rows: readonly MeasuredAgentRow[],
  fingerY: number,
  shiftY: number,
  currentAgentId: string | null,
): MeasuredAgentRow | null {
  if (rows.length === 0) return null;
  if (currentAgentId) {
    const current = rows.find((row) => row.agentId === currentAgentId);
    if (current) {
      const top = current.top + shiftY - HYSTERESIS_PT;
      const bottom = current.bottom + shiftY + HYSTERESIS_PT;
      if (fingerY >= top && fingerY <= bottom) return current;
    }
  }
  for (const row of rows) {
    const top = row.top + shiftY;
    const bottom = row.bottom + shiftY;
    if (fingerY >= top && fingerY <= bottom) return row;
  }
  return null;
}
