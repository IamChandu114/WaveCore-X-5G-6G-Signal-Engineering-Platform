from pydantic import BaseModel, ConfigDict, Field, model_validator

from wavecore.domain.enums import ChannelModel, CodingScheme, EqualizerType, ModulationScheme


class ChannelRequest(BaseModel):
    model: ChannelModel = ChannelModel.AWGN
    snr_db: float = Field(default=30.0, ge=-10.0, le=80.0)
    frequency_offset_hz: float = Field(default=0.0, allow_inf_nan=False)
    sample_rate_hz: float = Field(default=15_360_000.0, gt=0)
    timing_offset_samples: int = Field(default=0, ge=-4096, le=4096)
    doppler_hz: float = 0.0
    rician_k_factor: float = Field(default=6.0, ge=0.0)

    @model_validator(mode="after")
    def validate_frequency_offset(self) -> "ChannelRequest":
        if abs(self.frequency_offset_hz) >= self.sample_rate_hz / 2:
            raise ValueError("frequency_offset_hz must be below the sample-rate Nyquist frequency")
        return self


class OfdmRequest(BaseModel):
    fft_size: int = Field(default=64, ge=8, le=4096)
    cyclic_prefix: int = Field(default=16, ge=0)
    pilot_spacing: int = Field(default=4, ge=1)

    @model_validator(mode="after")
    def validate_ofdm_configuration(self) -> "OfdmRequest":
        if self.fft_size & (self.fft_size - 1):
            raise ValueError("fft_size must be a power of two")
        if self.cyclic_prefix >= self.fft_size:
            raise ValueError("cyclic_prefix must be smaller than fft_size")
        return self


class SimulationRunRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4096)
    modulation: ModulationScheme = ModulationScheme.QPSK
    coding: CodingScheme = CodingScheme.HAMMING74
    equalizer: EqualizerType = EqualizerType.ZERO_FORCING
    channel: ChannelRequest = Field(default_factory=ChannelRequest)
    ofdm: OfdmRequest = Field(default_factory=OfdmRequest)
    random_seed: int | None = 7

    @model_validator(mode="after")
    def validate_pipeline_capabilities(self) -> "SimulationRunRequest":
        if self.coding != CodingScheme.HAMMING74:
            raise ValueError(
                "the end-to-end simulation currently supports HAMMING74 only; "
                "other coding modules are standalone"
            )
        return self


class ComplexTraceSample(BaseModel):
    re: float = Field(allow_inf_nan=False)
    im: float = Field(allow_inf_nan=False)


class ComplexTracePreview(BaseModel):
    sample_count: int = Field(ge=0)
    indices: list[int] = Field(max_length=256)
    samples: list[ComplexTraceSample] = Field(max_length=256)

    @model_validator(mode="after")
    def validate_preview(self) -> "ComplexTracePreview":
        if len(self.indices) != len(self.samples):
            raise ValueError("trace preview indices and samples must have equal lengths")
        if any(index < 0 or index >= self.sample_count for index in self.indices):
            raise ValueError("trace preview index is outside the source array")
        if self.indices != sorted(set(self.indices)):
            raise ValueError("trace preview indices must be unique and increasing")
        return self


class GridTracePreview(ComplexTracePreview):
    shape: tuple[int, int]

    @model_validator(mode="after")
    def validate_grid_size(self) -> "GridTracePreview":
        if self.shape[0] <= 0 or self.shape[1] <= 0:
            raise ValueError("resource grid dimensions must be positive")
        if self.shape[0] * self.shape[1] != self.sample_count:
            raise ValueError("resource grid shape does not match its source sample count")
        return self


class StageTraceVisualization(BaseModel):
    transmitted_waveform: ComplexTracePreview | None = None
    received_waveform: ComplexTracePreview | None = None
    fading_coefficients: ComplexTracePreview | None = None
    transmitted_constellation: ComplexTracePreview | None = None
    detected_constellation: ComplexTracePreview | None = None
    equalized_constellation: ComplexTracePreview | None = None
    channel_estimate: ComplexTracePreview | None = None
    resource_grid: GridTracePreview | None = None


class StageTraceData(BaseModel):
    model_config = ConfigDict(extra="allow")
    visualization: StageTraceVisualization | None = None


class StageTraceResponse(BaseModel):
    name: str
    summary: str
    data: StageTraceData


class SimulationRunResponse(BaseModel):
    simulation_id: str
    input_message: str
    recovered_message: str
    crc_ok: bool
    metrics: dict
    traces: list[StageTraceResponse]
