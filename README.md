# WaveCore X Backend

WaveCore X is an interactive wireless communication engineering platform. This repository contains the FastAPI backend, the Figma-exported simulator UI in `frontend/`, the separate showcase website in `website/`, DSP modules, tests, and engineering documentation.

> **Verified scope:** the basic Hamming-coded OFDM link is wired end to end. Waveform, constellation, OFDM-grid, and channel-coefficient charts use bounded traces from the current backend run and show Unavailable when traces are absent. The channel chart displays flat fading coefficients `|h[n]|`, not a multipath impulse response. Spectrum, BER theory, and performance views remain illustrative/theoretical. CFO and timing controls apply uncorrected impairments (the receiver does not synchronize them out). Advanced modules are not all integrated, and experiment models are not persisted through APIs. See the [engineering integrity audit](docs/engineering-integrity-audit.md) for assumptions and validation limits.

## Milestone 1 Scope

- FastAPI backend skeleton with REST and WebSocket contracts.
- Clean architecture package layout.
- Independently testable DSP modules:
  - UTF-8 message encoding
  - CRC-16-CCITT
  - Hamming(7,4)
  - Block interleaving
  - BPSK, QPSK, 16-QAM, 64-QAM, 256-QAM
  - OFDM pilot insertion, IFFT/FFT, cyclic prefix
  - AWGN, Rayleigh, Rician, frequency offset, timing offset
  - Zero-forcing equalization
  - BER, SER, EVM, throughput, latency
- Simulation pipeline from message to recovered message.
- SQLAlchemy persistence models for experiments, configurations, results, metrics, and reports.
- Engineering explanation catalog for simulation stages.
- JSON and CSV export service.

## Phase 1 Module 1 Additions

- Convolutional encoder and Viterbi decoder.
- Reed-Solomon GF(256) systematic encoder and bounded-distance decoder.
- LDPC systematic encoder and min-sum decoder.
- Polar encoder and decoder support for validation blocks.
- Adaptive coding recommendation controller.
- Least-squares channel estimation utilities.
- MMSE equalization.
- Timing synchronization, frequency-offset correction, carrier recovery, and pilot detection.
- `GET /api/v1/capabilities` for frontend capability discovery.

## Phase 1 Module 2 Additions

- Advanced OFDM resource grid model.
- Pilot allocation over time-frequency resources.
- Guard-band and DC-null reservation.
- IFFT/FFT grid conversion.
- Cyclic-prefix handling.
- Raised-cosine windowing.
- OFDMA contiguous multi-user subcarrier allocation.

## Phase 1 Module 3 Additions

- Tapped-delay-line multipath channel.
- Per-tap Doppler, gain, phase, and delay.
- Log-distance path loss.
- Log-normal shadow fading.
- RMS delay-spread and coherence-bandwidth analysis.
- Jakes Doppler spectrum generation.

## Architecture

```text
Frontend
  -> API Gateway (FastAPI REST/WebSocket)
  -> Simulation Engine
  -> DSP Engine
  -> Wireless Channel Engine
  -> Analytics Engine
  -> AI Assistant
  -> Database
  -> Export System
```

The first milestone keeps simulation execution in-process for correctness and testability. Celery/Redis can be introduced as a worker boundary once long-running simulation batches are added.

## Install

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
```

## Run

```bash
uvicorn wavecore.api.main:app --reload --host 127.0.0.1 --port 8001
```

## Showcase Website

The official Figma-exported product website is in `website/`. Run its Vite server separately from the simulator:

```cmd
cd website
npm install
npm run dev -- --host 127.0.0.1 --port 5180
```

Open `http://127.0.0.1:5180/`. The showcase expects the API on port `8001` and simulator UI on port `5174`. Its performance section requests a real simulation through the website's `/api` proxy.

## Test

```bash
pytest
```

## Verification (2026-09-26)

- `pytest -q -rA`: 41 passed, including REST and WebSocket integration tests.
- `node --test frontend/src/app/api/traceData.test.mjs frontend/src/app/api/encodingPreview.test.mjs`: 9 passed, including current-run and missing/malformed trace cases for all three connected charts.
- `npm run build` (from `frontend/`): succeeded; Vite reports existing esbuild-option deprecation warnings.
- Runtime smoke check: frontend returned HTTP 200; a seeded QPSK API run recovered its input with CRC true and BER 0.0, and an unsupported LDPC request returned HTTP 422. These are finite software-simulation checks, not RF or standards validation.
- No browser E2E or frontend typecheck/lint script is configured.

## Example

```bash
curl -X POST http://127.0.0.1:8000/api/v1/simulations/run ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"WaveCore X\",\"modulation\":\"QPSK\",\"snr_db\":30}"
```
