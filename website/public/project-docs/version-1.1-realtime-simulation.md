# WaveCore X Version 1.1 - Real-Time Interactive Simulation

## Architecture Changes

Version 1.1 adds a real-time WebSocket playback controller on top of the existing deterministic `SimulationEngine`.

New module:
```text
wavecore/simulation/realtime.py
```

The existing REST simulation API remains unchanged. The WebSocket endpoint now supports command-driven stage streaming.

## WebSocket Endpoint

```text
ws://127.0.0.1:8001/api/v1/simulations/live
```

## Commands

Start:

```json
{
  "type": "start",
  "params": {
    "message": "WaveCore X",
    "modulation": "QPSK",
    "equalizer": "MMSE",
    "channel": {"model": "AWGN", "snr_db": 30}
  }
}
```

Playback:

```json
{"type": "pause"}
{"type": "resume"}
{"type": "stop"}
{"type": "replay"}
{"type": "step_forward"}
{"type": "step_backward"}
{"type": "set_speed", "playback_speed": 2.0}
```

## Events

```json
{"type": "simulation_started"}
{"type": "stage_update"}
{"type": "simulation_paused"}
{"type": "simulation_resumed"}
{"type": "simulation_completed"}
```

Each `stage_update` contains:

- stage name
- UI stage index
- stage summary
- stage data
- live metrics
- visualization payload for constellation, waveform, and OFDM views

## Engineering Decision

The real-time layer does not recompute partial DSP states independently. It uses the validated simulation result and streams the trace deterministically. This keeps the numerical engine stable while enabling interactive playback, replay, step, pause, and speed control.

## Verification

```cmd
pytest
npm run build
```

Version 1.1 is complete when all tests pass and the frontend build succeeds.
