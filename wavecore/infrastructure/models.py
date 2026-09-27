from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from wavecore.infrastructure.database import Base


class ExperimentModel(Base):
    __tablename__ = "experiments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    configurations: Mapped[list["ConfigurationModel"]] = relationship(back_populates="experiment")


class ConfigurationModel(Base):
    __tablename__ = "configurations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    experiment_id: Mapped[str] = mapped_column(ForeignKey("experiments.id"))
    parameters: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    experiment: Mapped[ExperimentModel] = relationship(back_populates="configurations")
    results: Mapped[list["ResultModel"]] = relationship(back_populates="configuration")


class ResultModel(Base):
    __tablename__ = "results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    configuration_id: Mapped[str] = mapped_column(ForeignKey("configurations.id"))
    recovered_message: Mapped[str] = mapped_column(Text)
    crc_ok: Mapped[bool] = mapped_column(Boolean)
    traces: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    configuration: Mapped[ConfigurationModel] = relationship(back_populates="results")
    metrics: Mapped[list["MetricModel"]] = relationship(back_populates="result")


class MetricModel(Base):
    __tablename__ = "metrics"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    result_id: Mapped[str] = mapped_column(ForeignKey("results.id"))
    name: Mapped[str] = mapped_column(String(100))
    value: Mapped[float] = mapped_column(Float)
    result: Mapped[ResultModel] = relationship(back_populates="metrics")


class ReportModel(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    result_id: Mapped[str] = mapped_column(ForeignKey("results.id"))
    report_type: Mapped[str] = mapped_column(String(50))
    uri: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

