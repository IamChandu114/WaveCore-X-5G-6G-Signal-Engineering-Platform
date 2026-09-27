from wavecore.domain.entities import ChannelParameters, SimulationParameters
from wavecore.domain.enums import ChannelModel, EqualizerType, ModulationScheme
from wavecore.simulation.engine import SimulationEngine


def test_high_snr_awgn_pipeline_recovers_message() -> None:
    params = SimulationParameters(
        message="Qualcomm PHY",
        modulation=ModulationScheme.QPSK,
        channel=ChannelParameters(model=ChannelModel.AWGN, snr_db=60),
        random_seed=1,
    )
    result = SimulationEngine().run(params)
    assert result.recovered_message == "Qualcomm PHY"
    assert result.crc_ok
    assert result.metrics["ber"] == 0.0


def test_mmse_equalizer_pipeline_recovers_message_at_high_snr() -> None:
    params = SimulationParameters(
        message="MMSE path",
        modulation=ModulationScheme.QPSK,
        equalizer=EqualizerType.MMSE,
        channel=ChannelParameters(model=ChannelModel.AWGN, snr_db=60),
        random_seed=2,
    )
    result = SimulationEngine().run(params)
    assert result.recovered_message == "MMSE path"
    assert result.crc_ok
    assert result.metrics["equalizer"] == "MMSE"
