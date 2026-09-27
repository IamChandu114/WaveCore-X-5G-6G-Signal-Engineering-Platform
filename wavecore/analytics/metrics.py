import numpy as np


def bit_error_rate(tx_bits: np.ndarray, rx_bits: np.ndarray) -> float:
    tx, rx = _align(tx_bits, rx_bits)
    if tx.size == 0:
        return 0.0
    return float(np.mean(tx != rx))


def symbol_error_rate(tx_symbols: np.ndarray, rx_symbols: np.ndarray, tolerance: float = 1e-6) -> float:
    tx, rx = _align(tx_symbols, rx_symbols)
    if tx.size == 0:
        return 0.0
    return float(np.mean(np.abs(tx - rx) > tolerance))


def evm_percent(reference: np.ndarray, measured: np.ndarray) -> float:
    ref, meas = _align(reference, measured)
    if ref.size == 0:
        return 0.0
    denom = np.mean(np.abs(ref) ** 2)
    if denom == 0:
        return 0.0
    rms = np.sqrt(np.mean(np.abs(meas - ref) ** 2) / denom)
    return float(rms * 100.0)


def throughput_bps(payload_bits: int, waveform_duration_ms: float) -> float:
    """Payload rate over modeled waveform duration, not compute or network throughput."""
    if waveform_duration_ms <= 0:
        return 0.0
    return float(payload_bits / (waveform_duration_ms / 1000.0))


def _align(a: np.ndarray, b: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    left = np.asarray(a)
    right = np.asarray(b)
    size = min(left.size, right.size)
    return left[:size], right[:size]
