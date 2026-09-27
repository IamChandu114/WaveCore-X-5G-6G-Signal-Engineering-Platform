import numpy as np

from wavecore.domain.entities import ChannelParameters
from wavecore.domain.enums import ChannelModel


def apply_wireless_channel(
    waveform: np.ndarray, params: ChannelParameters, rng: np.random.Generator
) -> tuple[np.ndarray, np.ndarray]:
    signal = np.asarray(waveform, dtype=np.complex128)
    impaired = _apply_frequency_offset(signal, params)
    impaired = _apply_timing_offset(impaired, params.timing_offset_samples)
    fading = _fading_coefficients(impaired.size, params, rng)
    faded = impaired * fading
    return _add_awgn(faded, params.snr_db, rng), fading


def _add_awgn(signal: np.ndarray, snr_db: float, rng: np.random.Generator) -> np.ndarray:
    power = np.mean(np.abs(signal) ** 2) if signal.size else 0.0
    if power == 0:
        return signal.copy()
    snr_linear = 10 ** (snr_db / 10)
    noise_power = power / snr_linear
    noise = np.sqrt(noise_power / 2) * (
        rng.standard_normal(signal.shape) + 1j * rng.standard_normal(signal.shape)
    )
    return signal + noise


def _fading_coefficients(
    size: int, params: ChannelParameters, rng: np.random.Generator
) -> np.ndarray:
    if params.model == ChannelModel.AWGN:
        coeff = np.ones(size, dtype=np.complex128)
    elif params.model == ChannelModel.RAYLEIGH:
        # Flat block fading: one unit-average-power complex Gaussian gain per frame.
        gain = (rng.standard_normal() + 1j * rng.standard_normal()) / np.sqrt(2)
        coeff = np.full(size, gain, dtype=np.complex128)
    elif params.model == ChannelModel.RICIAN:
        k = max(params.rician_k_factor, 0.0)
        los = np.sqrt(k / (k + 1))
        scatter = np.sqrt(1 / (k + 1)) * (
            rng.standard_normal() + 1j * rng.standard_normal()
        ) / np.sqrt(2)
        coeff = np.full(size, los + scatter, dtype=np.complex128)
    else:
        raise ValueError(f"unsupported channel model: {params.model}")
    if params.doppler_hz:
        t = np.arange(size) / params.sample_rate_hz
        coeff = coeff * np.exp(1j * 2 * np.pi * params.doppler_hz * t)
    return coeff


def _apply_frequency_offset(signal: np.ndarray, params: ChannelParameters) -> np.ndarray:
    if not params.frequency_offset_hz:
        return signal.copy()
    t = np.arange(signal.size) / params.sample_rate_hz
    return signal * np.exp(1j * 2 * np.pi * params.frequency_offset_hz * t)


def _apply_timing_offset(signal: np.ndarray, offset: int) -> np.ndarray:
    if offset == 0:
        return signal.copy()
    if offset > 0:
        return np.concatenate([np.zeros(offset, dtype=np.complex128), signal])[: signal.size]
    return np.concatenate([signal[-offset:], np.zeros(-offset, dtype=np.complex128)])
