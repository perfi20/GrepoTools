import { expect, test, describe } from 'vitest';
import { calculateTravelTime, calculateRecallTiming, calculateMidpointRecall, formatDuration, parseDuration } from './traveltime.js';

describe('Travel Time Engine', () => {
  test('returns base delay when coordinates are identical', () => {
    const time = calculateTravelTime(100, 100, 100, 100, 13, 2);
    expect(time).toBe(300); // 5 minutes base delay
  });

  test('calculates correct travel time with speed modifiers', () => {
    // 5 units distance, base speed 13, world speed 2, Cartography (+10%), Lighthouse (+15%)
    const time = calculateTravelTime(100, 100, 103, 104, 13, 2, {
      cartographyResearched: true,
      hasLighthouse: true
    });
    expect(time).toBe(377);
  });
});

describe('Recall Timer Midpoint Logic', () => {
  test('calculates exact send and recall times from planned delay', () => {
    const target = new Date("2026-06-20T12:00:00.000Z");
    const cancelDelay = 240; // 4 minutes cancel delay
    const timings = calculateRecallTiming(target, cancelDelay);
    
    expect(timings.sendTime.toISOString()).toBe("2026-06-20T11:52:00.000Z");
    expect(timings.recallTime.toISOString()).toBe("2026-06-20T11:56:00.000Z");
    expect(timings.totalElapsedSeconds).toBe(480);
  });

  test('calculates exact midpoint recall from actual launch epoch', () => {
    const target = new Date("2026-06-20T12:00:00.000Z");
    const launch = new Date("2026-06-20T11:50:00.000Z"); // 10 minutes total gap -> 5 min cancel delay
    const timings = calculateMidpointRecall(target, launch);
    
    expect(timings.cancelDelaySeconds).toBe(300);
    expect(timings.recallTime.toISOString()).toBe("2026-06-20T11:55:00.000Z");
    expect(timings.totalElapsedSeconds).toBe(600);
  });

  test('throws error if cancel delay is greater than 600', () => {
    const target = new Date("2026-06-20T12:00:00.000Z");
    expect(() => calculateRecallTiming(target, 601)).toThrow(/10 minutes/);
  });

  test('throws error in midpoint recall if launch is after target', () => {
    const target = new Date("2026-06-20T12:00:00.000Z");
    const launch = new Date("2026-06-20T12:01:00.000Z");
    expect(() => calculateMidpointRecall(target, launch)).toThrow(/before target/);
  });
});

describe('Duration Helpers', () => {
  test('formats seconds to HH:MM:SS', () => {
    expect(formatDuration(3665)).toBe("01:01:05");
    expect(formatDuration(45)).toBe("00:00:45");
  });

  test('parses HH:MM:SS to seconds', () => {
    expect(parseDuration("01:01:05")).toBe(3665);
    expect(parseDuration("00:00:45")).toBe(45);
    expect(parseDuration("10:00")).toBe(600);
  });
});
