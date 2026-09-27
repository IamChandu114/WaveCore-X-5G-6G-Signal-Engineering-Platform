from fastapi.testclient import TestClient

from wavecore.api.main import app


def test_health_endpoint() -> None:
    client = TestClient(app)
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_run_simulation_endpoint() -> None:
    client = TestClient(app)
    response = client.post(
        "/api/v1/simulations/run",
        json={"message": "WaveCore X", "modulation": "QPSK", "channel": {"snr_db": 60}},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["recovered_message"] == "WaveCore X"
    assert body["crc_ok"] is True
    traces = {item["name"]: item["data"] for item in body["traces"]}
    tx = traces["wireless_channel"]["visualization"]["transmitted_waveform"]
    rx = traces["wireless_channel"]["visualization"]["received_waveform"]
    assert tx["sample_count"] == rx["sample_count"]
    assert 0 < len(tx["samples"]) <= 256
    assert len(rx["samples"]) <= 256


def test_run_endpoint_applies_uncorrected_cfo_and_timing_controls() -> None:
    client = TestClient(app)
    response = client.post(
        "/api/v1/simulations/run",
        json={
            "message": "offsets",
            "random_seed": 11,
            "channel": {
                "snr_db": 80,
                "frequency_offset_hz": 80000,
                "timing_offset_samples": 3,
            },
        },
    )
    assert response.status_code == 200
    traces = {item["name"]: item["data"] for item in response.json()["traces"]}
    channel_trace = traces["wireless_channel"]["visualization"]
    assert channel_trace["transmitted_waveform"] != channel_trace["received_waveform"]


def test_capabilities_endpoint_reports_end_to_end_supported_options() -> None:
    client = TestClient(app)
    response = client.get("/api/v1/capabilities")
    assert response.status_code == 200
    body = response.json()
    assert body["coding"] == ["HAMMING74"]
    assert "MMSE" in body["equalizers"]
    assert "waveform_iq" in body["visualizations"]


def test_api_rejects_coding_module_not_integrated_in_pipeline() -> None:
    client = TestClient(app)
    response = client.post(
        "/api/v1/simulations/run",
        json={"message": "unsupported", "coding": "LDPC"},
    )
    assert response.status_code == 422


def test_api_rejects_non_power_of_two_fft_before_simulation() -> None:
    client = TestClient(app)
    response = client.post(
        "/api/v1/simulations/run",
        json={"message": "invalid", "ofdm": {"fft_size": 24}},
    )
    assert response.status_code == 422


def test_api_rejects_frequency_offset_at_or_above_nyquist() -> None:
    client = TestClient(app)
    response = client.post(
        "/api/v1/simulations/run",
        json={"message": "invalid offset", "channel": {"frequency_offset_hz": 8_000_000}},
    )
    assert response.status_code == 422
