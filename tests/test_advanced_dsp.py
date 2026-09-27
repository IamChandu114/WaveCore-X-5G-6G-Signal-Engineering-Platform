import numpy as np

from wavecore.dsp.advanced_coding import (
    AdaptiveCodingController,
    ConvolutionalCode,
    LDPCCode,
    PolarCode,
    ReedSolomonCode,
)
from wavecore.dsp.equalization import least_squares_channel_estimate, mmse_equalize
from wavecore.dsp.synchronization import (
    carrier_phase_recovery,
    correct_frequency_offset,
    estimate_frequency_offset_from_repetition,
    timing_synchronization,
)


def test_convolutional_code_viterbi_corrects_hard_decision_error() -> None:
    code = ConvolutionalCode()
    bits = np.array([1, 0, 1, 1, 0, 0, 1, 0, 1, 1], dtype=np.uint8)
    encoded = code.encode(bits)
    encoded[7] ^= 1
    decoded = code.viterbi_decode(encoded)
    assert np.array_equal(decoded, bits)


def test_reed_solomon_corrects_two_symbol_errors() -> None:
    rs = ReedSolomonCode(parity_symbols=6)
    encoded = bytearray(rs.encode(b"wavecore"))
    encoded[1] ^= 0x55
    encoded[6] ^= 0x23
    decoded, corrected = rs.decode(bytes(encoded))
    assert decoded == b"wavecore"
    assert corrected == 2


def test_ldpc_systematic_encode_and_min_sum_decode() -> None:
    h = np.array(
        [
            [1, 1, 0, 1, 0, 0],
            [0, 1, 1, 0, 1, 0],
            [1, 0, 1, 0, 0, 1],
        ],
        dtype=np.uint8,
    )
    code = LDPCCode(h)
    word = code.encode_systematic(np.array([1, 0, 1], dtype=np.uint8))
    llr = np.where(word == 0, 8.0, -8.0)
    decoded, converged = code.min_sum_decode(llr)
    assert converged
    assert np.array_equal(decoded, word)


def test_polar_code_round_trip_without_noise() -> None:
    code = PolarCode.by_polarization_weight(block_length=8, information_bits=4)
    data = np.array([1, 0, 1, 1], dtype=np.uint8)
    encoded = code.encode(data)
    llr = np.where(encoded == 0, 20.0, -20.0)
    decoded = code.sc_decode(llr)
    assert np.array_equal(decoded, data)


def test_mmse_equalizer_recovers_flat_fading_symbol() -> None:
    symbols = np.array([1 + 1j, -1 + 1j, 1 - 1j], dtype=np.complex128)
    channel = np.array([0.8 + 0.2j, 0.8 + 0.2j, 0.8 + 0.2j], dtype=np.complex128)
    received = symbols * channel
    estimate = least_squares_channel_estimate(received, symbols)
    equalized = mmse_equalize(received, estimate, noise_variance=0.0)
    assert np.allclose(equalized, symbols)


def test_frequency_offset_estimation_and_correction() -> None:
    sample_rate = 1000.0
    offset = 7.0
    base = np.ones(40, dtype=np.complex128)
    n = np.arange(80)
    shifted = np.ones(80, dtype=np.complex128) * np.exp(1j * 2 * np.pi * offset * n / sample_rate)
    estimate = estimate_frequency_offset_from_repetition(shifted[:40], shifted[40:], sample_rate)
    corrected = correct_frequency_offset(shifted, estimate, sample_rate)
    assert abs(estimate - offset) < 1e-9
    assert np.allclose(corrected[:40], base)


def test_timing_and_carrier_phase_recovery() -> None:
    preamble = np.array([1, -1, 1, 1], dtype=np.complex128)
    signal = np.concatenate([np.zeros(5), preamble, np.zeros(3)])
    assert timing_synchronization(signal, preamble) == 5

    symbols = np.array([1 + 1j, -1 + 1j], dtype=np.complex128) / np.sqrt(2)
    rotated = symbols * np.exp(1j * 0.3)
    recovered, phase = carrier_phase_recovery(rotated, symbols)
    assert abs(phase - 0.3) < 1e-12
    assert np.allclose(recovered, symbols)


def test_adaptive_coding_selection_is_ordered_by_snr() -> None:
    controller = AdaptiveCodingController()
    assert controller.select(1) == "polar_low_rate"
    assert controller.select(35) == "uncoded_crc"
