from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class MultipathTap:
    delay_samples: int
    gain_db: float
    phase_rad: float = 0.0
    doppler_hz: float = 0.0

    @property
    def complex_gain(self) -> complex:
        return 10 ** (self.gain_db / 20) * np.exp(1j * self.phase_rad)


@dataclass(frozen=True)
class PathLossModel:
    reference_loss_db: float = 32.4
    path_loss_exponent: float = 2.0
    reference_distance_m: float = 1.0

    def loss_db(self, distance_m: float) -> float:
        if distance_m <= 0:
            raise ValueError("distance_m must be positive")
        return float(
            self.reference_loss_db
            + 10 * self.path_loss_exponent * np.log10(distance_m / self.reference_distance_m)
        )


def apply_multipath_channel(
    waveform: np.ndarray,
    taps: list[MultipathTap],
    sample_rate_hz: float,
) -> tuple[np.ndarray, np.ndarray]:
    signal = np.asarray(waveform, dtype=np.complex128)
    if sample_rate_hz <= 0:
        raise ValueError("sample_rate_hz must be positive")
    if not taps:
        return signal.copy(), np.array([1 + 0j], dtype=np.complex128)
    max_delay = max(tap.delay_samples for tap in taps)
    if max_delay < 0:
        raise ValueError("tap delays must be non-negative")
    impulse = np.zeros(max_delay + 1, dtype=np.complex128)
    output = np.zeros(signal.size + max_delay, dtype=np.complex128)
    n = np.arange(signal.size)
    for tap in taps:
        if tap.delay_samples < 0:
            raise ValueError("tap delays must be non-negative")
        time_varying_gain = tap.complex_gain * np.exp(1j * 2 * np.pi * tap.doppler_hz * n / sample_rate_hz)
        contribution = signal * time_varying_gain
        output[tap.delay_samples : tap.delay_samples + signal.size] += contribution
        impulse[tap.delay_samples] += tap.complex_gain
    return output[: signal.size], impulse


def add_log_normal_shadowing(
    waveform: np.ndarray, sigma_db: float, rng: np.random.Generator
) -> tuple[np.ndarray, float]:
    if sigma_db < 0:
        raise ValueError("sigma_db must be non-negative")
    shadow_db = float(rng.normal(0.0, sigma_db))
    attenuation = 10 ** (-shadow_db / 20)
    return np.asarray(waveform, dtype=np.complex128) * attenuation, shadow_db


def apply_path_loss(waveform: np.ndarray, distance_m: float, model: PathLossModel) -> tuple[np.ndarray, float]:
    loss = model.loss_db(distance_m)
    attenuation = 10 ** (-loss / 20)
    return np.asarray(waveform, dtype=np.complex128) * attenuation, loss


def rms_delay_spread(taps: list[MultipathTap], sample_rate_hz: float) -> float:
    if sample_rate_hz <= 0:
        raise ValueError("sample_rate_hz must be positive")
    if not taps:
        return 0.0
    delays = np.asarray([tap.delay_samples / sample_rate_hz for tap in taps], dtype=np.float64)
    powers = np.asarray([abs(tap.complex_gain) ** 2 for tap in taps], dtype=np.float64)
    if np.sum(powers) == 0:
        return 0.0
    mean_delay = float(np.sum(powers * delays) / np.sum(powers))
    mean_square = float(np.sum(powers * delays**2) / np.sum(powers))
    return float(np.sqrt(max(mean_square - mean_delay**2, 0.0)))


def coherence_bandwidth_hz(delay_spread_s: float, correlation: float = 0.5) -> float:
    if delay_spread_s < 0:
        raise ValueError("delay_spread_s must be non-negative")
    if delay_spread_s == 0:
        return float("inf")
    if correlation == 0.5:
        return float(1 / (5 * delay_spread_s))
    if correlation == 0.9:
        return float(1 / (50 * delay_spread_s))
    raise ValueError("supported correlation values are 0.5 and 0.9")


def jakes_doppler_spectrum(max_doppler_hz: float, points: int = 256) -> tuple[np.ndarray, np.ndarray]:
    if max_doppler_hz <= 0:
        raise ValueError("max_doppler_hz must be positive")
    if points < 8:
        raise ValueError("points must be at least 8")
    freq = np.linspace(-max_doppler_hz, max_doppler_hz, points)
    normalized = np.clip(1 - (freq / max_doppler_hz) ** 2, 1e-12, None)
    spectrum = 1 / (np.pi * max_doppler_hz * np.sqrt(normalized))
    spectrum[0] = spectrum[1]
    spectrum[-1] = spectrum[-2]
    return freq, spectrum
