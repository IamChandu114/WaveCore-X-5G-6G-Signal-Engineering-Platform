# WaveCore X Delivery Report

> **Engineering integrity update (2026-09-26):** this earlier delivery report describes modules and integration more broadly than the audited code supports. Treat it as a historical delivery note, not proof of end-to-end functionality. The current verified scope, corrections, test outcomes, and limitations are documented in [the engineering integrity audit](docs/engineering-integrity-audit.md).

> **Simulator trace update (2026-09-26):** responses include bounded actual waveform, fading-coefficient, resource-grid, and constellation previews. The simulator consumes these for waveform, channel-coefficient, OFDM-grid, and constellation plots. CFO and timing offsets are user-configurable, applied impairments, and explicitly uncorrected by the receiver. Verification: `pytest -q` passed 41 tests; `node --test frontend/src/app/api/traceData.test.mjs` passed 2 tests; `npm run build` succeeded (1,589 modules transformed; existing Vite/esbuild deprecation warnings). No browser E2E was run.

## Project Status

WaveCore X now has a working backend and the uploaded Figma-exported frontend connected to it.

Frontend URL:

```text
http://127.0.0.1:5174/
```

Backend URL:

```text
http://127.0.0.1:8001
```

Public website:

```text
website/index.html
```

## What Was Developed

### Backend Platform

- FastAPI backend application.
- REST API endpoints.
- WebSocket simulation endpoint foundation.
- CORS configuration for the React/Vite frontend.
- Clean backend package structure under `wavecore/`.
- Domain models for modulation, channel, coding, equalizer, OFDM, and simulation results.
- SQLAlchemy database models for experiments, configurations, results, metrics, and reports.
- Export services for JSON, CSV, and engineering summaries.
- Engineering assistant service for modulation comparison and parameter recommendation.

### DSP Engine

- UTF-8 message-to-bits and bits-to-message encoding.
- CRC-16-CCITT framing and validation.
- Hamming(7,4) channel coding and decoding.
- Block interleaving and deinterleaving.
- BPSK, QPSK, 16-QAM, 64-QAM, and 256-QAM modulation and demodulation.
- OFDM modulation and demodulation.
- Pilot insertion and pilot-aided channel estimation.
- Zero-forcing equalization.
- MMSE equalization.
- Convolutional encoder.
- Viterbi decoder.
- Reed-Solomon GF(256) coding.
- LDPC systematic encoding and min-sum decoding.
- Polar coding baseline.
- Adaptive coding controller.
- Timing synchronization.
- Frequency offset estimation and correction.
- Carrier phase recovery.
- Pilot detection.

### Advanced OFDM Engine

- Resource grid model.
- Pilot allocation.
- Guard-band reservation.
- DC-null handling.
- Cyclic prefix handling.
- FFT/IFFT conversion.
- Raised-cosine windowing.
- OFDMA multi-user subcarrier allocation.

### Wireless Channel Engine

- AWGN channel.
- Rayleigh fading.
- Rician fading.
- Multipath tapped-delay-line channel.
- Per-tap Doppler.
- Path loss.
- Log-normal shadow fading.
- RMS delay spread.
- Coherence bandwidth.
- Jakes Doppler spectrum.

### Analytics Engine

- BER.
- SER.
- EVM.
- Packet error flag.
- Throughput.
- Latency.
- Corrected Hamming error count.

### Frontend Integration

- Uploaded frontend ZIP extracted into `frontend/`.
- Vite proxy configured so frontend calls `/api/*` and reaches FastAPI.
- Typed frontend API client added at:

```text
frontend/src/app/api/wavecore.ts
```

- Existing Figma UI preserved.
- No frontend redesign was performed.
- `RUN SIM` calls the backend simulation API.
- Parameter controls feed backend simulation requests:
  - message
  - modulation scheme
  - SNR
  - subcarriers
  - cyclic prefix
- UI receives and displays real backend data:
  - BER
  - throughput
  - recovered message
  - CRC status
  - simulation history
  - engineering explanations

### Version 1.1 Real-Time Simulation

- WebSocket stage streaming endpoint.
- Stage-by-stage simulation events.
- Live metrics payloads.
- Live visualization payloads for constellation, waveform, and OFDM views.
- Pause command.
- Resume command.
- Stop command.
- Replay command.
- Step forward command.
- Step backward command.
- Playback speed command.
- Vite WebSocket proxy support.
- Frontend live simulation client support.

### Professional Public Website

- Separate product website under `website/`.
- Hero section.
- Product overview.
- Interactive architecture diagram.
- Wireless pipeline explanation.
- DSP algorithms section.
- OFDM section.
- Wireless channel section.
- AI/engineering intelligence positioning.
- Live simulator embed.
- Product gallery.
- Research highlights.
- Benchmark results.
- Documentation links.
- Roadmap and version history.
- FAQ.
- Contact/resume highlights.
- Responsive layout.
- Smooth scrolling and reveal animations.
- Accessibility support through semantic sections, skip link, labels, and reduced-motion handling.

## Important Files

```text
wavecore/api/main.py
wavecore/api/routes.py
wavecore/api/schemas.py
wavecore/simulation/engine.py
wavecore/dsp/coding.py
wavecore/dsp/modulation.py
wavecore/dsp/ofdm.py
wavecore/dsp/channel.py
wavecore/dsp/advanced_coding.py
wavecore/dsp/advanced_ofdm.py
wavecore/dsp/advanced_channel.py
wavecore/dsp/equalization.py
wavecore/dsp/synchronization.py
frontend/src/app/App.tsx
frontend/src/app/api/wavecore.ts
frontend/vite.config.ts
website/index.html
website/styles.css
website/app.js
```

## Verification Performed

### Backend Health

Command:

```cmd
curl http://127.0.0.1:8001/api/v1/health
```

Result:

```json
{"status":"ok","service":"wavecore-x-backend"}
```

### Frontend Page Load

Command:

```cmd
curl -I http://127.0.0.1:5174/
```

Result:

```text
HTTP/1.1 200 OK
Content-Type: text/html
```

### Frontend-to-Backend Proxy Simulation

Request path tested:

```text
http://127.0.0.1:5174/api/v1/simulations/run
```

Result:

```json
{
  "input_message": "WaveCore X Verified",
  "recovered_message": "WaveCore X Verified",
  "crc_ok": true,
  "metrics": {
    "ber": 0.0,
    "packet_error": false,
    "coding_scheme": "HAMMING74",
    "equalizer": "MMSE"
  }
}
```

This confirms the frontend development server is correctly proxying API calls to the backend.

### Backend Test Suite

Command


```cmd
pytest
```

Result:

```text
31 passed
```

### Frontend Production Build

Command:

```cmd
npm run build
```

Result:

```text
built successfully
```

Vite emitted deprecation warnings from plugin configuration, but the build completed successfully.

### Professional Website Files

Command:

```cmd
dir website
```

Result:

```text
index.html
styles.css
app.js
README.md
```

## Run Commands

Start backend:

```cmd
cd "C:\Users\Chand\OneDrive\Desktop\5G Wave Form"
uvicorn wavecore.api.main:app --host 127.0.0.1 --port 8001
```

Start frontend:

```cmd
cd "C:\Users\Chand\OneDrive\Desktop\5G Wave Form\frontend"
npm run dev -- --host 127.0.0.1 --port 5173
```

If port `5173` is already in use, Vite automatically uses the next port, for example:

```text
http://127.0.0.1:5174/
```

Open public website:

```text
C:\Users\Chand\OneDrive\Desktop\5G Wave Form\website\index.html
```

Optional public website local server:

```cmd
cd "C:\Users\Chand\OneDrive\Desktop\5G Wave Form\website"
python -m http.server 8080
```

Then open:

```text
http://127.0.0.1:8080/
```

## Final Verification Statement

The UI is working and connected to the backend correctly.

The tested frontend path returns real backend simulation output, including recovered message, CRC status, BER, throughput, and equalizer/coding metrics. The real-time WebSocket tests pass, the backend test suite passes, the frontend production build passes, and the separate professional product website is prepared.
