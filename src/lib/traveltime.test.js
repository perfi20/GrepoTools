import { expect, test, describe } from 'vitest';
import { calculateTravelTime, calculateRecallTiming } from './traveltime.js';

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
    // Expected logic: dx=3, dy=4 -> dist=5
    // speedMultiplier = 1.0 + 0.10 + 0.15 = 1.25
    // delay = 300 + (5 * 500) / (13 * 2 * 1.25)
    // delay = 300 + 2500 / 32.5 = 300 + 76.923...
    // rounded = 377
    expect(time).toBe(377);
  });
});

describe('Recall Timer Midpoint Logic', () => {
  test('calculates exact send and recall times', () => {
    const target = new Date("2026-06-20T12:00:00.000Z");
    const cancelDelay = 240; // 4 minutes cancel delay
    const timings = calculateRecallTiming(target, cancelDelay);
    
    expect(timings.sendTime.toISOString()).toBe("2026-06-20T11:52:00.000Z");
    expect(timings.recallTime.toISOString()).toBe("2026-06-20T11:56:00.000Z");
    expect(timings.totalElapsedSeconds).toBe(480);
  });

  test('throws error if cancel delay is greater than 600', () => {
    const target = new Date("2026-06-20T12:00:00.000Z");
    expect(() => calculateRecallTiming(target, 601)).toThrow(/10 minutes/);
  });
});
