// Presentation only: keep precise values in gameplay calculations and saves.
export const formatInteger = (value: number) => String(Number.isFinite(value) ? Math.round(value) || 0 : 0);

// A rare reward must not look impossible (0%) or guaranteed (100%) after rounding.
export const formatProbabilityPercent = (percent: number) => {
  if (percent > 0 && percent < 1) return '<1%';
  if (percent > 99 && percent < 100) return '>99%';
  return `${formatInteger(percent)}%`;
};

export const formatMultiplierPercent = (multiplier: number) => `${formatInteger(multiplier * 100)}%`;
