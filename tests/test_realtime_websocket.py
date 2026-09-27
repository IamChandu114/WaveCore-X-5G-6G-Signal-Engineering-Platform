from fastapi.testclient import TestClient

from wavecore.api.main import app


def test_live_websocket_streams_stage_updates_and_completion() -> None:
    client = TestClient(app)
    with client.websocket_connect("/api/v1/simulations/live") as websocket:
        websocket.send_json(
            {
                "type": "start",
                "params": {
                    "message": "Live PHY",
                    "modulation": "QPSK",
                    "equalizer": "MMSE",
                    "channel": {"model": "AWGN", "snr_db": 50},
                },
            }
        )
        started = websocket.receive_json()
        assert started["type"] == "simulation_started"
        first_stage = websocket.receive_json()
        assert first_stage["type"] == "stage_update"
        assert "metrics" in first_stage

        channel_stage = first_stage if first_stage.get("stage") == "wireless_channel" else None
        event = first_stage
        for _ in range(16):
            event = websocket.receive_json()
            if event.get("stage") == "wireless_channel":
                channel_stage = event
            if event["type"] == "simulation_completed":
                break
        assert event["type"] == "simulation_completed"
        assert event["simulation"]["recovered_message"] == "Live PHY"
        assert event["simulation"]["crc_ok"] is True
        assert channel_stage is not None
        assert channel_stage["visualization"]["waveform"] == channel_stage["data"]["visualization"]["received_waveform"]


def test_live_websocket_supports_pause_step_and_resume() -> None:
    client = TestClient(app)
    with client.websocket_connect("/api/v1/simulations/live") as websocket:
        websocket.send_json(
            {"type": "start", "params": {"message": "Step", "channel": {"snr_db": 50}}}
        )
        assert websocket.receive_json()["type"] == "simulation_started"
        assert websocket.receive_json()["type"] == "stage_update"

        websocket.send_json({"type": "pause"})
        assert websocket.receive_json()["type"] == "simulation_paused"

        websocket.send_json({"type": "step_forward"})
        stepped = websocket.receive_json()
        assert stepped["type"] == "stage_update"

        websocket.send_json({"type": "resume"})
        assert websocket.receive_json()["type"] == "simulation_resumed"
