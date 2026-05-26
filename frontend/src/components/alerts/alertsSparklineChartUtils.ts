export function normalizeSparklineValues(values: number[]) {
  return values.filter((value) => Number.isFinite(value));
}

export function sparklinePath(values: number[]) {
  const normalizedValues = normalizeSparklineValues(values);
  if (normalizedValues.length === 0) {
    return 'M4 24 L96 24';
  }

  const max = Math.max(...normalizedValues, 1);
  const min = Math.min(...normalizedValues, 0);
  const spread = max - min || 1;

  return normalizedValues.map((value, index) => {
    const x = 4 + (index / Math.max(normalizedValues.length - 1, 1)) * 92;
    const y = 28 - (((value - min) / spread) * 20);
    return `${index === 0 ? 'M' : 'L'}${x} ${y}`;
  }).join(' ');
}
