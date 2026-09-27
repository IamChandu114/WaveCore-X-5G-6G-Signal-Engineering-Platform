import numpy as np

from wavecore.analytics.metrics import bit_error_rate, evm_percent, symbol_error_rate, throughput_bps
from wavecore.domain.entities import (
    SimulationParameters,
    SimulationResult,
    StageTrace,
    Timer,
    complex_preview,
    new_simulation_id,
)
from wavecore.dsp.channel import apply_wireless_channel
from wavecore.dsp.coding import append_crc16, hamming74_decode, hamming74_encode, verify_crc16
from wavecore.dsp.encoding import MessageCodec
from wavecore.dsp.interleaving import block_deinterleave, block_interleave
from wavecore.dsp.modulation import demodulate, modulate
from wavecore.domain.enums import CodingScheme, EqualizerType
from wavecore.dsp.equalization import mmse_equalize
from wavecore.dsp.ofdm import (
    estimate_channel_from_pilots,
    extract_data_symbols,
    ofdm_demodulate,
    ofdm_modulate,
    zero_forcing_equalize,
)


TRACE_PREVIEW_LIMIT = 256


def _complex_trace(values: np.ndarray, limit: int = TRACE_PREVIEW_LIMIT) -> dict[str, object]:
    flat = np.asarray(values, dtype=np.complex128).reshape(-1)
    indices = np.linspace(0, flat.size - 1, min(flat.size, limit), dtype=int) if flat.size else np.array([], dtype=int)
    return {
        "sample_count": int(flat.size),
        "indices": indices.tolist(),
        "samples": [
            {"re": float(flat[index].real), "im": float(flat[index].imag)}
            for index in indices
        ],
    }


class SimulationEngine:
    def run(self, params: SimulationParameters) -> SimulationResult:
        if params.coding != CodingScheme.HAMMING74:
            raise ValueError(
                f"coding scheme {params.coding.value} is implemented as an independent DSP module, "
                "but the end-to-end pipeline currently supports HAMMING74 only"
            )
        timer = Timer()
        rng = np.random.default_rng(params.random_seed)
        traces: list[StageTrace] = []

        source_bits = MessageCodec.text_to_bits(params.message)
        traces.append(
            StageTrace(
                "message_input",
                "UTF-8 input message accepted as the source payload.",
                {"character_count": len(params.message), "utf8_byte_count": len(params.message.encode("utf-8"))},
            )
        )
        traces.append(
            StageTrace(
                "binary_encoding",
                "UTF-8 payload converted to a binary stream.",
                {"bit_count": int(source_bits.size), "preview": source_bits[:32].astype(int).tolist()},
            )
        )

        framed_bits = append_crc16(source_bits)
        coded_bits = hamming74_encode(framed_bits)
        traces.append(
            StageTrace(
                "channel_coding",
                "CRC-16 appended and Hamming(7,4) channel coding applied.",
                {"input_bits": int(framed_bits.size), "coded_bits": int(coded_bits.size)},
            )
        )

        interleaved_bits, interleaver_pad = block_interleave(coded_bits)
        traces.append(
            StageTrace(
                "interleaving",
                "Block interleaver permuted coded bits; padding is removed after deinterleaving.",
                {"input_bits": int(coded_bits.size), "interleaver_pad": interleaver_pad},
            )
        )
        symbols, modulation_pad = modulate(interleaved_bits, params.modulation)
        traces.append(
            StageTrace(
                "modulation",
                f"Bits mapped to {params.modulation} constellation symbols.",
                {"symbol_count": int(symbols.size), "preview": complex_preview(symbols)},
            )
        )

        tx_waveform, ofdm_pad = ofdm_modulate(symbols, params.ofdm)
        tx_grid = ofdm_demodulate(tx_waveform, params.ofdm)
        traces.append(
            StageTrace(
                "ofdm_transmit",
                "Symbols mapped to pilot-bearing OFDM resource elements, IFFT transformed, and cyclic-prefixed.",
                {
                    "fft_size": params.ofdm.fft_size,
                    "cyclic_prefix": params.ofdm.cyclic_prefix,
                    "data_subcarriers": int(params.ofdm.fft_size - len(np.arange(0, params.ofdm.fft_size, params.ofdm.pilot_spacing))),
                    "waveform_samples": int(tx_waveform.size),
                    "ofdm_pad_symbols": ofdm_pad,
                    "visualization": {
                        "resource_grid": {
                            **_complex_trace(tx_grid),
                            "shape": [int(v) for v in tx_grid.shape],
                        }
                    },
                },
            )
        )
        rx_waveform, channel_response = apply_wireless_channel(tx_waveform, params.channel, rng)
        traces.append(
            StageTrace(
                "wireless_channel",
                f"Waveform passed through {params.channel.model} channel.",
                {
                    "samples": int(rx_waveform.size),
                    "snr_db": float(params.channel.snr_db),
                    "visualization": {
                        "transmitted_waveform": _complex_trace(tx_waveform),
                        "received_waveform": _complex_trace(rx_waveform),
                        "fading_coefficients": _complex_trace(channel_response),
                    },
                },
            )
        )

        rx_grid = ofdm_demodulate(rx_waveform, params.ofdm)
        traces.append(
            StageTrace(
                "ofdm_receive",
                "Cyclic prefix removed and FFT applied to the received sample blocks.",
                {
                    "received_resource_grid_shape": list(rx_grid.shape),
                    "visualization": {
                        "resource_grid": {
                            **_complex_trace(rx_grid),
                            "shape": [int(v) for v in rx_grid.shape],
                        }
                    },
                },
            )
        )
        channel_estimate = estimate_channel_from_pilots(rx_grid, params.ofdm)
        traces.append(
            StageTrace(
                "channel_estimation",
                "Per-OFDM-symbol pilot estimates were linearly interpolated across subcarriers.",
                {"pilot_spacing": params.ofdm.pilot_spacing, "estimate_shape": list(channel_estimate.shape)},
            )
        )
        if params.equalizer == EqualizerType.MMSE:
            # FFT output noise variance is N times time-sample variance for NumPy's
            # unnormalized forward FFT and 1/N-scaled IFFT pair.
            signal_power = float(np.mean(np.abs(tx_waveform) ** 2)) if tx_waveform.size else 0.0
            noise_variance = (
                signal_power
                / (10 ** (params.channel.snr_db / 10))
                * params.ofdm.fft_size
                if signal_power
                else 0.0
            )
            equalized = mmse_equalize(rx_grid, channel_estimate, noise_variance)
            equalizer_name = "MMSE"
        else:
            equalized = zero_forcing_equalize(rx_grid, channel_estimate)
            equalizer_name = "zero-forcing"
        rx_symbols = extract_data_symbols(equalized, params.ofdm, ofdm_pad)
        traces.append(
            StageTrace(
                "equalization",
                f"Pilot-assisted channel estimate used for {equalizer_name} equalization.",
                {
                    "equalizer": equalizer_name,
                    "equalized_symbols": int(rx_symbols.size),
                    "preview": complex_preview(rx_symbols),
                    "visualization": {
                        "channel_estimate": _complex_trace(channel_estimate),
                        "equalized_constellation": _complex_trace(rx_symbols),
                    },
                },
            )
        )

        rx_interleaved_bits = demodulate(rx_symbols, params.modulation, modulation_pad)
        decided_symbols, _ = modulate(rx_interleaved_bits, params.modulation)
        traces.append(
            StageTrace(
                "demodulation",
                "Hard symbol decisions were converted back to the transmitted bit ordering.",
                {
                    "decided_symbol_count": int(decided_symbols.size),
                    "visualization": {
                        "transmitted_constellation": _complex_trace(symbols),
                        "detected_constellation": _complex_trace(decided_symbols),
                    },
                },
            )
        )
        rx_coded_bits = block_deinterleave(rx_interleaved_bits, pad=interleaver_pad)
        decoded_bits, corrected_errors = hamming74_decode(rx_coded_bits)
        payload_with_crc = decoded_bits[: framed_bits.size]
        rx_payload_bits, crc_ok = verify_crc16(payload_with_crc)
        recovered = MessageCodec.bits_to_text(rx_payload_bits[: source_bits.size])

        latency_ms = timer.elapsed_ms()
        waveform_duration_ms = (
            tx_waveform.size / params.channel.sample_rate_hz * 1000.0
        )
        metrics = {
            "ber": bit_error_rate(source_bits, rx_payload_bits[: source_bits.size]),
            "ser": symbol_error_rate(symbols, decided_symbols),
            "evm_percent": evm_percent(symbols, rx_symbols),
            "packet_error": not crc_ok,
            "coding_scheme": CodingScheme.HAMMING74.value,
            "equalizer": params.equalizer.value,
            "corrected_hamming_errors": int(corrected_errors),
            "payload_bits": int(source_bits.size),
            "coded_bits": int(coded_bits.size),
            "latency_ms": latency_ms,
            "simulation_runtime_ms": latency_ms,
            "waveform_duration_ms": waveform_duration_ms,
            "throughput_bps": throughput_bps(int(source_bits.size), waveform_duration_ms),
        }
        traces.append(
            StageTrace(
                "analytics",
                "Receiver output compared against transmitted payload.",
                metrics.copy(),
            )
        )

        return SimulationResult(
            simulation_id=new_simulation_id(),
            input_message=params.message,
            recovered_message=recovered,
            crc_ok=crc_ok,
            metrics=metrics,
            traces=traces,
        )
