/**
 * Latency clock. The Execution Plan fixes three scenarios: 6, 24 and 44 minutes.
 * They are read here as round-trip delays (report out + reply back), consistent with
 * the plan's one-way range of 3 to 22 minutes to Mars and with its fallback text
 * "0, L/2, L". Confirm this reading with the team before the demo.
 */
export const ROUND_TRIP_MIN = [6, 24, 44] as const;

export type Phase = "outbound" | "inbound" | "reply_possible";

export interface Milestone {
  label: string;
  /** Milliseconds after the event was logged. */
  atMs: number;
  reached: boolean;
}

export interface LatencyState {
  elapsedMs: number;
  phase: Phase;
  /** Time until the report reaches Earth (L/2). */
  msToEarth: number;
  /** Time until the earliest possible reply (L). Earth's own decision time is not included. */
  msToReply: number;
  /** 0..1 of the round trip. */
  progress: number;
  milestones: Milestone[];
}

export function latencyState(startMs: number, nowMs: number, roundTripMin: number): LatencyState {
  const total = roundTripMin * 60_000;
  const elapsedMs = Math.max(0, nowMs - startMs);
  const phase: Phase = elapsedMs < total / 2 ? "outbound" : elapsedMs < total ? "inbound" : "reply_possible";
  const at = [0, total / 2, total];
  const labels = ["Report sent", "Report reaches Earth", "Earliest possible reply"];
  return {
    elapsedMs,
    phase,
    msToEarth: Math.max(0, total / 2 - elapsedMs),
    msToReply: Math.max(0, total - elapsedMs),
    progress: total === 0 ? 1 : Math.min(1, elapsedMs / total),
    milestones: at.map((atMs, i) => ({ label: labels[i], atMs, reached: elapsedMs >= atMs })),
  };
}

/** Formats milliseconds as mm:ss (rounded up, so a countdown never shows 00:00 early). */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
