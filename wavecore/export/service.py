import csv
import io
import json
from dataclasses import asdict

from wavecore.domain.entities import SimulationResult


class ExportService:
    def to_json(self, result: SimulationResult) -> str:
        return json.dumps(asdict(result), indent=2, default=str)

    def metrics_to_csv(self, result: SimulationResult) -> str:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["simulation_id", "metric", "value"])
        for name, value in result.metrics.items():
            writer.writerow([result.simulation_id, name, value])
        return output.getvalue()

    def engineering_summary(self, result: SimulationResult) -> str:
        lines = [
            "# WaveCore X Engineering Report",
            "",
            f"Simulation ID: {result.simulation_id}",
            f"Input Message: {result.input_message}",
            f"Recovered Message: {result.recovered_message}",
            f"CRC OK: {result.crc_ok}",
            "",
            "## Metrics",
        ]
        lines.extend(f"- {name}: {value}" for name, value in result.metrics.items())
        return "\n".join(lines)

