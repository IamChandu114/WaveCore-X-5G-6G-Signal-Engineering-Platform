import numpy as np


def least_squares_channel_estimate(
    received_pilots: np.ndarray, known_pilots: np.ndarray
) -> np.ndarray:
    rx = np.asarray(received_pilots, dtype=np.complex128)
    tx = np.asarray(known_pilots, dtype=np.complex128)
    if rx.shape != tx.shape:
        raise ValueError("received_pilots and known_pilots must have the same shape")
    safe = np.where(np.abs(tx) < 1e-12, 1 + 0j, tx)
    return rx / safe


def interpolate_channel_response(
    pilot_indices: np.ndarray, pilot_estimates: np.ndarray, fft_size: int
) -> np.ndarray:
    indices = np.asarray(pilot_indices, dtype=int)
    estimates = np.asarray(pilot_estimates, dtype=np.complex128)
    if indices.ndim != 1:
        raise ValueError("pilot_indices must be a 1D array")
    if estimates.shape[-1] != indices.size:
        raise ValueError("last dimension of pilot_estimates must match pilot_indices")
    x = np.arange(fft_size)
    rows = estimates.reshape(-1, indices.size)
    output = np.empty((rows.shape[0], fft_size), dtype=np.complex128)
    for row_index, row in enumerate(rows):
        real = np.interp(x, indices, np.real(row))
        imag = np.interp(x, indices, np.imag(row))
        output[row_index] = real + 1j * imag
    return output.reshape(estimates.shape[:-1] + (fft_size,))


def mmse_equalize(
    received_symbols: np.ndarray, channel_estimate: np.ndarray, noise_variance: float
) -> np.ndarray:
    y = np.asarray(received_symbols, dtype=np.complex128)
    h = np.asarray(channel_estimate, dtype=np.complex128)
    if y.shape != h.shape:
        raise ValueError("received_symbols and channel_estimate must have the same shape")
    n0 = max(float(noise_variance), 0.0)
    weights = np.conj(h) / (np.abs(h) ** 2 + n0)
    return y * weights


def estimate_noise_variance(
    received_pilots: np.ndarray, known_pilots: np.ndarray, channel_estimate: np.ndarray
) -> float:
    residual = np.asarray(received_pilots) - np.asarray(known_pilots) * np.asarray(channel_estimate)
    return float(np.mean(np.abs(residual) ** 2)) if residual.size else 0.0
