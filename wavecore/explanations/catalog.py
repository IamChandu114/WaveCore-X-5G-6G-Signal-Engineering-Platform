from wavecore.domain.enums import SimulationStage


EXPLANATIONS: dict[SimulationStage, dict[str, object]] = {
    SimulationStage.BINARY_ENCODING: {
        "what": "The input message is encoded as UTF-8 bytes and expanded into a binary bitstream.",
        "math": "Each byte is represented as eight ordered bits. The bitstream is the discrete payload x[n].",
        "industrial_usage": "Every modem begins with payload framing before physical-layer coding.",
        "qualcomm_relevance": "Wireless chipsets ingest protocol payload bits before PHY processing.",
        "advantages": ["Deterministic", "Standards-compatible for text payloads"],
        "limitations": ["Text encoding is not the same as full MAC/RLC packetization"],
        "interview_questions": ["Why does bit ordering matter in a communication chain?"],
        "common_mistakes": ["Confusing bytes, bits, and symbols"],
    },
    SimulationStage.CHANNEL_CODING: {
        "what": "CRC detects frame corruption and Hamming coding adds redundancy for single-bit correction.",
        "math": "CRC performs polynomial division over GF(2). Hamming(7,4) maps 4 data bits to 7 coded bits.",
        "industrial_usage": "Real systems use CRC plus stronger FEC such as LDPC, Turbo, or Polar codes.",
        "qualcomm_relevance": "5G NR uses LDPC for data channels and Polar coding for control channels.",
        "advantages": ["Improves reliability", "Separates detection and correction"],
        "limitations": ["Hamming is educational and weaker than production 5G codes"],
        "interview_questions": ["How does FEC trade throughput for reliability?"],
        "common_mistakes": ["Measuring BER only before decoding"],
    },
    SimulationStage.MODULATION: {
        "what": "Groups of bits are mapped onto complex constellation symbols.",
        "math": "M-QAM maps log2(M) bits to one I/Q symbol with normalized average power.",
        "industrial_usage": "Adaptive modulation selects QPSK, 16-QAM, 64-QAM, or 256-QAM from channel quality.",
        "qualcomm_relevance": "Modulation adaptation is central to modem throughput and link robustness.",
        "advantages": ["Higher-order QAM improves spectral efficiency"],
        "limitations": ["Higher-order QAM requires better SNR and linearity"],
        "interview_questions": ["Why is 256-QAM more sensitive to noise than QPSK?"],
        "common_mistakes": ["Forgetting constellation normalization"],
    },
    SimulationStage.OFDM: {
        "what": "Symbols are placed on subcarriers, transformed by IFFT, and protected by cyclic prefix.",
        "math": "IFFT converts frequency-domain subcarriers X[k] into time-domain samples x[n].",
        "industrial_usage": "OFDM underpins LTE, 5G NR downlink/uplink variants, Wi-Fi, and DVB.",
        "qualcomm_relevance": "OFDM numerology and RF impairments are core modem design concerns.",
        "advantages": ["Handles frequency-selective channels", "Enables pilot-based estimation"],
        "limitations": ["High PAPR", "Sensitive to frequency offset"],
        "interview_questions": ["What does the cyclic prefix protect against?"],
        "common_mistakes": ["Treating OFDM bins as time samples"],
    },
}


def get_stage_explanations() -> dict[str, dict[str, object]]:
    return {stage.value: content for stage, content in EXPLANATIONS.items()}

