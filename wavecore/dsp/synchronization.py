import numpy as np


def estimate_frequency_offset_from_repetition(
    first: np.ndarray, second: np.ndarray, sample_rate_hz: float
) -> float:
    a = np.asarray(first, dtype=np.complex128)
    b = np.asarray(second, dtype=np.complex128)
    if a.shape != b.shape or a.size == 0:
        raise ValueError("repeated preamble halves must be non-empty and equal length")
    phase = np.angle(np.vdot(a, b))
    return float(phase * sample_rate_hz / (2 * np.pi * a.size))


def correct_frequency_offset(
    signal: np.ndarray, frequency_offset_hz: float, sample_rate_hz: float
) -> np.ndarray:
    samples = np.asarray(signal, dtype=np.complex128)
    n = np.arange(samples.size)
    correction = np.exp(-1j * 2 * np.pi * frequency_offset_hz * n / sample_rate_hz)
    return samples * correction


def timing_synchronization(signal: np.ndarray, reference: np.ndarray) -> int:
    samples = np.asarray(signal, dtype=np.complex128)
    preamble = np.asarray(reference, dtype=np.complex128)
    if preamble.size == 0 or samples.size < preamble.size:
        raise ValueError("reference must fit inside signal")
    correlation = np.abs(np.correlate(samples, preamble, mode="valid"))
    return int(np.argmax(correlation))


def align_to_timing(signal: np.ndarray, start_index: int, frame_length: int) -> np.ndarray:
    samples = np.asarray(signal, dtype=np.complex128)
    if start_index < 0 or frame_length <= 0:
        raise ValueError("start_index must be non-negative and frame_length must be positive")
    end = start_index + frame_length
    if end > samples.size:
        padded = np.zeros(frame_length, dtype=np.complex128)
        available = samples[start_index:]
        padded[: available.size] = available
        return padded
    return samples[start_index:end]


def carrier_phase_recovery(
    symbols: np.ndarray, reference_symbols: np.ndarray | None = None, modulation_order: int = 4
) -> tuple[np.ndarray, float]:
    rx = np.asarray(symbols, dtype=np.complex128)
    if rx.size == 0:
        return rx.copy(), 0.0
    if reference_symbols is not None:
        ref = np.asarray(reference_symbols, dtype=np.complex128)
        if ref.shape != rx.shape:
            raise ValueError("reference_symbols must match symbols shape")
        phase = np.angle(np.vdot(ref, rx))
    else:
        if modulation_order <= 0:
            raise ValueError("modulation_order must be positive")
        phase = np.angle(np.mean(rx**modulation_order)) / modulation_order
    return rx * np.exp(-1j * phase), float(phase)


def detect_pilot_positions(grid: np.ndarray, pilot_value: complex = 1 + 0j, threshold: float = 0.2) -> np.ndarray:
    resource_grid = np.asarray(grid, dtype=np.complex128)
    if resource_grid.ndim != 2:
        raise ValueError("grid must be a 2D resource grid")
    distance = np.mean(np.abs(resource_grid - pilot_value), axis=0)
    return np.where(distance <= threshold)[0].astype(int)
