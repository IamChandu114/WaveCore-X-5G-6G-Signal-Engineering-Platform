# Simulation Documentation

## Current Pipeline

1. Encode a UTF-8 message into bits.
2. Append CRC-16-CCITT.
3. Apply Hamming(7,4) channel coding.
4. Apply block interleaving.
5. Modulate bits using BPSK, QPSK, or square QAM.
6. Map symbols into OFDM resource grids with pilots.
7. Apply IFFT and cyclic prefix.
8. Pass the waveform through a configurable wireless channel.
9. Remove cyclic prefix and apply FFT.
10. Equalize with pilot-assisted channel estimation.
11. Demodulate symbols back to bits.
12. Deinterleave, Hamming decode, verify CRC, recover message.
13. Report BER, SER, EVM, latency, throughput, and packet status.

## Industrial Relevance

The pipeline mirrors the signal-processing concepts used in LTE, 5G NR, Wi-Fi, and satellite links: robust framing, coding, interleaving, QAM modulation, OFDM, pilot-aided channel estimation, synchronization impairment modeling, and link-quality metrics.

## Limitations In Milestone 1

- LDPC is represented as an extensible boundary and is not yet implemented.
- Synchronization is impairment modeling plus correction hooks; full acquisition loops are planned.
- Equalization starts with zero-forcing using pilot interpolation.
- Celery/Redis orchestration is scaffolded but not yet required for short runs.

