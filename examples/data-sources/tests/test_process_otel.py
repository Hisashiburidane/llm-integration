import importlib.util
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "process-data.py"
SPEC = importlib.util.spec_from_file_location("process_data", MODULE_PATH)
assert SPEC and SPEC.loader
process_data = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(process_data)


def attributes(values: dict[str, object]) -> list[dict[str, object]]:
    items = []
    for key, value in values.items():
        field = "stringValue" if isinstance(value, str) else "intValue"
        items.append({"key": key, "value": {field: value}})
    return items


class OtelProcessingTest(unittest.TestCase):
    def test_processes_three_signals_and_builds_rollups(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            data_dir = Path(directory)
            capture_dir = data_dir / "otel-demo" / "raw" / "capture-1"
            capture_dir.mkdir(parents=True)
            manifest = {
                "captureId": "capture-1",
                "source": {"revision": "abc123"},
                "startedAt": "2026-07-26T00:00:00Z",
                "endedAt": "2026-07-26T00:01:00Z",
                "durationSeconds": 60,
                "scenario": "payment-failure",
            }
            (capture_dir / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
            trace_payload = {
                "resourceSpans": [
                    {
                        "resource": {"attributes": attributes({"service.name": "frontend"})},
                        "scopeSpans": [{"spans": [{
                            "traceId": "trace-1",
                            "spanId": "parent",
                            "name": "GET /checkout",
                            "kind": "SPAN_KIND_SERVER",
                            "startTimeUnixNano": "1000000000",
                            "endTimeUnixNano": "1100000000",
                            "status": {"code": "STATUS_CODE_OK"},
                        }]}],
                    },
                    {
                        "resource": {"attributes": attributes({"service.name": "payment"})},
                        "scopeSpans": [{"spans": [{
                            "traceId": "trace-1",
                            "spanId": "child",
                            "parentSpanId": "parent",
                            "name": "charge",
                            "kind": "SPAN_KIND_SERVER",
                            "startTimeUnixNano": "1010000000",
                            "endTimeUnixNano": "1090000000",
                            "status": {"code": "STATUS_CODE_ERROR", "message": "declined"},
                        }]}],
                    },
                ]
            }
            metric_payload = {
                "resourceMetrics": [{
                    "resource": {"attributes": attributes({"service.name": "payment"})},
                    "scopeMetrics": [{"metrics": [{
                        "name": "http.server.request.duration",
                        "unit": "ms",
                        "gauge": {"dataPoints": [{
                            "timeUnixNano": "2000000000",
                            "asDouble": 80.0,
                            "attributes": attributes({"http.response.status_code": 500}),
                        }]},
                    }]}],
                }]
            }
            log_payload = {
                "resourceLogs": [{
                    "resource": {"attributes": attributes({"service.name": "payment"})},
                    "scopeLogs": [{"logRecords": [{
                        "timeUnixNano": "2050000000",
                        "traceId": "trace-1",
                        "spanId": "child",
                        "severityText": "ERROR",
                        "body": {"stringValue": "payment failed"},
                    }]}],
                }]
            }
            for name, payload in (
                ("traces.jsonl", trace_payload),
                ("metrics.jsonl", metric_payload),
                ("logs.jsonl", log_payload),
            ):
                (capture_dir / name).write_text(f"{json.dumps(payload)}\n", encoding="utf-8")

            connection = sqlite3.connect(":memory:")
            process_data.create_schema(connection)
            source, row_count = process_data.process_otel(data_dir, connection)

            self.assertEqual(source, capture_dir / "manifest.json")
            self.assertEqual(row_count, 4)
            self.assertEqual(connection.execute("SELECT COUNT(*) FROM otel_spans").fetchone()[0], 2)
            self.assertEqual(connection.execute("SELECT error_count FROM otel_service_minute_rollup WHERE service_name = 'payment'").fetchone()[0], 1)
            self.assertEqual(
                connection.execute("SELECT source_service, target_service FROM otel_service_edge_rollup").fetchone(),
                ("frontend", "payment"),
            )
            self.assertEqual(connection.execute("SELECT COUNT(*) FROM otel_metric_minute_rollup").fetchone()[0], 1)
            self.assertEqual(connection.execute("SELECT body FROM otel_logs").fetchone()[0], "payment failed")
            connection.close()


if __name__ == "__main__":
    unittest.main()
