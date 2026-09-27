import asyncio
from typing import Any

from wavecore.api.schemas import SimulationRunResponse
from wavecore.domain.entities import SimulationResult, StageTrace
from wavecore.simulation.engine import SimulationEngine


STAGE_TO_UI_INDEX = {
    "binary_encoding": 1,
    "channel_coding": 1,
    "modulation": 2,
    "wireless_channel": 4,
    "equalization": 5,
    "analytics": 7,
}


class LiveSimulationSession:
    """Stage-by-stage playback controller for one WebSocket connection."""

    def __init__(self, engine: SimulationEngine | None = None) -> None:
        self.engine = engine or SimulationEngine()
        self.result: SimulationResult | None = None
        self.cursor = 0
        self.paused = False
        self.stopped = False
        self.playback_speed = 1.0

    def start(self, params: Any) -> dict[str, Any]:
        self.result = self.engine.run(params)
        self.cursor = 0
        self.paused = False
        self.stopped = False
        return {
            "type": "simulation_started",
            "simulation_id": self.result.simulation_id,
            "stage_count": len(self.result.traces),
            "metrics": self.result.metrics,
        }

    def pause(self) -> dict[str, Any]:
        self.paused = True
        return {"type": "simulation_paused", "cursor": self.cursor}

    def resume(self) -> dict[str, Any]:
        self.paused = False
        return {"type": "simulation_resumed", "cursor": self.cursor}

    def stop(self) -> dict[str, Any]:
        self.stopped = True
        return {"type": "simulation_stopped", "cursor": self.cursor}

    def replay(self) -> dict[str, Any]:
        self.cursor = 0
        self.paused = False
        self.stopped = False
        return {"type": "simulation_replay", "cursor": self.cursor}

    def set_speed(self, value: float) -> dict[str, Any]:
        self.playback_speed = min(max(float(value), 0.25), 4.0)
        return {"type": "playback_speed_updated", "playback_speed": self.playback_speed}

    def step_forward(self) -> dict[str, Any]:
        if self.result is None:
            return {"type": "simulation_idle"}
        self.cursor = min(self.cursor + 1, len(self.result.traces))
        if self.cursor == 0:
            return {"type": "simulation_idle"}
        return self.stage_event(self.result.traces[self.cursor - 1], self.cursor - 1)

    def step_backward(self) -> dict[str, Any]:
        if self.result is None:
            return {"type": "simulation_idle"}
        self.cursor = max(self.cursor - 1, 0)
        if self.cursor == 0:
            return {"type": "simulation_rewound", "cursor": self.cursor}
        return self.stage_event(self.result.traces[self.cursor - 1], self.cursor - 1)

    def next_event(self) -> dict[str, Any]:
        if self.result is None:
            return {"type": "simulation_idle"}
        if self.cursor >= len(self.result.traces):
            return self.completed_event()
        event = self.stage_event(self.result.traces[self.cursor], self.cursor)
        self.cursor += 1
        return event

    def completed_event(self) -> dict[str, Any]:
        if self.result is None:
            return {"type": "simulation_idle"}
        return {
            "type": "simulation_completed",
            "simulation": SimulationRunResponse.model_validate(
                self.result, from_attributes=True
            ).model_dump(),
        }

    def stage_event(self, trace: StageTrace, index: int) -> dict[str, Any]:
        metrics = self.result.metrics if self.result else {}
        return {
            "type": "stage_update",
            "cursor": index,
            "stage": trace.name,
            "ui_stage_index": STAGE_TO_UI_INDEX.get(trace.name, min(index, 7)),
            "summary": trace.summary,
            "data": trace.data,
            "metrics": metrics,
            "visualization": self.visualization_payload(trace),
        }

    def visualization_payload(self, trace: StageTrace) -> dict[str, Any]:
        data = trace.data if isinstance(trace.data, dict) else {}
        visualization = data.get("visualization", {})
        return {
            "constellation": visualization.get("equalized_constellation")
            or visualization.get("detected_constellation")
            or visualization.get("transmitted_constellation"),
            "waveform": visualization.get("received_waveform"),
            "ofdm": visualization.get("resource_grid"),
            "fading_coefficients": visualization.get("fading_coefficients"),
        }

    async def stream(self, websocket: Any, command_queue: asyncio.Queue[dict[str, Any]]) -> None:
        if self.result is None:
            await websocket.send_json({"type": "simulation_idle"})
            return
        while not self.stopped:
            if self.paused:
                command = await command_queue.get()
                await websocket.send_json(self.apply_command(command))
                continue
            event = self.next_event()
            await websocket.send_json(event)
            if event["type"] == "simulation_completed":
                return
            delay = 0.65 / self.playback_speed
            try:
                command = await asyncio.wait_for(command_queue.get(), timeout=delay)
                await websocket.send_json(self.apply_command(command))
            except asyncio.TimeoutError:
                continue

    def apply_command(self, command: dict[str, Any]) -> dict[str, Any]:
        command_type = command.get("type")
        if command_type == "pause":
            return self.pause()
        if command_type == "resume":
            return self.resume()
        if command_type == "stop":
            return self.stop()
        if command_type == "replay":
            return self.replay()
        if command_type == "step_forward":
            self.paused = True
            return self.step_forward()
        if command_type == "step_backward":
            self.paused = True
            return self.step_backward()
        if command_type == "set_speed":
            return self.set_speed(float(command.get("playback_speed", 1.0)))
        return {"type": "unknown_command", "command": command_type}
