export const PALETTE = [
  "#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#f97316", 
  "#ec4899", "#eab308", "#06b6d4", "#84cc16", "#14b8a6"
];

export const getBaselineTime = () => {
  const now = new Date();
  const baseline = new Date(now);
  baseline.setHours(1, 50, 0, 0); // 01:50:00 AM local time
  if (now < baseline) {
    baseline.setDate(baseline.getDate() - 1);
  }
  return baseline;
};
