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

const ROW_GAP_TOLERANCE_PT = 2;

export function hitTestAgentRow(
  rows: readonly MeasuredAgentRow[],
  fingerY: number,
  safeTop = 0,
  safeBottom = Number.POSITIVE_INFINITY,
): MeasuredAgentRow | null {
  if (rows.length === 0) return null;
  if (fingerY < safeTop || fingerY > safeBottom) return null;

  for (const row of rows) {
    const visibleTop = Math.max(safeTop, row.top);
    const visibleBottom = Math.min(safeBottom, row.bottom);
    if (visibleBottom - visibleTop < 16) continue;
    if (fingerY >= visibleTop && fingerY <= visibleBottom) return row;
  }
  for (const row of rows) {
    const visibleTop = Math.max(safeTop, row.top - ROW_GAP_TOLERANCE_PT);
    const visibleBottom = Math.min(safeBottom, row.bottom + ROW_GAP_TOLERANCE_PT);
    if (visibleBottom - visibleTop < 16) continue;
    if (fingerY >= visibleTop && fingerY <= visibleBottom) return row;
  }
  return null;
}
