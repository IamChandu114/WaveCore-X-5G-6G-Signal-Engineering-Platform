export function getTraceVisualization(result, stage, key) {
  const value = result?.traces?.find((trace) => trace.name === stage)?.data?.visualization?.[key];
  if (!value || typeof value !== "object" || !Array.isArray(value.samples) || !Array.isArray(value.indices)) {
    return undefined;
  }
  if (
    !Number.isInteger(value.sample_count) || value.sample_count < 0 ||
    value.samples.length === 0 ||
    value.samples.length !== value.indices.length ||
    value.indices.some((index, i) => !Number.isInteger(index) || index < 0 || index >= value.sample_count || (i > 0 && index <= value.indices[i - 1])) ||
    value.samples.some((sample) => !sample || !Number.isFinite(sample.re) || !Number.isFinite(sample.im))
  ) {
    return undefined;
  }
  return value;
}

export function getWaveformTraces(result) {
  const tx = getTraceVisualization(result, "wireless_channel", "transmitted_waveform");
  const rx = getTraceVisualization(result, "wireless_channel", "received_waveform");
  return tx && rx && tx.sample_count === rx.sample_count ? { tx, rx } : undefined;
}

export function getResourceGridTrace(result, stage) {
  const sourceStage = stage === "ofdm" ? "ofdm_transmit" : "ofdm_receive";
  const grid = getTraceVisualization(result, sourceStage, "resource_grid");
  if (!grid || !Array.isArray(grid.shape) || grid.shape.length !== 2) return undefined;
  const [rows, columns] = grid.shape;
  return Number.isInteger(rows) && rows > 0 && Number.isInteger(columns) && columns > 0 && rows * columns === grid.sample_count
    ? grid
    : undefined;
}

export function getChannelCoefficientTrace(result) {
  return getTraceVisualization(result, "wireless_channel", "fading_coefficients");
}
