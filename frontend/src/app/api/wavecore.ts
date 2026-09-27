export type FrontendModScheme = "BPSK" | "QPSK" | "16-QAM" | "64-QAM";

export interface SimulationParams {
  message: string;
  scheme: FrontendModScheme;
  snrDb: number;
  numCarriers: number;
  cpLength: number;
  frequencyOffsetHz: number;
  timingOffsetSamples: number;
}

export interface StageTrace {
  name: string;
  summary: string;
  data: Record<string, unknown> & { visualization?: SimulationTraceVisualization };
}

export interface ComplexTracePreview {
  sample_count: number;
  indices: number[];
  samples: { re: number; im: number }[];
}

export interface GridTracePreview extends ComplexTracePreview {
  shape: [number, number];
}

export interface SimulationTraceVisualization {
  transmitted_waveform?: ComplexTracePreview;
  received_waveform?: ComplexTracePreview;
  fading_coefficients?: ComplexTracePreview;
  transmitted_constellation?: ComplexTracePreview;
  detected_constellation?: ComplexTracePreview;
  equalized_constellation?: ComplexTracePreview;
  channel_estimate?: ComplexTracePreview;
  resource_grid?: GridTracePreview;
}

export interface SimulationRunResponse {
  simulation_id: string;
  input_message: string;
  recovered_message: string;
  crc_ok: boolean;
  metrics: Record<string, number | string | boolean>;
  traces: StageTrace[];
}

export type LiveSimulationEvent =
  | {
      type: "simulation_started";
      simulation_id: string;
      stage_count: number;
      metrics: Record<string, number | string | boolean>;
    }
  | {
      type: "stage_update";
      cursor: number;
      stage: string;
      ui_stage_index: number;
      summary: string;
      data: StageTrace["data"];
      metrics: Record<string, number | string | boolean>;
      visualization: {
        constellation: ComplexTracePreview | null;
        waveform: ComplexTracePreview | null;
        ofdm: GridTracePreview | null;
        fading_coefficients: ComplexTracePreview | null;
      };
    }
  | { type: "simulation_completed"; simulation: SimulationRunResponse }
  | { type: "simulation_paused"; cursor: number }
  | { type: "simulation_resumed"; cursor: number }
  | { type: "simulation_stopped"; cursor: number }
  | { type: "simulation_replay"; cursor: number }
  | { type: "simulation_rewound"; cursor: number }
  | { type: "playback_speed_updated"; playback_speed: number }
  | { type: "simulation_idle" }
  | { type: "unknown_command"; command?: string };

export type ExplanationMap = Record<
  string,
  {
    what?: string;
    math?: string;
    industrial_usage?: string;
    qualcomm_relevance?: string;
    advantages?: string[];
    limitations?: string[];
    interview_questions?: string[];
    common_mistakes?: string[];
  }
>;

const API_BASE = import.meta.env.VITE_WAVECORE_API_URL ?? "";

const modulationMap: Record<FrontendModScheme, string> = {
  BPSK: "BPSK",
  QPSK: "QPSK",
  "16-QAM": "16QAM",
  "64-QAM": "64QAM",
};

function simulationPayload(params: SimulationParams) {
  return {
      message: params.message || " ",
      modulation: modulationMap[params.scheme],
      coding: "HAMMING74",
      equalizer: "MMSE",
      channel: {
        model: "AWGN",
        snr_db: params.snrDb,
        frequency_offset_hz: params.frequencyOffsetHz,
        timing_offset_samples: params.timingOffsetSamples,
      },
      ofdm: {
        fft_size: params.numCarriers,
        cyclic_prefix: Math.min(params.cpLength, params.numCarriers - 1),
        pilot_spacing: 4,
      },
      random_seed: 7,
    };
}

export async function runSimulation(params: SimulationParams): Promise<SimulationRunResponse> {
  const response = await fetch(`${API_BASE}/api/v1/simulations/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(simulationPayload(params)),
  });

  if (!response.ok) {
    throw new Error(`WaveCore API returned ${response.status}`);
  }
  return response.json();
}

export function openLiveSimulation(params: SimulationParams): WebSocket {
  const explicitBase = import.meta.env.VITE_WAVECORE_WS_URL as string | undefined;
  const defaultBase = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;
  const socket = new WebSocket(`${explicitBase ?? defaultBase}/api/v1/simulations/live`);
  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({ type: "start", params: simulationPayload(params) }));
  });
  return socket;
}

export async function getExplanations(): Promise<ExplanationMap> {
  const response = await fetch(`${API_BASE}/api/v1/explanations`);
  if (!response.ok) {
    throw new Error(`WaveCore explanations returned ${response.status}`);
  }
  return response.json();
}
