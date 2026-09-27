import math

import numpy as np

from wavecore.domain.enums import ModulationScheme
from wavecore.dsp.encoding import pad_bits, unpad_bits


BITS_PER_SYMBOL = {
    ModulationScheme.BPSK: 1,
    ModulationScheme.QPSK: 2,
    ModulationScheme.QAM16: 4,
    ModulationScheme.QAM64: 6,
    ModulationScheme.QAM256: 8,
}


def bits_per_symbol(scheme: ModulationScheme) -> int:
    return BITS_PER_SYMBOL[scheme]


def modulate(bits: np.ndarray, scheme: ModulationScheme) -> tuple[np.ndarray, int]:
    bps = bits_per_symbol(scheme)
    padded, pad = pad_bits(bits, bps)
    groups = padded.reshape(-1, bps).astype(np.int16)
    if scheme == ModulationScheme.BPSK:
        return (1 - 2 * groups[:, 0]).astype(np.complex128), pad
    if scheme == ModulationScheme.QPSK:
        i = 1 - 2 * groups[:, 0]
        q = 1 - 2 * groups[:, 1]
        return ((i + 1j * q) / math.sqrt(2)).astype(np.complex128), pad
    return _qam_modulate(groups), pad


def demodulate(symbols: np.ndarray, scheme: ModulationScheme, pad: int = 0) -> np.ndarray:
    rx = np.asarray(symbols, dtype=np.complex128)
    if scheme == ModulationScheme.BPSK:
        bits = (np.real(rx) < 0).astype(np.uint8)
        return unpad_bits(bits, pad)
    if scheme == ModulationScheme.QPSK:
        bits = np.column_stack([(np.real(rx) < 0), (np.imag(rx) < 0)]).astype(np.uint8)
        return unpad_bits(bits.reshape(-1), pad)
    bits = _qam_demodulate(rx, bits_per_symbol(scheme))
    return unpad_bits(bits, pad)


def _gray_to_binary(value: int) -> int:
    mask = value
    while mask:
        mask >>= 1
        value ^= mask
    return value


def _binary_to_gray(value: int) -> int:
    return value ^ (value >> 1)


def _qam_modulate(groups: np.ndarray) -> np.ndarray:
    bps = groups.shape[1]
    side = int(math.sqrt(2**bps))
    half = bps // 2
    ints_i = groups[:, :half].dot(1 << np.arange(half - 1, -1, -1))
    ints_q = groups[:, half:].dot(1 << np.arange(half - 1, -1, -1))
    gray_i = np.vectorize(_binary_to_gray)(ints_i)
    gray_q = np.vectorize(_binary_to_gray)(ints_q)
    levels_i = 2 * gray_i - side + 1
    levels_q = 2 * gray_q - side + 1
    norm = math.sqrt((2 / 3) * (side**2 - 1))
    return ((levels_i + 1j * levels_q) / norm).astype(np.complex128)


def _qam_demodulate(symbols: np.ndarray, bps: int) -> np.ndarray:
    side = int(math.sqrt(2**bps))
    half = bps // 2
    norm = math.sqrt((2 / 3) * (side**2 - 1))
    levels = np.arange(-(side - 1), side, 2)
    scaled_i = np.real(symbols) * norm
    scaled_q = np.imag(symbols) * norm
    idx_i = np.argmin(np.abs(scaled_i[:, None] - levels[None, :]), axis=1)
    idx_q = np.argmin(np.abs(scaled_q[:, None] - levels[None, :]), axis=1)
    bin_i = np.vectorize(_gray_to_binary)(idx_i)
    bin_q = np.vectorize(_gray_to_binary)(idx_q)
    out = []
    for i_value, q_value in zip(bin_i, bin_q, strict=True):
        out.extend([(i_value >> bit) & 1 for bit in range(half - 1, -1, -1)])
        out.extend([(q_value >> bit) & 1 for bit in range(half - 1, -1, -1)])
    return np.asarray(out, dtype=np.uint8)
