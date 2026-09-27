# WaveCore X Architecture

## Design Principles

WaveCore X uses clean architecture boundaries so mathematical algorithms can be validated without the web framework, database, or frontend. The API layer owns transport concerns. The simulation engine owns orchestration. DSP, wireless channel, analytics, exports, and explanations are independent domain services.

## Package Layout

```text
wavecore/
  api/              FastAPI routers, schemas, WebSocket endpoints
  core/             configuration and dependency providers
  domain/           enums, entities, protocol-level contracts
  dsp/              signal processing and communication algorithms
  simulation/       pipeline orchestration
  analytics/        metrics and validation utilities
  explanations/     engineering explanations by stage
  infrastructure/   database, repositories, background workers
  export/           report serialization
  assistant/        engineering assistant service interface
tests/              unit, integration, and validation tests
```

## Why This Design

Communication algorithms must be deterministic, independently testable, and reusable across REST requests, WebSocket streaming, batch jobs, and future notebooks. Keeping DSP code framework-free prevents API concerns from contaminating numerical correctness.

The API currently runs a simulation synchronously. That is acceptable for short interactive runs. Future milestones should move long simulations to Celery workers while preserving the same `SimulationEngine` interface.

## Data Flow

```text
SimulationRequest
  -> SimulationEngine
  -> MessageCodec
  -> CRC/Hamming/Interleaver
  -> Modulator
  -> OFDM Modem
  -> Wireless Channel
  -> Receiver Processing
  -> Analytics Metrics
  -> SimulationResult
```

