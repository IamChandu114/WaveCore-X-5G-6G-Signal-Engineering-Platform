import numpy as np

from wavecore.dsp.advanced_channel import (
    MultipathTap,
    PathLossModel,
    add_log_normal_shadowing,
    apply_multipath_channel,
    apply_path_loss,
    coherence_bandwidth_hz,
    jakes_doppler_spectrum,
    rms_delay_spread,
)


def test_multipath_channel_applies_delayed_taps() -> None:
    waveform = np.array([1, 0, 0, 0], dtype=np.complex128)
    taps = [MultipathTap(0, 0), MultipathTap(2, -6)]
    output, impulse = apply_multipath_channel(waveform, taps, sample_rate_hz=1000)
    assert np.isclose(output[0], 1)
    assert np.isclose(output[2], 10 ** (-6 / 20))
    assert impulse.size == 3


def test_path_loss_reduces_power_with_distance() -> None:
    model = PathLossModel(reference_loss_db=30, path_loss_exponent=2)
    near, near_loss = apply_path_loss(np.ones(4), 1, model)
    far, far_loss = apply_path_loss(np.ones(4), 10, model)
    assert far_loss > near_loss
    assert np.mean(np.abs(far) ** 2) < np.mean(np.abs(near) ** 2)


def test_shadowing_is_deterministic_with_seed() -> None:
    rng_a = np.random.default_rng(7)
    rng_b = np.random.default_rng(7)
    _, shadow_a = add_log_normal_shadowing(np.ones(4), 4.0, rng_a)
    _, shadow_b = add_log_normal_shadowing(np.ones(4), 4.0, rng_b)
    assert shadow_a == shadow_b


def test_delay_spread_and_coherence_bandwidth() -> None:
    taps = [MultipathTap(0, 0), MultipathTap(10, -3)]
    spread = rms_delay_spread(taps, sample_rate_hz=1_000_000)
    assert spread > 0
    assert coherence_bandwidth_hz(spread) > 0


def test_jakes_doppler_spectrum_shape() -> None:
    freq, spectrum = jakes_doppler_spectrum(100, points=64)
    assert freq.size == 64
    assert spectrum.size == 64
    assert np.all(spectrum > 0)
