from math import erfc, sqrt

import numpy as np

from wavecore.domain.entities import ChannelParameters, OfdmParameters, SimulationParameters
from wavecore.domain.enums import ChannelModel, ModulationScheme
from wavecore.dsp.channel import _fading_coefficients, apply_wireless_channel
from wavecore.dsp.modulation import demodulate, modulate
from wavecore.dsp.ofdm import data_indices, ofdm_demodulate, ofdm_modulate
from wavecore.simulation.engine import SimulationEngine


def test_zero_prefix_ofdm_round_trip_does_not_duplicate_symbol() -> None:
    params = OfdmParameters(fft_size=16, cyclic_prefix=0, pilot_spacing=4)
    source = np.array([1 + 1j, -1 + 1j, 1 - 1j], dtype=np.complex128)
    waveform, pad = ofdm_modulate(source, params)
    grid = ofdm_demodulate(waveform, params)
    recovered = grid[:, data_indices(params)].reshape(-1)
    if pad:
        recovered = recovered[:-pad]
    assert waveform.size == 16
    assert np.allclose(recovered, source)


def test_noiseless_pipeline_recovers_all_supported_modulations() -> None:
    for scheme in ModulationScheme:
        result = SimulationEngine().run(
            SimulationParameters(
                message="Wü X",
                modulation=scheme,
                channel=ChannelParameters(snr_db=200),
                ofdm=OfdmParameters(fft_size=64, cyclic_prefix=0),
                random_seed=81,
            )
        )
        assert result.recovered_message == "Wü X"
        assert result.crc_ok
        assert result.metrics["ber"] == 0.0
        assert result.metrics["coding_scheme"] == "HAMMING74"


def test_bpsk_awgn_ber_matches_analytical_reference() -> None:
    bits = np.random.default_rng(19).integers(0, 2, 200_000, dtype=np.uint8)
    symbols, pad = modulate(bits, ModulationScheme.BPSK)
    snr_db = 3.0
    received, _ = apply_wireless_channel(
        symbols,
        ChannelParameters(model=ChannelModel.AWGN, snr_db=snr_db),
        np.random.default_rng(23),
    )
    observed = float(np.mean(bits != demodulate(received, ModulationScheme.BPSK, pad)))
    expected = 0.5 * erfc(sqrt(10 ** (snr_db / 10)))
    assert abs(observed - expected) < 0.002


def test_flat_rayleigh_fading_is_repeatable_for_fixed_seed() -> None:
    params = ChannelParameters(model=ChannelModel.RAYLEIGH)
    first = _fading_coefficients(512, params, np.random.default_rng(47))
    second = _fading_coefficients(512, params, np.random.default_rng(47))
    assert np.array_equal(first, second)
    assert np.all(first == first[0])


def test_pipeline_returns_bounded_traces_from_actual_run_arrays() -> None:
    result = SimulationEngine().run(
        SimulationParameters(
            message="bounded trace payload " * 30,
            modulation=ModulationScheme.QPSK,
            channel=ChannelParameters(snr_db=25),
            ofdm=OfdmParameters(fft_size=64, cyclic_prefix=16),
            random_seed=73,
        )
    )
    traces = {trace.name: trace.data for trace in result.traces}
    tx_grid = traces["ofdm_transmit"]["visualization"]["resource_grid"]
    tx_wave = traces["wireless_channel"]["visualization"]["transmitted_waveform"]
    rx_wave = traces["wireless_channel"]["visualization"]["received_waveform"]
    response = traces["wireless_channel"]["visualization"]["fading_coefficients"]
    tx_symbols = traces["demodulation"]["visualization"]["transmitted_constellation"]
    rx_symbols = traces["equalization"]["visualization"]["equalized_constellation"]

    for trace in (tx_grid, tx_wave, rx_wave, response, tx_symbols, rx_symbols):
        assert 0 < len(trace["samples"]) <= 256
        assert len(trace["samples"]) == len(trace["indices"])
        assert trace["indices"][0] == 0
        assert trace["indices"][-1] == trace["sample_count"] - 1
        assert all(np.isfinite([sample["re"], sample["im"]]).all() for sample in trace["samples"])
    assert tx_grid["sample_count"] == np.prod(tx_grid["shape"])
    assert np.allclose([tx_grid["samples"][0]["re"], tx_grid["samples"][0]["im"]], [1.0, 0.0], atol=1e-12)
    assert tx_wave["sample_count"] == rx_wave["sample_count"] == response["sample_count"]


def test_frequency_and_timing_controls_change_received_trace_not_transmit_trace() -> None:
    base = SimulationParameters(
        message="impairment test",
        modulation=ModulationScheme.QPSK,
        channel=ChannelParameters(snr_db=80),
        ofdm=OfdmParameters(fft_size=64, cyclic_prefix=16),
        random_seed=101,
    )
    impaired = SimulationParameters(
        message=base.message,
        modulation=base.modulation,
        channel=ChannelParameters(
            snr_db=base.channel.snr_db,
            frequency_offset_hz=80_000,
            timing_offset_samples=3,
        ),
        ofdm=base.ofdm,
        random_seed=base.random_seed,
    )
    baseline_result = SimulationEngine().run(base)
    impaired_result = SimulationEngine().run(impaired)
    def traces(result):
        return {trace.name: trace.data for trace in result.traces}

    baseline_viz = traces(baseline_result)["wireless_channel"]["visualization"]
    impaired_viz = traces(impaired_result)["wireless_channel"]["visualization"]
    assert baseline_viz["transmitted_waveform"] == impaired_viz["transmitted_waveform"]
    assert baseline_viz["received_waveform"] != impaired_viz["received_waveform"]
