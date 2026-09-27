import assert from "node:assert/strict";
import test from "node:test";
import {
  getChannelCoefficientTrace,
  getResourceGridTrace,
  getTraceVisualization,
  getWaveformTraces,
} from "./traceData.js";

const preview = (sample_count, indices, samples) => ({ sample_count, indices, samples });

test("returns the selected backend stage trace without synthesizing samples", () => {
  const trace = { sample_count: 8, indices: [0, 7], samples: [{ re: 0.25, im: -1 }, { re: 2, im: 0.5 }] };
  const result = { traces: [{ name: "wireless_channel", data: { visualization: { received_waveform: trace } } }] };
  assert.deepEqual(getTraceVisualization(result, "wireless_channel", "received_waveform"), trace);
});

test("returns unavailable for absent results or absent trace fields", () => {
  assert.equal(getTraceVisualization(null, "wireless_channel", "received_waveform"), undefined);
  assert.equal(
    getTraceVisualization({ traces: [{ name: "message_input", data: {} }] }, "wireless_channel", "received_waveform"),
    undefined,
  );
});

test("waveform selector returns paired current-run TX and RX arrays and no stale pair", () => {
  const tx = preview(5, [0, 4], [{ re: 1, im: 0 }, { re: -1, im: 0 }]);
  const rx = preview(5, [0, 4], [{ re: 0.8, im: 0.1 }, { re: -0.9, im: -0.1 }]);
  const result = { traces: [{ name: "wireless_channel", data: { visualization: { transmitted_waveform: tx, received_waveform: rx } } }] };
  assert.deepEqual(getWaveformTraces(result), { tx, rx });
  assert.equal(getWaveformTraces({ traces: [] }), undefined);
  assert.equal(getWaveformTraces({ traces: [{ name: "wireless_channel", data: { visualization: { transmitted_waveform: tx } } }] }), undefined);
});

test("resource-grid selector selects the TX or RX grid for the active pipeline stage", () => {
  const tx = { ...preview(4, [0, 3], [{ re: 1, im: 0 }, { re: 0, im: 1 }]), shape: [2, 2] };
  const rx = { ...preview(4, [0, 3], [{ re: 0.9, im: 0 }, { re: 0, im: 0.8 }]), shape: [2, 2] };
  const result = { traces: [
    { name: "ofdm_transmit", data: { visualization: { resource_grid: tx } } },
    { name: "ofdm_receive", data: { visualization: { resource_grid: rx } } },
  ] };
  assert.deepEqual(getResourceGridTrace(result, "ofdm"), tx);
  assert.deepEqual(getResourceGridTrace(result, "reception"), rx);
  assert.equal(getResourceGridTrace({ traces: [] }, "ofdm"), undefined);
  const invalidGrid = { ...tx, shape: [3, 2] };
  const invalidResult = { traces: [{ name: "ofdm_transmit", data: { visualization: { resource_grid: invalidGrid } } }] };
  assert.equal(getResourceGridTrace(invalidResult, "ofdm"), undefined);
});

test("wireless-channel view selects actual fading coefficient samples and reports missing data", () => {
  const coefficients = preview(3, [0, 2], [{ re: 1, im: 0 }, { re: 0.5, im: 0.5 }]);
  const result = { traces: [{ name: "wireless_channel", data: { visualization: { fading_coefficients: coefficients } } }] };
  assert.deepEqual(getChannelCoefficientTrace(result), coefficients);
  assert.equal(getChannelCoefficientTrace({ traces: [] }), undefined);
});

test("rejects malformed samples rather than passing invalid chart data", () => {
  const malformed = { sample_count: 2, indices: [1, 0], samples: [{ re: 0, im: 0 }, { re: 1, im: 0 }] };
  const result = { traces: [{ name: "wireless_channel", data: { visualization: { fading_coefficients: malformed } } }] };
  assert.equal(getChannelCoefficientTrace(result), undefined);
});
