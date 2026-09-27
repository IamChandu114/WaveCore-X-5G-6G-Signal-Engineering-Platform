import numpy as np


def block_interleave(bits: np.ndarray, rows: int = 8) -> tuple[np.ndarray, int]:
    if rows <= 1:
        return np.asarray(bits, dtype=np.uint8).copy(), 0
    arr = np.asarray(bits, dtype=np.uint8)
    pad = (-arr.size) % rows
    if pad:
        arr = np.concatenate([arr, np.zeros(pad, dtype=np.uint8)])
    matrix = arr.reshape(rows, -1)
    return matrix.T.reshape(-1).astype(np.uint8), pad


def block_deinterleave(bits: np.ndarray, rows: int = 8, pad: int = 0) -> np.ndarray:
    if rows <= 1:
        return np.asarray(bits, dtype=np.uint8).copy()
    arr = np.asarray(bits, dtype=np.uint8)
    cols = arr.size // rows
    restored = arr.reshape(cols, rows).T.reshape(-1).astype(np.uint8)
    if pad:
        restored = restored[:-pad]
    return restored

