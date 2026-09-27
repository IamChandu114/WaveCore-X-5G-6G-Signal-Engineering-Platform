from wavecore.domain.enums import ModulationScheme


class EngineeringAssistant:
    def compare_modulation(self, left: ModulationScheme, right: ModulationScheme) -> str:
        return (
            f"{left} and {right} trade spectral efficiency against noise tolerance. "
            "Lower-order schemes are more robust; higher-order QAM carries more bits per symbol "
            "but requires better SNR, RF linearity, and channel estimation."
        )

    def recommend_modulation(self, snr_db: float) -> ModulationScheme:
        if snr_db < 8:
            return ModulationScheme.BPSK
        if snr_db < 14:
            return ModulationScheme.QPSK
        if snr_db < 22:
            return ModulationScheme.QAM16
        if snr_db < 30:
            return ModulationScheme.QAM64
        return ModulationScheme.QAM256

