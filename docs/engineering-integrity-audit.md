# WaveCore X Engineering Integrity Audit

Audit date: 2026-09-26. Scope: checked-in Python backend, React/Vite simulator, tests, documentation, and the current implementation reachable from the simulation endpoints. This is an engineering audit, not a claim of LTE/5G conformance.

## Executive Summary

WaveCore X is **end-to-end functional for a defined subset**: UTF-8 payloads, CRC-16 framing, Hamming(7,4), block interleaving, BPSK/QPSK/square QAM, a basic pilot-aided OFDM link, AWGN/Rayleigh/Rician flat block fading, ZF/MMSE equalization, and receiver-derived metrics. Most advanced coding/channel/OFDM/synchronization helpers are independent utilities, not pipeline features. The UI had synthetic fallbacks and canned history that implied measured results; those have been removed from the main measurement/readout path. Visualization tabs remain largely explanatory illustrations, not returned waveform data.

Confidence: medium for basic deterministic in-process behavior because focused reference tests and the repository test suite run locally; low for broad statistical validation and no confidence in RF, hardware, standards, or deployment claims without additional test vectors and independent validation.

## Request-to-Result Data Flow

1. `frontend/src/app/App.tsx` collects message, modulation, SNR, FFT size, CP, CFO, and timing offset. `frontend/src/app/api/wavecore.ts` serializes these to the run request; it currently supplies Hamming(7,4), MMSE, AWGN, a fixed pilot spacing, and a fixed seed as client defaults.
2. `POST /api/v1/simulations/run` and `WS /api/v1/simulations/live` are registered in `wavecore/api/routes.py`. The websocket calls the same `_to_domain` conversion and `SimulationEngine.run` as REST.
3. `wavecore/api/schemas.py` validates enums and OFDM FFT/CP constraints. The end-to-end request rejects coding schemes other than Hamming rather than silently claiming they ran.
4. `wavecore/simulation/engine.py` executes message UTF-8 bits -> CRC-16 -> Hamming(7,4) -> block interleave -> modulation -> pilot OFDM/IFFT/CP -> channel -> CP removal/FFT -> pilot LS estimate/interpolation -> selected equalizer -> hard demodulation -> deinterleave -> Hamming decode -> CRC check -> UTF-8 recovery -> metrics and stage traces.
5. `wavecore/dsp/channel.py` seeds a NumPy generator from the configured seed. AWGN and fading are generated in the actual transmitted path. Metrics use the actual source and recovered bit/symbol arrays; waveform duration-derived throughput and wall-clock runtime are separate outputs.
6. The React UI stores the returned simulation and displays its recovered message/metrics. The websocket computes the full result before pacing stage events; its animation is playback of completed work, not incremental DSP execution.

`SimulationEngine.run` returns bounded complex samples under relevant stage `data.visualization`: transmitted/received waveform, flat fading coefficients, TX/RX OFDM grids, TX/detected constellation, and equalized constellation/channel estimate. Each preview contains at most 256 uniformly selected samples plus original indices and full sample count; grids also include dimensions in unshifted FFT-bin order. Waveform, constellation, OFDM resource-grid, and channel-coefficient charts now consume only traces from the current simulation result and show Unavailable when data is absent or invalid. The resource grid selects TX or RX according to the active OFDM/Reception stage. The channel panel plots flat coefficient magnitude `|h[n]|`; it is not a multipath impulse response. Spectrum, BER theory, and performance views remain illustrative/theoretical. The encoding panel computes a deterministic preview from current text as UTF-8 bytes and groups bits by selected modulation order; it is not a backend run trace. Capability discovery lists trace types returned by the API, not necessarily rendered by the UI.

## Feature Audit

Statuses describe the end-to-end application path unless explicitly called standalone.

| Feature | Status | Evidence | Defect / limitation | Next action |
|---|---|---|---|---|
| UTF-8, bit serialization/recovery | Implemented and verified | `wavecore/dsp/encoding.py`, `SimulationEngine.run`; scientific validation round trip | Invalid UTF-8 recovery is replacement-decoded; framing length is implicit | Add explicit length/header and malformed-frame tests |
| CRC-16-CCITT | Implemented and verified | `wavecore/dsp/coding.py` append/verify; engine CRC check | MSB-first, init FFFF, poly 0x1021, xorout 0; document as CRC-16/CCITT-FALSE bit convention | Add published byte test vector |
| Hamming(7,4) | Implemented and verified in core path | `wavecore/dsp/coding.py`; `tests/test_simulation_engine.py` | Corrects single-bit errors per word; not burst protection | Add exhaustive 16-nibble and multi-error tests |
| Convolutional/Viterbi | Implemented, unverified standalone | `wavecore/dsp/advanced_coding.py` | Not accepted by full simulation request | Add reference vectors, puncturing/tail semantics, then integrate explicitly |
| Reed-Solomon GF(256) | Implemented, unverified standalone | `ReedSolomonCode` in `advanced_coding.py` | Limited brute-force decoder and bounded correction; no core integration | Validate against independent RS vectors and document primitive polynomial/code parameters |
| LDPC | Partial standalone | `LDPCCode` in `advanced_coding.py` | Custom systematic construction/min-sum; not a standardized matrix/code, no core integration | Validate parity constraints and decoder against reference fixtures; label code profile |
| Polar | Partial standalone | `PolarCode` in `advanced_coding.py` | Heuristic construction/small-block decoder; not 5G NR Polar; no core integration | Add standard construction/CRC/rate matching or retain explicitly educational status |
| Interleave/deinterleave | Implemented and verified | `wavecore/dsp/coding.py`, engine | Block permutation, not a standards-defined interleaver | Document dimensions/padding and test permutations |
| Adaptive coding recommendation | Partial / heuristic | `AdaptiveCodingController` in `advanced_coding.py` | Fixed SNR thresholds, no measured link adaptation or hysteresis | Rename as threshold recommendation; validate against target link profile |
| BPSK/QPSK/16/64/256-QAM | Implemented and verified in core | `wavecore/dsp/modulation.py`; noiseless round-trip tests | Unit average symbol energy for supported constellations; hard nearest-neighbor decisions; no soft LLR | Add exhaustive labeling/energy tests and theoretical curves |
| Basic OFDM/pilots/FFT/IFFT/CP | Implemented and verified for supported configuration | `wavecore/dsp/ofdm.py`, engine | Unshifted FFT bins; pilots include bin 0; no guard/DC allocation; CP=0 bug fixed | Add non-flat controlled multipath and pilot impairment tests |
| Resource grid/windowing/OFDMA | Implemented, unverified standalone | `wavecore/dsp/advanced_ofdm.py` | Not connected to pipeline/API | Add grid invariants and standards-independent docs before integration |
| AWGN | Implemented and verified | `wavecore/dsp/channel.py`, seeded BER theory test | SNR is average complex sample power/noise power, not generally Eb/N0 | Expose convention clearly in API/UI |
| Rayleigh/Rician | Implemented, partially verified | `channel.py`; deterministic block-fading test | Flat block fading, optional phase rotation; no time-varying Jakes process in core path | Add distribution/power tests with confidence bounds |
| Multipath/path loss/shadowing/Jakes | Implemented, unverified standalone | `wavecore/dsp/advanced_channel.py` | Not selected by API or core chain | Independent impulse-response/statistical tests, then integrate deliberately |
| CFO/timing impairments | Partially implemented in channel | `channel.py`, request schema | Impairments can be applied; correction/sync functions in `wavecore/dsp/synchronization.py` are not called in core pipeline | Wire receiver estimators and residual-error tests or disable these request fields |
| Pilot detection/channel estimation | Partial in core | `wavecore/dsp/equalization.py`, `ofdm.py` | LS pilot estimation with linear interpolation; pilot pattern is simple comb; no robust tracking | Validate under channel delay/Doppler and report estimator assumptions |
| ZF/MMSE | Implemented and verified for basic link | `wavecore/dsp/equalization.py`, engine | MMSE regularization now uses FFT-domain noise variance (`time variance * FFT size`) under NumPy transform scaling; channel/noise estimates are simplified | Add analytical controlled-channel tests |
| BER/SER/EVM | Implemented and verified basic definitions | `wavecore/analytics/metrics.py`, engine | BER on payload bits after decoding; SER on hard symbol decisions; EVM against equalized decisions/reference, not RF measurement | Document exact denominators and add tests for edge cases |
| Throughput/latency | Partial but honest after correction | engine metrics | throughput is payload bits / modeled waveform duration; `latency_ms` is local compute runtime, not network/air-interface latency | Rename runtime field in a future API version; include overhead assumptions |
| Experiments/history/compare | Planned/not implemented | database models exist, no repository or routes | UI history is session-local; no persistence; canned history removed | Implement persistence transaction and API before claiming saved experiments |
| Export/PDF | Partial | `wavecore/export/service.py` JSON/CSV/text generation | Not exposed in API; no PDF generator | Wire export endpoints and test content/type/security |
| REST/WebSocket | Partial | `wavecore/api/routes.py`, `simulation/realtime.py` | WebSocket streams playback events after synchronous complete simulation; pause/step affect playback only | Rename/document as result playback; make true incremental/cancellable execution separately |
| Capability discovery | Implemented and corrected for core | `/api/v1/capabilities` in routes | Accurate for enum/core support after narrowing coding and visualization lists | Add feature-level status and impairment support metadata |
| Frontend plots | Partially backend-driven | `TraceWaveform`, `ResourceGridTrace`, `ChannelResponseTrace`, and `ConstellationDiagram` consume current-run traces in `frontend/src/app/App.tsx` | Waveform plots TX/RX I components against original sample indices; resource-grid cells use the actual flattened samples and grid shape; channel plots dimensionless flat-fading coefficient magnitude against sample index. Spectrum/BER/performance remain theoretical; encoding is a deterministic local UTF-8/bit-group preview | Browser E2E is not configured; channel chart is not a multipath response |

### Implementation Entry Points

- Message: `MessageCodec.text_to_bits`, `MessageCodec.bits_to_text` in `wavecore/dsp/encoding.py`.
- Framing/coding: `append_crc16`, `verify_crc16`, `hamming74_encode`, `hamming74_decode` in `wavecore/dsp/coding.py`; standalone `ConvolutionalCode`, `ReedSolomonCode`, `LDPCCode`, `PolarCode`, `AdaptiveCodingController` in `wavecore/dsp/advanced_coding.py`.
- Interleaving: `block_interleave`, `block_deinterleave` in `wavecore/dsp/interleaving.py`.
- Modulation: `modulate`, `demodulate` in `wavecore/dsp/modulation.py`.
- Core OFDM: `ofdm_modulate`, `ofdm_demodulate`, `estimate_channel_from_pilots`, `extract_data_symbols` in `wavecore/dsp/ofdm.py`; resource-grid helpers are in `advanced_ofdm.py`.
- Channel: `apply_wireless_channel`, `_add_awgn`, `_fading_coefficients` in `wavecore/dsp/channel.py`; multipath/shadowing/Jakes utilities are in `advanced_channel.py`.
- Synchronization: estimators/correctors in `wavecore/dsp/synchronization.py`; none are called by `SimulationEngine.run`.
- Metrics: `bit_error_rate`, `symbol_error_rate`, `evm_percent`, `throughput_bps` in `wavecore/analytics/metrics.py`.
- Persistence/export: `ExperimentModel` and related SQLAlchemy tables in `wavecore/infrastructure/models.py`; `ExportService` in `wavecore/export/service.py`. Neither is connected to experiment/export API routes.

## Mathematics and Conventions

- Modulation uses normalized constellations (mean Es approximately one). Square QAM uses the standard scale `sqrt(2/(3*(M-1)))`; bit labeling is Gray-like per I/Q axis. Decisions are nearest constellation points.
- AWGN uses circular complex Gaussian noise: for measured signal power `P`, total complex noise power is `P / 10^(SNR_dB/10)`, with half in each real component. Thus the channel parameter is sample SNR. It equals Eb/N0 for unit-energy uncoded BPSK samples, but not automatically for coded OFDM with pilots/CP.
- OFDM uses NumPy's default IFFT (1/N scaling) and FFT (unscaled), with unshifted bins. For white time-domain noise, FFT-bin variance grows by N; MMSE now receives the corresponding frequency-domain variance. CP is copied from the end and removed before FFT; CP=0 now yields no CP.
- Basic channel fading is one complex coefficient per frame (flat block fading), normalized to unit average power; Rician K controls LOS-to-diffuse ratio. Doppler in this core path is phase rotation, not a Jakes fading process.
- Channel estimation is pilot LS plus linear interpolation. Equalizers use the estimated channel. No blind or standards-specific synchronization is implied.
- BER is bit errors divided by transmitted payload bits, after decode; SER is hard symbol decision errors divided by transmitted symbols; EVM is RMS complex error relative to reference RMS magnitude. Throughput is payload bit count / generated baseband waveform duration. `latency_ms` is processing wall-clock time and varies by machine/load.
- Randomized channel tests set `random_seed`; `None` is intentionally nondeterministic. Finite frames produce noisy estimates and zero observed errors is not proof of zero BER.
- Frontend SNR/FFT/CP/modulation and CFO/timing sliders map to request fields. CFO and timing offsets are applied in `apply_wireless_channel`; the receiver does not estimate/correct them, so controls are explicitly labeled “uncorrected” and output degradation is part of the result. Channel model, coding, equalizer, pilot spacing, and seed remain fixed client choices, not visible controls. The interface does not expose unsupported advanced coding or multipath controls.
- Actual trace previews use complex `{re, im}` samples, original flattened `indices`, and `sample_count`; grid traces additionally include `shape`. The cap is 256 points per trace field, not 256 total across the response. CFO/timing offset are impairments rather than receiver correction features.

## Reproducibility and Assumptions

Record the exact JSON request (including seed), repository revision, Python/dependency versions, payload bit count, and returned metrics/traces. Re-run with the same seed and software stack to reproduce channel samples; runtime is not expected to reproduce. The core is complex-baseband software only: no RF front end, oscillator hardware, antenna, SDR, HIL, conformance suite, or calibrated measurement chain is present. The application is not LTE/5G/NR standards-compliant. Standards claims require implementing the selected specification's complete procedures and validating against approved vectors/certification tests.

## Frontend and API Integrity

Working controls: message, four visible modulation choices, SNR, FFT size (snapped to powers of two), CP (bounded below FFT size), CFO, and timing offset. CFO/timing are applied but not corrected in the receiver, and the controls are labeled uncorrected. Run uses WebSocket playback of the completed result; parameter edits use REST auto-run. The request client hardcodes AWGN, Hamming, MMSE, pilot spacing, and seed; there are no visible controls for these. Backend errors throw and surface an error state. A new run clears previous results/traces. Missing backend metrics/traces display unavailable, not estimated values.

The constellation, waveform, OFDM resource-grid, and channel-coefficient plots use bounded arrays from the current result; absent, malformed, or empty traces show Unavailable. A new run, parameter change, or failure clears the result used by these plots. The channel plot represents the returned flat-fading coefficient sequence, not multipath. Spectrum and BER/performance views are theoretical. The encoding panel is a deterministic local UTF-8 and modulation-bit grouping calculation, not backend output. Explanation fallback prose is static educational text where the server does not return content. Experiment history is ephemeral and only appended from successful simulation results. Parameter changes invalidate active WebSocket playback, stop its socket, and clear stale result metrics before the debounced REST run; asynchronous handlers ignore events from an obsolete run generation.

## Tests and Findings

Scientific validation includes CP=0, noiseless full-chain recovery, seeded BPSK AWGN comparison to `0.5*erfc(sqrt(Eb/N0))` at 3 dB over 200,000 bits, fading reproducibility, bounded traces, and CFO/timing trace changes. API and WebSocket tests cover trace pass-through and playback controls.

Runtime verification on 2026-09-26: started a temporary backend on `127.0.0.1:8011` and frontend on `127.0.0.1:5175`; backend health returned `ok`, frontend returned HTTP 200, and the Vite `/api` proxy reached the already-running backend on port 8001. A seeded QPSK REST run recovered `Audit run`, returned CRC true, BER 0.0, and 12 traces; repeating the request returned the same BER. Unsupported LDPC returned HTTP 422. A BPSK run through the frontend proxy recovered `Frontend proxy check`, CRC true, BER 0.0, and 12 traces. WebSocket stage playback, completion, pause, step, and resume are covered by the integration tests below. These runtime checks were baseband software simulations, not browser-driven UI assertions.

Current verification: `pytest -q -rA` passed all 41 backend tests, including REST/API and WebSocket integration tests; `node --test frontend/src/app/api/traceData.test.mjs frontend/src/app/api/encodingPreview.test.mjs` passed 9 tests, including actual current-run trace selection, axis-index metadata, and missing/malformed trace handling; `npm run build` succeeded (1,590 modules transformed) with existing Vite/esbuild deprecation warnings. No browser-driven E2E or component-test infrastructure is configured. Vite has no typecheck/lint scripts; the Python Ruff executable was unavailable in this environment. No production browser rendering assertion was performed.

Detected and corrected during this audit: SER compared complex symbol distances to an arbitrary `1e-6` threshold; zero CP accidentally appended an entire OFDM symbol; Rayleigh/Rician used independent per-sample coefficients despite a flat-fading interpretation; MMSE passed time-domain noise variance into FFT-domain equalization; coding requests could claim a scheme that the engine ignored; capabilities over-advertised; UI displayed generated BER/throughput and canned history, and retained stale successful metrics after a failed request. This verification pass also corrected the UI/audit mismatch about restored illustrative plots, invalidated/closed stale WebSocket runs on parameter changes or REST execution, and fixed the encoding panel to derive Unicode code points, UTF-8 bytes, and modulation groups from the actual UTF-8 byte stream.

## Engineering Use and Validation Ladder

Appropriate use: teaching/debugging a baseband chain; controlled comparisons of modulation/coding helpers; studying basic OFDM, CP, AWGN, and flat fading; checking seeded repeatability; generating exploratory JSON/CSV/text reports. Change one parameter at a time and inspect actual API traces and decoded output.

The simulator cannot establish real radio coverage, RF emissions, receiver sensitivity, coexistence, standards conformance, field performance, or product readiness. Current level is **mathematical software simulation with limited deterministic/theoretical checks**. The next levels require broad analytical/reference-vector validation, then software-in-loop/hardware-in-loop test harnesses, then calibrated SDR OTA experiments in controlled/legal environments, and finally standards-specific certification. No level beyond the first is currently supported.

## Prioritized Backlog

- **P0:** receiver synchronization/correction remains unavailable for the now-visible uncorrected CFO/timing impairments; add exhaustive coding and CRC reference vectors; add validation for extreme channel values and Unicode metric accounting.
- **P1:** independent fading/multipath/estimator/equalizer statistical tests; integrate advanced modules with explicit profiles; make websocket work truly incremental and cancellable; accurate capability schema.
- **P2:** persistence APIs/transactional experiment versions, comparison, export endpoints/PDF, backend traces for spectrum/eye/BER-curve visualizations.
- **P3:** performance profiling, optional acceleration, broader responsive/accessibility audits, cloud/hardware paths.
