import type { SimulationRunResponse, SimulationTraceVisualization } from "./wavecore";

export function getTraceVisualization<K extends keyof SimulationTraceVisualization>(
  result: SimulationRunResponse | null,
  stage: string,
  key: K,
): SimulationTraceVisualization[K] | undefined;
