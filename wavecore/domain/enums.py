from enum import Enum


class StrEnum(str, Enum):
    """Python 3.10-compatible string enum."""


class ModulationScheme(StrEnum):
    BPSK = "BPSK"
    QPSK = "QPSK"
    QAM16 = "16QAM"
    QAM64 = "64QAM"
    QAM256 = "256QAM"


class ChannelModel(StrEnum):
    AWGN = "AWGN"
    RAYLEIGH = "RAYLEIGH"
    RICIAN = "RICIAN"


class EqualizerType(StrEnum):
    ZERO_FORCING = "ZERO_FORCING"
    MMSE = "MMSE"


class CodingScheme(StrEnum):
    HAMMING74 = "HAMMING74"
    CONVOLUTIONAL = "CONVOLUTIONAL"
    REED_SOLOMON = "REED_SOLOMON"
    LDPC = "LDPC"
    POLAR = "POLAR"
    ADAPTIVE = "ADAPTIVE"


class SimulationStage(StrEnum):
    MESSAGE = "message"
    BINARY_ENCODING = "binary_encoding"
    CHANNEL_CODING = "channel_coding"
    INTERLEAVING = "interleaving"
    MODULATION = "modulation"
    OFDM = "ofdm"
    WIRELESS_CHANNEL = "wireless_channel"
    RECEIVER = "receiver"
    EQUALIZATION = "equalization"
    DEMODULATION = "demodulation"
    DECODING = "decoding"
    ANALYTICS = "analytics"
