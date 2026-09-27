import numpy as np

from wavecore.dsp.coding import append_crc16, hamming74_decode, hamming74_encode, verify_crc16
from wavecore.dsp.encoding import MessageCodec
from wavecore.dsp.interleaving import block_deinterleave, block_interleave
from wavecore.dsp.modulation import demodulate, modulate
from wavecore.domain.enums import ModulationScheme


def test_message_codec_round_trip() -> None:
    bits = MessageCodec.text_to_bits("WaveCore X")
    assert MessageCodec.bits_to_text(bits) == "WaveCore X"


def test_crc_detects_clean_payload() -> None:
    bits = MessageCodec.text_to_bits("crc")
    payload, ok = verify_crc16(append_crc16(bits))
    assert ok
    assert np.array_equal(payload, bits)


def test_hamming_corrects_single_bit_error() -> None:
    bits = np.array([1, 0, 1, 1, 0, 0, 1, 0], dtype=np.uint8)
    encoded = hamming74_encode(bits)
    encoded[3] ^= 1
    decoded, corrected = hamming74_decode(encoded)
    assert corrected == 1
    assert np.array_equal(decoded[: bits.size], bits)


def test_interleaver_round_trip() -> None:
    bits = np.arange(37, dtype=np.uint8) % 2
    interleaved, pad = block_interleave(bits, rows=8)
    restored = block_deinterleave(interleaved, rows=8, pad=pad)
    assert np.array_equal(restored, bits)


def test_modulation_round_trip_all_supported_schemes() -> None:
    bits = np.array([1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1], dtype=np.uint8)
    for scheme in ModulationScheme:
        symbols, pad = modulate(bits, scheme)
        recovered = demodulate(symbols, scheme, pad)
        assert np.array_equal(recovered, bits)

