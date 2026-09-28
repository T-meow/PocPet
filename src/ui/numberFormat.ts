export { formatInteger, formatProbabilityPercent, formatMultiplierPercent } from '../core/displayNumbers';

const compactUnits = [
  { value: 1_000_000_000_000, suffix: 'T' },
  { value: 1_000_000_000, suffix: 'B' },
  { value: 1_000_000, suffix: 'M' },
  { value: 1_000, suffix: 'K' },
] as const;

export const formatCompactNumber = (value: number) => {
  if (!Number.isFinite(value)) return '0';

  const sign = value < 0 ? '-' : '';
  const absolute = Math.abs(Math.trunc(value));
  if (absolute <= 10_000) return `${sign}${absolute}`;

  const unit = compactUnits.find((candidate) => absolute >= candidate.value) ?? compactUnits[compactUnits.length - 1];
  const compactValue = Math.floor(absolute / unit.value);
  return `${sign}${compactValue}${unit.suffix}`;
};
