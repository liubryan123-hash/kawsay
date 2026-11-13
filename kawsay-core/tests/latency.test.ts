import { describe, expect, it } from "vitest";
import { formatClock, latencyState, ROUND_TRIP_MIN } from "../src/core/latency";

const MIN = 60_000;

describe("latencyState", () => {
  it("uses the three scenarios fixed in the plan", () => {
    expect([...ROUND_TRIP_MIN]).toEqual([6, 24, 44]);
  });
  it("moves through outbound, inbound and reply-possible at 0, L/2 and L", () => {
    expect(latencyState(0, 0, 24)).toMatchObject({ phase: "outbound", msToEarth: 12 * MIN, msToReply: 24 * MIN, progress: 0 });
    expect(latencyState(0, 12 * MIN - 1, 24).phase).toBe("outbound");
    expect(latencyState(0, 12 * MIN, 24)).toMatchObject({ phase: "inbound", msToEarth: 0, msToReply: 12 * MIN, progress: 0.5 });
    expect(latencyState(0, 24 * MIN, 24)).toMatchObject({ phase: "reply_possible", msToReply: 0, progress: 1 });
    expect(latencyState(0, 99 * MIN, 24)).toMatchObject({ phase: "reply_possible", progress: 1 });
  });
  it("reports the three milestones and whether each was reached", () => {
    const s = latencyState(1000, 1000 + 4 * MIN, 6);
    expect(s.milestones.map((m) => [m.atMs / MIN, m.reached])).toEqual([[0, true], [3, true], [6, false]]);
  });
  it("never goes negative if the clock is read before the start", () => {
    expect(latencyState(5000, 0, 6)).toMatchObject({ elapsedMs: 0, phase: "outbound" });
  });
});

describe("formatClock", () => {
  it("formats mm:ss and rounds up", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(1)).toBe("00:01");
    expect(formatClock(24 * MIN)).toBe("24:00");
    expect(formatClock(44 * MIN - 500)).toBe("44:00");
    expect(formatClock(-5)).toBe("00:00");
  });
});
