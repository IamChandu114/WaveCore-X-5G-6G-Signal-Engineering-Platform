import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from wavecore.api.schemas import SimulationRunRequest, SimulationRunResponse
from wavecore.domain.entities import ChannelParameters, OfdmParameters, SimulationParameters
from wavecore.domain.enums import ChannelModel, CodingScheme, EqualizerType, ModulationScheme
from wavecore.explanations.catalog import get_stage_explanations
from wavecore.simulation.engine import SimulationEngine
from wavecore.simulation.realtime import LiveSimulationSession

router = APIRouter(prefix="/api/v1")


def _to_domain(request: SimulationRunRequest) -> SimulationParameters:
    return SimulationParameters(
        message=request.message,
        modulation=request.modulation,
        coding=request.coding,
        equalizer=request.equalizer,
        channel=ChannelParameters(**request.channel.model_dump()),
        ofdm=OfdmParameters(**request.ofdm.model_dump()),
        random_seed=request.random_seed,
    )


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "wavecore-x-backend"}


@router.get("/explanations")
def explanations() -> dict[str, dict[str, object]]:
    return get_stage_explanations()


@router.get("/capabilities")
def capabilities() -> dict[str, list[str]]:
    return {
        "modulation": [item.value for item in ModulationScheme],
        "channel_models": [item.value for item in ChannelModel],
        "coding": [CodingScheme.HAMMING74.value],
        "equalizers": [item.value for item in EqualizerType],
        "visualizations": [
            "waveform_iq",
            "constellation",
            "ofdm_resource_grid",
            "fading_coefficients",
        ],
    }


@router.post("/simulations/run", response_model=SimulationRunResponse)
def run_simulation(request: SimulationRunRequest) -> SimulationRunResponse:
    result = SimulationEngine().run(_to_domain(request))
    return SimulationRunResponse.model_validate(result, from_attributes=True)


@router.websocket("/simulations/live")
async def live_simulation(websocket: WebSocket) -> None:
    await websocket.accept()
    session = LiveSimulationSession()
    try:
        while True:
            payload = await websocket.receive_json()
            command_type = payload.get("type", "start")
            if command_type == "start":
                request_payload = payload.get("params", payload)
                request = SimulationRunRequest.model_validate(request_payload)
                await websocket.send_json(session.start(_to_domain(request)))
                command_queue: asyncio.Queue[dict] = asyncio.Queue()

                async def receive_commands() -> None:
                    while True:
                        command_queue.put_nowait(await websocket.receive_json())

                reader = asyncio.create_task(receive_commands())
                try:
                    await session.stream(websocket, command_queue)
                finally:
                    reader.cancel()
            else:
                await websocket.send_json(session.apply_command(payload))
    except WebSocketDisconnect:
        return
