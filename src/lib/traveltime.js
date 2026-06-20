/**
 * Calculates the travel time in seconds between coordinates.
 * @param {number} x1 - Origin X
 * @param {number} y1 - Origin Y
 * @param {number} x2 - Target X
 * @param {number} y2 - Target Y
 * @param {number} unitSpeed - Base speed of the slowest unit in the command
 * @param {number} worldSpeed - Speed multiplier of the world
 * @param {object} modifiers - Research and buff flags
 * @returns {number} Travel time in seconds
 */
export function calculateTravelTime(x1, y1, x2, y2, unitSpeed, worldSpeed, modifiers = {}) {
  const dx = x1 - x2;
  const dy = y1 - y2;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance === 0) {
    return 300; // Minimum travel time on the same island (5 minutes)
  }

  let speedMultiplier = 1.0;
  if (modifiers.cartographyResearched) speedMultiplier += 0.10;
  if (modifiers.hasLighthouse) speedMultiplier += 0.15;
  if (modifiers.atalantaLevel) speedMultiplier += (0.09 + modifiers.atalantaLevel * 0.01);
  if (modifiers.speedBuff) speedMultiplier += modifiers.speedBuff; // items, spells

  const travelConstant = 500;
  const baseDelay = 300; // Grepolis naval constant delay (5 minutes)

  const calculatedSeconds = baseDelay + (distance * travelConstant) / (unitSpeed * worldSpeed * speedMultiplier);
  return Math.round(calculatedSeconds);
}

/**
 * Calculates the launch and recall timings.
 * @param {Date} targetReturnTime - The target time to land (e.g. CS arrival +/- 1s)
 * @param {number} cancelDelaySeconds - Outward travel duration before recall (D)
 * @returns {object} Timing details
 */
export function calculateRecallTiming(targetReturnTime, cancelDelaySeconds) {
  const D = cancelDelaySeconds; // outward travel duration before recall
  if (D > 600) {
    throw new Error("Recall sniping requires cancel delay to be <= 10 minutes (600 seconds).");
  }

  const targetReturnEpoch = targetReturnTime.getTime();
  
  // Send time is (2 * D) before the target return time
  const sendEpoch = targetReturnEpoch - (2 * D * 1000);
  const sendTime = new Date(sendEpoch);

  // Recall time is exactly halfway between send and return (D seconds after send)
  const recallEpoch = sendEpoch + (D * 1000);
  const recallTime = new Date(recallEpoch);

  return {
    sendTime,
    recallTime,
    cancelDelaySeconds: D,
    totalElapsedSeconds: 2 * D
  };
}
