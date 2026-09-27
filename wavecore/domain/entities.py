from dataclasses import dataclass, field
from time import perf_counter
from typing import Any
from uuid import uuid4

import numpy as np

from wavecore.domain.enums import ChannelModel, CodingScheme, EqualizerType, ModulationScheme


@dataclass(frozen=True)
class OfdmParameters:
    fft_size: int = 64
    cyclic_prefix: int = 16
    pilot_spacing: int = 4

    def validate(self) -> None:
        if self.fft_size <= 0 or self.fft_size & (self.fft_size - 1):
            raise ValueError("fft_size must be a positive power of two")
        if not 0 <= self.cyclic_prefix < self.fft_size:
            raise ValueError("cyclic_prefix must be in [0, fft_size)")
        if self.pilot_spacing <= 0:
            raise ValueError("pilot_spacing must be positive")


@dataclass(frozen=True)
class ChannelParameters:
    model: ChannelModel = ChannelModel.AWGN
    snr_db: float = 30.0
    frequency_offset_hz: float = 0.0
    sample_rate_hz: float = 15_360_000.0
    timing_offset_samples: int = 0
    doppler_hz: float = 0.0
    rician_k_factor: float = 6.0


@dataclass(frozen=True)
class SimulationParameters:
    message: str
    modulation: ModulationScheme = ModulationScheme.QPSK
    coding: CodingScheme = CodingScheme.HAMMING74
    equalizer: EqualizerType = EqualizerType.ZERO_FORCING
    channel: ChannelParameters = field(default_factory=ChannelParameters)
    ofdm: OfdmParameters = field(default_factory=OfdmParameters)
    random_seed: int | None = 7


@dataclass
class StageTrace:
    name: str
    summary: str
    data: dict[str, Any]


@dataclass
class SimulationResult:
    simulation_id: str
    input_message: str
    recovered_message: str
    crc_ok: bool
    metrics: dict[str, float | int | bool]
    traces: list[StageTrace]


class Timer:
    def __init__(self) -> None:
        self._start = perf_counter()

    def elapsed_ms(self) -> float:
        return (perf_counter() - self._start) * 1000.0


def new_simulation_id() -> str:
    return str(uuid4())


def complex_preview(values: np.ndarray, limit: int = 16) -> list[dict[str, float]]:
    flat = np.asarray(values).reshape(-1)[:limit]
    return [{"re": float(np.real(v)), "im": float(np.imag(v))} for v in flat]
