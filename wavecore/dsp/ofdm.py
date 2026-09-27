import numpy as np

from wavecore.domain.entities import OfdmParameters


PILOT_VALUE = 1 + 0j


def pilot_indices(params: OfdmParameters) -> np.ndarray:
    params.validate()
    return np.arange(0, params.fft_size, params.pilot_spacing, dtype=int)


def data_indices(params: OfdmParameters) -> np.ndarray:
    pilots = set(pilot_indices(params).tolist())
    return np.asarray([idx for idx in range(params.fft_size) if idx not in pilots], dtype=int)


def ofdm_modulate(symbols: np.ndarray, params: OfdmParameters) -> tuple[np.ndarray, int]:
    params.validate()
    data_bins = data_indices(params)
    symbols = np.asarray(symbols, dtype=np.complex128)
    symbols_per_ofdm = data_bins.size
    pad_symbols = (-symbols.size) % symbols_per_ofdm
    if pad_symbols:
        symbols = np.concatenate([symbols, np.zeros(pad_symbols, dtype=np.complex128)])
    grid = np.zeros((symbols.size // symbols_per_ofdm, params.fft_size), dtype=np.complex128)
    grid[:, pilot_indices(params)] = PILOT_VALUE
    grid[:, data_bins] = symbols.reshape(-1, symbols_per_ofdm)
    time_domain = np.fft.ifft(grid, axis=1)
    cp = (
        time_domain[:, -params.cyclic_prefix :]
        if params.cyclic_prefix
        else time_domain[:, :0]
    )
    with_cp = np.concatenate([cp, time_domain], axis=1)
    return with_cp.reshape(-1), pad_symbols


def ofdm_demodulate(waveform: np.ndarray, params: OfdmParameters) -> np.ndarray:
    params.validate()
    symbol_len = params.fft_size + params.cyclic_prefix
    usable = (np.asarray(waveform).size // symbol_len) * symbol_len
    if usable == 0:
        return np.empty((0, params.fft_size), dtype=np.complex128)
    frames = np.asarray(waveform, dtype=np.complex128)[:usable].reshape(-1, symbol_len)
    no_cp = frames[:, params.cyclic_prefix :]
    return np.fft.fft(no_cp, axis=1)


def estimate_channel_from_pilots(rx_grid: np.ndarray, params: OfdmParameters) -> np.ndarray:
    pilots = pilot_indices(params)
    pilot_estimates = rx_grid[:, pilots] / PILOT_VALUE
    full = np.empty_like(rx_grid, dtype=np.complex128)
    x = np.arange(params.fft_size)
    for row_idx, row in enumerate(pilot_estimates):
        real = np.interp(x, pilots, np.real(row))
        imag = np.interp(x, pilots, np.imag(row))
        full[row_idx] = real + 1j * imag
    return full


def zero_forcing_equalize(rx_grid: np.ndarray, channel_estimate: np.ndarray) -> np.ndarray:
    safe = np.where(np.abs(channel_estimate) < 1e-9, 1 + 0j, channel_estimate)
    return rx_grid / safe


def extract_data_symbols(equalized_grid: np.ndarray, params: OfdmParameters, pad_symbols: int = 0) -> np.ndarray:
    symbols = equalized_grid[:, data_indices(params)].reshape(-1)
    if pad_symbols:
        symbols = symbols[:-pad_symbols]
    return symbols
