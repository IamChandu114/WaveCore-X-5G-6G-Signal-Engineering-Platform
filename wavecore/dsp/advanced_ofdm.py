from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class UserAllocation:
    user_id: str
    subcarriers: tuple[int, ...]


@dataclass(frozen=True)
class ResourceGridConfig:
    fft_size: int = 64
    symbols: int = 14
    cyclic_prefix: int = 16
    pilot_spacing_subcarriers: int = 4
    pilot_spacing_symbols: int = 4
    left_guard: int = 6
    right_guard: int = 5
    dc_null: bool = True

    def validate(self) -> None:
        if self.fft_size <= 0 or self.fft_size & (self.fft_size - 1):
            raise ValueError("fft_size must be a positive power of two")
        if self.symbols <= 0:
            raise ValueError("symbols must be positive")
        if not 0 <= self.cyclic_prefix < self.fft_size:
            raise ValueError("cyclic_prefix must be in [0, fft_size)")
        if self.left_guard < 0 or self.right_guard < 0:
            raise ValueError("guard bands must be non-negative")
        if self.left_guard + self.right_guard >= self.fft_size:
            raise ValueError("guard bands cannot consume the full FFT")
        if self.pilot_spacing_subcarriers <= 0 or self.pilot_spacing_symbols <= 0:
            raise ValueError("pilot spacing must be positive")


class ResourceGrid:
    def __init__(self, config: ResourceGridConfig) -> None:
        config.validate()
        self.config = config
        self.grid = np.zeros((config.symbols, config.fft_size), dtype=np.complex128)
        self.mask = np.full((config.symbols, config.fft_size), "data", dtype=object)
        self._apply_reserved_regions()

    @property
    def active_subcarriers(self) -> np.ndarray:
        cfg = self.config
        active = np.arange(cfg.left_guard, cfg.fft_size - cfg.right_guard)
        if cfg.dc_null:
            active = active[active != cfg.fft_size // 2]
        return active.astype(int)

    @property
    def pilot_locations(self) -> tuple[np.ndarray, np.ndarray]:
        cfg = self.config
        symbol_indices = np.arange(0, cfg.symbols, cfg.pilot_spacing_symbols)
        subcarrier_indices = self.active_subcarriers[:: cfg.pilot_spacing_subcarriers]
        return np.meshgrid(symbol_indices, subcarrier_indices, indexing="ij")

    def allocate_pilots(self, pilot_value: complex = 1 + 0j) -> None:
        rows, cols = self.pilot_locations
        self.grid[rows, cols] = pilot_value
        self.mask[rows, cols] = "pilot"

    def map_data(self, symbols: np.ndarray) -> int:
        payload = np.asarray(symbols, dtype=np.complex128)
        rows, cols = np.where(self.mask == "data")
        capacity = rows.size
        used = min(payload.size, capacity)
        self.grid[rows[:used], cols[:used]] = payload[:used]
        self.mask[rows[:used], cols[:used]] = "payload"
        return capacity - used

    def map_ofdma_users(self, user_symbols: dict[str, np.ndarray], allocations: list[UserAllocation]) -> None:
        for allocation in allocations:
            if allocation.user_id not in user_symbols:
                raise ValueError(f"missing symbols for user {allocation.user_id}")
            allowed = np.asarray(allocation.subcarriers, dtype=int)
            if np.any(allowed < 0) or np.any(allowed >= self.config.fft_size):
                raise ValueError(f"subcarrier allocation out of range for user {allocation.user_id}")
            payload = np.asarray(user_symbols[allocation.user_id], dtype=np.complex128)
            rows, cols = np.where(np.isin(np.arange(self.config.fft_size), allowed)[None, :] & (self.mask == "data"))
            used = min(payload.size, rows.size)
            self.grid[rows[:used], cols[:used]] = payload[:used]
            self.mask[rows[:used], cols[:used]] = f"user:{allocation.user_id}"

    def _apply_reserved_regions(self) -> None:
        cfg = self.config
        if cfg.left_guard:
            self.mask[:, : cfg.left_guard] = "guard"
        if cfg.right_guard:
            self.mask[:, cfg.fft_size - cfg.right_guard :] = "guard"
        if cfg.dc_null:
            self.mask[:, cfg.fft_size // 2] = "dc"


def raised_cosine_window(symbol_length: int, rolloff: int) -> np.ndarray:
    if symbol_length <= 0:
        raise ValueError("symbol_length must be positive")
    if rolloff < 0 or rolloff * 2 > symbol_length:
        raise ValueError("rolloff must be in [0, symbol_length / 2]")
    window = np.ones(symbol_length, dtype=np.float64)
    if rolloff == 0:
        return window
    n = np.arange(rolloff)
    taper = 0.5 * (1 - np.cos(np.pi * (n + 1) / (rolloff + 1)))
    window[:rolloff] = taper
    window[-rolloff:] = taper[::-1]
    return window


def grid_to_time_domain(grid: np.ndarray, cyclic_prefix: int, window_rolloff: int = 0) -> np.ndarray:
    resource_grid = np.asarray(grid, dtype=np.complex128)
    if resource_grid.ndim != 2:
        raise ValueError("grid must be 2D")
    if cyclic_prefix < 0 or cyclic_prefix >= resource_grid.shape[1]:
        raise ValueError("cyclic_prefix must be in [0, fft_size)")
    time = np.fft.ifft(resource_grid, axis=1)
    cp = time[:, -cyclic_prefix:] if cyclic_prefix else np.empty((time.shape[0], 0), dtype=np.complex128)
    symbols = np.concatenate([cp, time], axis=1)
    window = raised_cosine_window(symbols.shape[1], window_rolloff)
    return (symbols * window[None, :]).reshape(-1)


def waveform_to_grid(waveform: np.ndarray, fft_size: int, cyclic_prefix: int) -> np.ndarray:
    samples = np.asarray(waveform, dtype=np.complex128)
    symbol_len = fft_size + cyclic_prefix
    usable = (samples.size // symbol_len) * symbol_len
    frames = samples[:usable].reshape(-1, symbol_len)
    without_cp = frames[:, cyclic_prefix:]
    return np.fft.fft(without_cp, axis=1)


def allocate_contiguous_ofdma_users(
    active_subcarriers: np.ndarray, user_ids: list[str]
) -> list[UserAllocation]:
    if not user_ids:
        raise ValueError("at least one user is required")
    chunks = np.array_split(np.asarray(active_subcarriers, dtype=int), len(user_ids))
    return [
        UserAllocation(user_id=user_id, subcarriers=tuple(int(v) for v in chunk))
        for user_id, chunk in zip(user_ids, chunks, strict=True)
    ]
