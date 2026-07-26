#!/usr/bin/env python3
"""Normalize downloaded example data into one SQLite database.

The script never creates fallback rows. A dataset is processed only when its
raw source file is present and readable.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import sqlite3
import sys
import zipfile
from datetime import date, datetime, timezone
from pathlib import Path
from enum import Enum
from typing import Any

import typer


DATASETS = (
    "aviation-ontime",
    "online-retail-ii",
    "beijing-air-quality",
    "nyc-taxi",
    "otel-demo",
)
app = typer.Typer(add_completion=False, no_args_is_help=True, help="Clean downloaded example data into SQLite.")


class DatasetName(str, Enum):
    ALL = "all"
    AVIATION = "aviation-ontime"
    RETAIL = "online-retail-ii"
    AIR_QUALITY = "beijing-air-quality"
    TAXI = "nyc-taxi"
    OTEL = "otel-demo"
MISSING = {"", "NA", "N/A", "NULL", "NONE", "-", "NAN"}

AIRPORT_NAMES_ZH = {
    "ABE": ("利哈伊谷国际机场（阿伦敦）", "Lehigh Valley International Airport"),
    "ACT": ("韦科地区机场", "Waco Regional Airport"),
    "JFK": ("约翰·肯尼迪国际机场", "John F. Kennedy International Airport"),
    "LGA": ("拉瓜迪亚机场", "LaGuardia Airport"),
    "EWR": ("纽瓦克自由国际机场", "Newark Liberty International Airport"),
    "LAX": ("洛杉矶国际机场", "Los Angeles International Airport"),
    "ATL": ("亚特兰大哈茨菲尔德-杰克逊国际机场", "Hartsfield-Jackson Atlanta International Airport"),
    "ORD": ("芝加哥奥黑尔国际机场", "Chicago O'Hare International Airport"),
    "BOS": ("波士顿洛根国际机场", "Boston Logan International Airport"),
    "DFW": ("达拉斯沃思堡国际机场", "Dallas/Fort Worth International Airport"),
    "MSP": ("明尼阿波利斯-圣保罗国际机场", "Minneapolis-Saint Paul International Airport"),
    "DEN": ("丹佛国际机场", "Denver International Airport"),
    "MCO": ("奥兰多国际机场", "Orlando International Airport"),
    "SFO": ("旧金山国际机场", "San Francisco International Airport"),
    "IAH": ("休斯敦乔治·布什洲际机场", "George Bush Intercontinental Airport"),
    "SEA": ("西雅图-塔科马国际机场", "Seattle-Tacoma International Airport"),
    "CLT": ("夏洛特道格拉斯国际机场", "Charlotte Douglas International Airport"),
    "MIA": ("迈阿密国际机场", "Miami International Airport"),
}

DELAY_CAUSES = (
    ("carrier", "航空公司原因", "航空公司运行、机组、飞机或调度导致的延误。"),
    ("weather", "天气原因", "雷暴、降雪、低能见度等天气条件导致的延误。"),
    ("nas", "国家空域系统（空管）", "美国国家空域系统、空中交通管制或机场流量限制导致的延误。"),
    ("security", "安保原因", "安全检查或其他航空安保流程导致的延误。"),
    ("none", "无记录原因", "该航班没有记录到可归类的延误原因。"),
)


class DatasetUnavailable(RuntimeError):
    pass


def clean_key(value: Any) -> str:
    return str(value or "").strip().upper().replace(" ", "_")


def row_value(row: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = row.get(clean_key(key))
        if value is not None and str(value).strip().upper() not in MISSING:
            return value
    return None


def text_value(value: Any) -> str | None:
    if value is None or str(value).strip().upper() in MISSING:
        return None
    return str(value).strip()


def float_value(value: Any) -> float | None:
    value = text_value(value)
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def int_value(value: Any) -> int | None:
    parsed = float_value(value)
    return int(parsed) if parsed is not None else None


def bool_value(value: Any) -> int:
    parsed = float_value(value)
    if parsed is not None:
        return int(parsed != 0)
    return int(str(value or "").strip().lower() in {"true", "yes", "y"})


def iso_datetime(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat(sep=" ")
    if isinstance(value, date):
        return value.isoformat()
    return text_value(value)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def first_file(raw_dir: Path, pattern: str, label: str) -> Path:
    matches = sorted(raw_dir.glob(pattern))
    if not matches:
        raise DatasetUnavailable(f"{label} raw file not found in {raw_dir}")
    return matches[0]


def create_schema(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS dataset_runs (
          dataset_id TEXT PRIMARY KEY,
          source_path TEXT NOT NULL,
          source_sha256 TEXT NOT NULL,
          processed_at TEXT NOT NULL,
          row_count INTEGER NOT NULL,
          status TEXT NOT NULL,
          error TEXT
        );

        CREATE TABLE IF NOT EXISTS aviation_flights (
          flight_id TEXT PRIMARY KEY,
          flight_date TEXT NOT NULL,
          hour INTEGER,
          origin TEXT,
          destination TEXT,
          carrier TEXT,
          direction TEXT NOT NULL,
          dep_delay REAL NOT NULL,
          arr_delay REAL NOT NULL,
          taxi_out REAL,
          cancelled INTEGER NOT NULL,
          diverted INTEGER NOT NULL,
          delay_cause TEXT NOT NULL,
          delay_minutes REAL NOT NULL,
          on_time INTEGER NOT NULL,
          severe_delay INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_aviation_date ON aviation_flights(flight_date);
        CREATE INDEX IF NOT EXISTS idx_aviation_origin ON aviation_flights(origin);
        CREATE INDEX IF NOT EXISTS idx_aviation_carrier ON aviation_flights(carrier);
        CREATE INDEX IF NOT EXISTS idx_aviation_dashboard_scope ON aviation_flights(direction, hour, origin, carrier, dep_delay);

        CREATE TABLE IF NOT EXISTS aviation_airport_dictionary (
          code TEXT PRIMARY KEY,
          name_zh TEXT NOT NULL,
          name_en TEXT NOT NULL,
          city_en TEXT NOT NULL DEFAULT '',
          source TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS aviation_delay_cause_dictionary (
          code TEXT PRIMARY KEY,
          label_zh TEXT NOT NULL,
          description TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS aviation_dashboard_rollup (
          origin TEXT NOT NULL,
          carrier TEXT NOT NULL,
          direction TEXT NOT NULL,
          hour INTEGER NOT NULL,
          delay_cause TEXT NOT NULL,
          flight_count INTEGER NOT NULL,
          on_time_count INTEGER NOT NULL,
          dep_delay_sum REAL NOT NULL,
          delay_minutes_sum REAL NOT NULL,
          cancelled_count INTEGER NOT NULL,
          severe_delay_count INTEGER NOT NULL,
          PRIMARY KEY (origin, carrier, direction, hour, delay_cause)
        ) WITHOUT ROWID;
        CREATE INDEX IF NOT EXISTS idx_aviation_rollup_origin ON aviation_dashboard_rollup(origin, direction, hour);
        CREATE INDEX IF NOT EXISTS idx_aviation_rollup_carrier ON aviation_dashboard_rollup(carrier, direction, hour);

        CREATE TABLE IF NOT EXISTS retail_transactions (
          invoice_no TEXT,
          stock_code TEXT,
          description TEXT,
          quantity REAL,
          invoice_date TEXT,
          unit_price REAL,
          customer_id TEXT,
          country TEXT,
          line_amount REAL,
          is_cancellation INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_retail_invoice_date ON retail_transactions(invoice_date);
        CREATE INDEX IF NOT EXISTS idx_retail_country ON retail_transactions(country);

        CREATE TABLE IF NOT EXISTS air_quality_observations (
          observed_at TEXT NOT NULL,
          station TEXT NOT NULL,
          pm25 REAL,
          pm10 REAL,
          so2 REAL,
          no2 REAL,
          co REAL,
          o3 REAL,
          temperature REAL,
          pressure REAL,
          dew_point REAL,
          rain REAL,
          wind_direction TEXT,
          wind_speed REAL
        );
        CREATE INDEX IF NOT EXISTS idx_air_quality_time ON air_quality_observations(observed_at);
        CREATE INDEX IF NOT EXISTS idx_air_quality_station ON air_quality_observations(station);

        CREATE TABLE IF NOT EXISTS air_quality_dashboard_rollup (
          observed_date TEXT NOT NULL,
          station TEXT NOT NULL,
          observation_count INTEGER NOT NULL,
          pm25_avg REAL,
          pm25_max REAL,
          pm10_avg REAL,
          pm10_max REAL,
          so2_avg REAL,
          no2_avg REAL,
          co_avg REAL,
          o3_avg REAL,
          temperature_avg REAL,
          pressure_avg REAL,
          rain_total REAL,
          PRIMARY KEY (observed_date, station)
        ) WITHOUT ROWID;
        CREATE INDEX IF NOT EXISTS idx_air_quality_rollup_station ON air_quality_dashboard_rollup(station, observed_date);
        CREATE INDEX IF NOT EXISTS idx_air_quality_rollup_date ON air_quality_dashboard_rollup(observed_date);

        CREATE TABLE IF NOT EXISTS nyc_taxi_trips (
          vendor_id TEXT,
          pickup_at TEXT,
          dropoff_at TEXT,
          passenger_count REAL,
          trip_distance REAL,
          rate_code_id TEXT,
          store_and_forward_flag TEXT,
          pickup_location_id INTEGER,
          dropoff_location_id INTEGER,
          payment_type TEXT,
          fare_amount REAL,
          tip_amount REAL,
          total_amount REAL,
          trip_duration_minutes REAL
        );
        CREATE INDEX IF NOT EXISTS idx_taxi_pickup_at ON nyc_taxi_trips(pickup_at);
        CREATE INDEX IF NOT EXISTS idx_taxi_pickup_location ON nyc_taxi_trips(pickup_location_id);

        CREATE TABLE IF NOT EXISTS nyc_taxi_zones (
          location_id INTEGER PRIMARY KEY,
          borough TEXT,
          zone TEXT,
          service_zone TEXT
        );
        CREATE TABLE IF NOT EXISTS nyc_taxi_dashboard_rollup (
          pickup_date TEXT NOT NULL,
          pickup_location_id INTEGER NOT NULL,
          pickup_borough TEXT NOT NULL,
          pickup_zone TEXT NOT NULL,
          trip_count INTEGER NOT NULL,
          passenger_sum REAL NOT NULL,
          distance_sum REAL NOT NULL,
          fare_sum REAL NOT NULL,
          tip_sum REAL NOT NULL,
          total_amount_sum REAL NOT NULL,
          duration_sum REAL NOT NULL,
          PRIMARY KEY (pickup_date, pickup_location_id)
        ) WITHOUT ROWID;
        CREATE INDEX IF NOT EXISTS idx_taxi_rollup_date ON nyc_taxi_dashboard_rollup(pickup_date);
        CREATE INDEX IF NOT EXISTS idx_taxi_rollup_borough ON nyc_taxi_dashboard_rollup(pickup_borough, pickup_date);
        CREATE INDEX IF NOT EXISTS idx_taxi_rollup_zone ON nyc_taxi_dashboard_rollup(pickup_location_id, pickup_date);

        CREATE TABLE IF NOT EXISTS otel_capture_runs (
          capture_id TEXT PRIMARY KEY,
          source_revision TEXT NOT NULL,
          started_at TEXT NOT NULL,
          ended_at TEXT NOT NULL,
          duration_seconds INTEGER NOT NULL,
          scenario TEXT NOT NULL,
          source_path TEXT NOT NULL,
          manifest_json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS otel_services (
          capture_id TEXT NOT NULL,
          service_name TEXT NOT NULL,
          service_namespace TEXT,
          service_version TEXT,
          environment TEXT,
          resource_attributes_json TEXT NOT NULL,
          PRIMARY KEY (capture_id, service_name)
        ) WITHOUT ROWID;
        CREATE TABLE IF NOT EXISTS otel_spans (
          capture_id TEXT NOT NULL,
          trace_id TEXT NOT NULL,
          span_id TEXT NOT NULL,
          parent_span_id TEXT,
          service_name TEXT NOT NULL,
          operation_name TEXT NOT NULL,
          span_kind TEXT,
          started_at TEXT NOT NULL,
          ended_at TEXT NOT NULL,
          duration_ms REAL NOT NULL,
          status_code TEXT,
          status_message TEXT,
          attributes_json TEXT NOT NULL,
          resource_attributes_json TEXT NOT NULL,
          PRIMARY KEY (capture_id, trace_id, span_id)
        ) WITHOUT ROWID;
        CREATE INDEX IF NOT EXISTS idx_otel_spans_service_time ON otel_spans(capture_id, service_name, started_at);
        CREATE INDEX IF NOT EXISTS idx_otel_spans_trace ON otel_spans(capture_id, trace_id, span_id);
        CREATE INDEX IF NOT EXISTS idx_otel_spans_parent ON otel_spans(capture_id, trace_id, parent_span_id);
        CREATE TABLE IF NOT EXISTS otel_metric_points (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          capture_id TEXT NOT NULL,
          observed_at TEXT NOT NULL,
          service_name TEXT NOT NULL,
          metric_name TEXT NOT NULL,
          unit TEXT,
          metric_kind TEXT NOT NULL,
          value REAL,
          sample_count INTEGER,
          sample_sum REAL,
          sample_min REAL,
          sample_max REAL,
          attributes_json TEXT NOT NULL,
          resource_attributes_json TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_otel_metrics_name_time ON otel_metric_points(capture_id, metric_name, observed_at);
        CREATE INDEX IF NOT EXISTS idx_otel_metrics_service_time ON otel_metric_points(capture_id, service_name, observed_at);
        CREATE TABLE IF NOT EXISTS otel_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          capture_id TEXT NOT NULL,
          observed_at TEXT NOT NULL,
          trace_id TEXT,
          span_id TEXT,
          service_name TEXT NOT NULL,
          severity TEXT,
          body TEXT,
          attributes_json TEXT NOT NULL,
          resource_attributes_json TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_otel_logs_service_time ON otel_logs(capture_id, service_name, observed_at);
        CREATE INDEX IF NOT EXISTS idx_otel_logs_trace ON otel_logs(capture_id, trace_id);
        CREATE TABLE IF NOT EXISTS otel_service_minute_rollup (
          capture_id TEXT NOT NULL,
          observed_minute TEXT NOT NULL,
          service_name TEXT NOT NULL,
          span_count INTEGER NOT NULL,
          error_count INTEGER NOT NULL,
          average_duration_ms REAL NOT NULL,
          p95_duration_ms REAL NOT NULL,
          max_duration_ms REAL NOT NULL,
          PRIMARY KEY (capture_id, observed_minute, service_name)
        ) WITHOUT ROWID;
        CREATE INDEX IF NOT EXISTS idx_otel_service_rollup_time ON otel_service_minute_rollup(capture_id, observed_minute);
        CREATE TABLE IF NOT EXISTS otel_service_edge_rollup (
          capture_id TEXT NOT NULL,
          source_service TEXT NOT NULL,
          target_service TEXT NOT NULL,
          call_count INTEGER NOT NULL,
          error_count INTEGER NOT NULL,
          average_duration_ms REAL NOT NULL,
          p95_duration_ms REAL NOT NULL,
          PRIMARY KEY (capture_id, source_service, target_service)
        ) WITHOUT ROWID;
        CREATE TABLE IF NOT EXISTS otel_metric_minute_rollup (
          capture_id TEXT NOT NULL,
          observed_minute TEXT NOT NULL,
          service_name TEXT NOT NULL,
          metric_name TEXT NOT NULL,
          unit TEXT NOT NULL,
          point_count INTEGER NOT NULL,
          average_value REAL NOT NULL,
          max_value REAL NOT NULL,
          total_value REAL NOT NULL,
          PRIMARY KEY (capture_id, observed_minute, service_name, metric_name, unit)
        ) WITHOUT ROWID;
        CREATE INDEX IF NOT EXISTS idx_otel_metric_rollup_time ON otel_metric_minute_rollup(capture_id, observed_minute);
        CREATE TABLE IF NOT EXISTS otel_log_minute_rollup (
          capture_id TEXT NOT NULL,
          observed_minute TEXT NOT NULL,
          service_name TEXT NOT NULL,
          severity TEXT NOT NULL,
          log_count INTEGER NOT NULL,
          PRIMARY KEY (capture_id, observed_minute, service_name, severity)
        ) WITHOUT ROWID;
        CREATE INDEX IF NOT EXISTS idx_otel_log_rollup_time ON otel_log_minute_rollup(capture_id, observed_minute);
        """
    )
    try:
        connection.execute("ALTER TABLE aviation_airport_dictionary ADD COLUMN city_en TEXT NOT NULL DEFAULT ''")
    except sqlite3.OperationalError as error:
        if "duplicate column name" not in str(error):
            raise


def reset_table(connection: sqlite3.Connection, table: str) -> None:
    connection.execute(f"DELETE FROM {table}")


def compact_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def otel_value(value: Any) -> Any:
    if not isinstance(value, dict):
        return value
    scalar_keys = ("stringValue", "boolValue", "intValue", "doubleValue", "bytesValue")
    for key in scalar_keys:
        if key in value:
            parsed = value[key]
            if key == "intValue":
                try:
                    return int(parsed)
                except (TypeError, ValueError):
                    return parsed
            return parsed
    if "arrayValue" in value:
        return [otel_value(item) for item in value["arrayValue"].get("values", [])]
    if "kvlistValue" in value:
        return otel_attributes(value["kvlistValue"].get("values", []))
    return value


def otel_attributes(items: Any) -> dict[str, Any]:
    if not isinstance(items, list):
        return {}
    return {
        str(item.get("key", "")): otel_value(item.get("value"))
        for item in items
        if isinstance(item, dict) and item.get("key")
    }


def otel_timestamp(value: Any) -> str | None:
    try:
        nanoseconds = int(value)
    except (TypeError, ValueError):
        return None
    if nanoseconds <= 0:
        return None
    return datetime.fromtimestamp(nanoseconds / 1_000_000_000, tz=timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")


def otel_service(resource_attributes: dict[str, Any]) -> tuple[str, str | None, str | None, str | None]:
    return (
        str(resource_attributes.get("service.name") or "unknown_service"),
        text_value(resource_attributes.get("service.namespace")),
        text_value(resource_attributes.get("service.version")),
        text_value(resource_attributes.get("deployment.environment.name") or resource_attributes.get("deployment.environment")),
    )


def iter_json_lines(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as stream:
        for line_number, line in enumerate(stream, start=1):
            if not line.strip():
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError as error:
                raise ValueError(f"{path}:{line_number}: invalid OTLP JSON: {error}") from error


def verify_checksums(directory: Path) -> None:
    checksum_path = directory / "checksums.sha256"
    if not checksum_path.is_file():
        return
    for line in checksum_path.read_text(encoding="utf-8").splitlines():
        expected, separator, name = line.strip().partition("  ")
        if not separator or not name:
            raise ValueError(f"{checksum_path}: invalid checksum line")
        path = directory / name
        if not path.is_file():
            raise DatasetUnavailable(f"checksum target not found: {path}")
        actual = sha256(path)
        if actual != expected:
            raise ValueError(f"{path}: SHA-256 mismatch; expected {expected}, got {actual}")


def register_otel_service(
    connection: sqlite3.Connection,
    capture_id: str,
    resource_attributes: dict[str, Any],
) -> str:
    service_name, namespace, version, environment = otel_service(resource_attributes)
    connection.execute(
        """
        INSERT OR REPLACE INTO otel_services
        (capture_id, service_name, service_namespace, service_version, environment, resource_attributes_json)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (capture_id, service_name, namespace, version, environment, compact_json(resource_attributes)),
    )
    return service_name


def process_otel_traces(connection: sqlite3.Connection, capture_id: str, path: Path) -> int:
    insert_sql = """
      INSERT OR REPLACE INTO otel_spans
      (capture_id, trace_id, span_id, parent_span_id, service_name, operation_name,
       span_kind, started_at, ended_at, duration_ms, status_code, status_message,
       attributes_json, resource_attributes_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    count = 0
    for payload in iter_json_lines(path):
        rows: list[tuple[Any, ...]] = []
        for resource_span in payload.get("resourceSpans", []):
            resource_attributes = otel_attributes(resource_span.get("resource", {}).get("attributes", []))
            service_name = register_otel_service(connection, capture_id, resource_attributes)
            for scope_span in resource_span.get("scopeSpans", []):
                for span in scope_span.get("spans", []):
                    started_at = otel_timestamp(span.get("startTimeUnixNano"))
                    ended_at = otel_timestamp(span.get("endTimeUnixNano"))
                    if not started_at or not ended_at:
                        continue
                    duration_ms = max(0.0, (int(span["endTimeUnixNano"]) - int(span["startTimeUnixNano"])) / 1_000_000)
                    status = span.get("status") or {}
                    rows.append((
                        capture_id,
                        str(span.get("traceId") or ""),
                        str(span.get("spanId") or ""),
                        text_value(span.get("parentSpanId")),
                        service_name,
                        str(span.get("name") or "unknown_operation"),
                        text_value(span.get("kind")),
                        started_at,
                        ended_at,
                        duration_ms,
                        text_value(status.get("code")),
                        text_value(status.get("message")),
                        compact_json(otel_attributes(span.get("attributes", []))),
                        compact_json(resource_attributes),
                    ))
        connection.executemany(insert_sql, rows)
        count += len(rows)
    return count


def metric_data_points(metric: dict[str, Any]) -> tuple[str, list[dict[str, Any]]]:
    for kind in ("gauge", "sum", "histogram", "exponentialHistogram", "summary"):
        value = metric.get(kind)
        if isinstance(value, dict):
            points = value.get("dataPoints", [])
            return kind, points if isinstance(points, list) else []
    return "unknown", []


def process_otel_metrics(connection: sqlite3.Connection, capture_id: str, path: Path) -> int:
    insert_sql = """
      INSERT INTO otel_metric_points
      (capture_id, observed_at, service_name, metric_name, unit, metric_kind,
       value, sample_count, sample_sum, sample_min, sample_max,
       attributes_json, resource_attributes_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    count = 0
    for payload in iter_json_lines(path):
        rows: list[tuple[Any, ...]] = []
        for resource_metric in payload.get("resourceMetrics", []):
            resource_attributes = otel_attributes(resource_metric.get("resource", {}).get("attributes", []))
            service_name = register_otel_service(connection, capture_id, resource_attributes)
            for scope_metric in resource_metric.get("scopeMetrics", []):
                for metric in scope_metric.get("metrics", []):
                    kind, points = metric_data_points(metric)
                    for point in points:
                        observed_at = otel_timestamp(point.get("timeUnixNano") or point.get("startTimeUnixNano"))
                        if not observed_at:
                            continue
                        sample_count = int_value(point.get("count"))
                        sample_sum = float_value(point.get("sum"))
                        value = float_value(point.get("asDouble"))
                        if value is None:
                            value = float_value(point.get("asInt"))
                        if value is None and sample_count and sample_sum is not None:
                            value = sample_sum / sample_count
                        rows.append((
                            capture_id,
                            observed_at,
                            service_name,
                            str(metric.get("name") or "unknown_metric"),
                            text_value(metric.get("unit")),
                            kind,
                            value,
                            sample_count,
                            sample_sum,
                            float_value(point.get("min")),
                            float_value(point.get("max")),
                            compact_json(otel_attributes(point.get("attributes", []))),
                            compact_json(resource_attributes),
                        ))
        connection.executemany(insert_sql, rows)
        count += len(rows)
    return count


def process_otel_logs(connection: sqlite3.Connection, capture_id: str, path: Path) -> int:
    insert_sql = """
      INSERT INTO otel_logs
      (capture_id, observed_at, trace_id, span_id, service_name, severity, body,
       attributes_json, resource_attributes_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    count = 0
    for payload in iter_json_lines(path):
        rows: list[tuple[Any, ...]] = []
        for resource_log in payload.get("resourceLogs", []):
            resource_attributes = otel_attributes(resource_log.get("resource", {}).get("attributes", []))
            service_name = register_otel_service(connection, capture_id, resource_attributes)
            for scope_log in resource_log.get("scopeLogs", []):
                for record in scope_log.get("logRecords", []):
                    observed_at = otel_timestamp(record.get("timeUnixNano") or record.get("observedTimeUnixNano"))
                    if not observed_at:
                        continue
                    body = otel_value(record.get("body"))
                    rows.append((
                        capture_id,
                        observed_at,
                        text_value(record.get("traceId")),
                        text_value(record.get("spanId")),
                        service_name,
                        text_value(record.get("severityText") or record.get("severityNumber")),
                        body if isinstance(body, str) else compact_json(body),
                        compact_json(otel_attributes(record.get("attributes", []))),
                        compact_json(resource_attributes),
                    ))
        connection.executemany(insert_sql, rows)
        count += len(rows)
    return count


def build_otel_rollups(connection: sqlite3.Connection) -> tuple[int, int, int, int]:
    for table in ("otel_service_minute_rollup", "otel_service_edge_rollup", "otel_metric_minute_rollup", "otel_log_minute_rollup"):
        reset_table(connection, table)
    connection.executescript(
        """
        INSERT INTO otel_service_minute_rollup
        (capture_id, observed_minute, service_name, span_count, error_count,
         average_duration_ms, p95_duration_ms, max_duration_ms)
        WITH ranked AS (
          SELECT capture_id, substr(started_at, 1, 16) || ':00Z' AS observed_minute,
                 service_name, duration_ms,
                 CASE WHEN upper(COALESCE(status_code, '')) LIKE '%ERROR%'
                           OR status_code = '2' THEN 1 ELSE 0 END AS is_error,
                 ROW_NUMBER() OVER (
                   PARTITION BY capture_id, substr(started_at, 1, 16), service_name
                   ORDER BY duration_ms
                 ) AS duration_rank,
                 COUNT(*) OVER (
                   PARTITION BY capture_id, substr(started_at, 1, 16), service_name
                 ) AS group_count
          FROM otel_spans
        )
        SELECT capture_id, observed_minute, service_name, COUNT(*), SUM(is_error),
               AVG(duration_ms),
               MIN(CASE WHEN duration_rank >= CAST((group_count * 95 + 99) / 100 AS INTEGER)
                        THEN duration_ms END),
               MAX(duration_ms)
        FROM ranked
        GROUP BY capture_id, observed_minute, service_name;

        INSERT INTO otel_service_edge_rollup
        (capture_id, source_service, target_service, call_count, error_count,
         average_duration_ms, p95_duration_ms)
        WITH edges AS (
          SELECT child.capture_id, parent.service_name AS source_service,
                 child.service_name AS target_service, child.duration_ms,
                 CASE WHEN upper(COALESCE(child.status_code, '')) LIKE '%ERROR%'
                           OR child.status_code = '2' THEN 1 ELSE 0 END AS is_error
          FROM otel_spans AS child
          JOIN otel_spans AS parent
            ON parent.capture_id = child.capture_id
           AND parent.trace_id = child.trace_id
           AND parent.span_id = child.parent_span_id
          WHERE parent.service_name <> child.service_name
        ),
        ranked AS (
          SELECT *,
                 ROW_NUMBER() OVER (
                   PARTITION BY capture_id, source_service, target_service
                   ORDER BY duration_ms
                 ) AS duration_rank,
                 COUNT(*) OVER (
                   PARTITION BY capture_id, source_service, target_service
                 ) AS group_count
          FROM edges
        )
        SELECT capture_id, source_service, target_service, COUNT(*), SUM(is_error),
               AVG(duration_ms),
               MIN(CASE WHEN duration_rank >= CAST((group_count * 95 + 99) / 100 AS INTEGER)
                        THEN duration_ms END)
        FROM ranked
        GROUP BY capture_id, source_service, target_service;

        INSERT INTO otel_metric_minute_rollup
        (capture_id, observed_minute, service_name, metric_name, unit,
         point_count, average_value, max_value, total_value)
        SELECT capture_id, substr(observed_at, 1, 16) || ':00Z', service_name,
               metric_name, COALESCE(unit, ''), COUNT(*), AVG(value), MAX(value), SUM(value)
        FROM otel_metric_points
        WHERE value IS NOT NULL
        GROUP BY capture_id, substr(observed_at, 1, 16), service_name, metric_name, COALESCE(unit, '');

        INSERT INTO otel_log_minute_rollup
        (capture_id, observed_minute, service_name, severity, log_count)
        WITH normalized AS (
          SELECT capture_id, substr(observed_at, 1, 16) || ':00Z' AS observed_minute,
                 service_name,
                 CASE
                   WHEN trim(COALESCE(severity, '')) = '' THEN 'UNSPECIFIED'
                   WHEN trim(severity) NOT GLOB '*[^0-9]*' THEN
                     CASE
                       WHEN CAST(trim(severity) AS INTEGER) BETWEEN 1 AND 4 THEN 'TRACE'
                       WHEN CAST(trim(severity) AS INTEGER) BETWEEN 5 AND 8 THEN 'DEBUG'
                       WHEN CAST(trim(severity) AS INTEGER) BETWEEN 9 AND 12 THEN 'INFO'
                       WHEN CAST(trim(severity) AS INTEGER) BETWEEN 13 AND 16 THEN 'WARN'
                       WHEN CAST(trim(severity) AS INTEGER) BETWEEN 17 AND 20 THEN 'ERROR'
                       WHEN CAST(trim(severity) AS INTEGER) BETWEEN 21 AND 24 THEN 'FATAL'
                       ELSE 'UNSPECIFIED'
                     END
                   WHEN upper(trim(severity)) IN ('INFORMATION', 'INFO') THEN 'INFO'
                   WHEN upper(trim(severity)) LIKE 'WARN%' THEN 'WARN'
                   WHEN upper(trim(severity)) LIKE 'ERR%' THEN 'ERROR'
                   WHEN upper(trim(severity)) LIKE 'FATAL%' THEN 'FATAL'
                   WHEN upper(trim(severity)) LIKE 'DEBUG%' THEN 'DEBUG'
                   WHEN upper(trim(severity)) LIKE 'TRACE%' THEN 'TRACE'
                   ELSE upper(trim(severity))
                 END AS normalized_severity
          FROM otel_logs
        )
        SELECT capture_id, observed_minute, service_name, normalized_severity, COUNT(*)
        FROM normalized
        GROUP BY capture_id, observed_minute, service_name, normalized_severity;
        """
    )
    service_rows = int(connection.execute("SELECT COUNT(*) FROM otel_service_minute_rollup").fetchone()[0])
    edge_rows = int(connection.execute("SELECT COUNT(*) FROM otel_service_edge_rollup").fetchone()[0])
    metric_rows = int(connection.execute("SELECT COUNT(*) FROM otel_metric_minute_rollup").fetchone()[0])
    log_rows = int(connection.execute("SELECT COUNT(*) FROM otel_log_minute_rollup").fetchone()[0])
    return service_rows, edge_rows, metric_rows, log_rows


def build_aviation_rollup(connection: sqlite3.Connection) -> int:
    """Materialize the dimensions used by the dashboard's recurring queries."""
    reset_table(connection, "aviation_dashboard_rollup")
    connection.execute(
        """
        INSERT INTO aviation_dashboard_rollup
        (origin, carrier, direction, hour, delay_cause, flight_count,
         on_time_count, dep_delay_sum, delay_minutes_sum, cancelled_count,
         severe_delay_count)
        SELECT COALESCE(origin, ''), COALESCE(carrier, ''), direction,
               COALESCE(hour, 0), delay_cause, COUNT(*), SUM(on_time),
               SUM(dep_delay), SUM(delay_minutes), SUM(cancelled),
               SUM(severe_delay)
        FROM aviation_flights
        GROUP BY COALESCE(origin, ''), COALESCE(carrier, ''), direction,
                 COALESCE(hour, 0), delay_cause
        """
    )
    return int(connection.execute("SELECT COUNT(*) FROM aviation_dashboard_rollup").fetchone()[0])


def build_aviation_dictionaries(connection: sqlite3.Connection, reference_file: Path) -> None:
    connection.executemany(
        "INSERT OR REPLACE INTO aviation_delay_cause_dictionary (code, label_zh, description) VALUES (?, ?, ?)",
        DELAY_CAUSES,
    )
    reference: dict[str, tuple[str, str, str]] = {}
    if reference_file.exists():
        with reference_file.open(newline="", encoding="utf-8") as stream:
            for row in csv.DictReader(stream):
                code = clean_key(row.get("code"))
                if code:
                    reference[code] = (text_value(row.get("name_en")) or "", text_value(row.get("city_en")) or "", text_value(row.get("source")) or "reference")
    codes = connection.execute(
        "SELECT code FROM (SELECT origin AS code FROM aviation_flights UNION SELECT destination AS code FROM aviation_flights) WHERE code IS NOT NULL AND code <> '' ORDER BY code"
    ).fetchall()
    rows = []
    for (code,) in codes:
        if code in AIRPORT_NAMES_ZH:
            name_zh, name_en = AIRPORT_NAMES_ZH[code]
            city_en = reference.get(code, ("", "", ""))[1]
            source = "curated"
        elif code in reference:
            name_en, city_en, source = reference[code]
            name_zh = f"{name_en}（{city_en}）" if city_en else name_en
            source = "reference-en"
        else:
            name_zh, name_en, city_en, source = f"机场（{code}）", f"Airport ({code})", "", "code-fallback"
        rows.append((code, name_zh, name_en, city_en, source))
    connection.executemany(
        "INSERT OR REPLACE INTO aviation_airport_dictionary (code, name_zh, name_en, city_en, source) VALUES (?, ?, ?, ?, ?)",
        rows,
    )


def build_air_quality_rollup(connection: sqlite3.Connection) -> int:
    """Materialize daily station statistics used by the air-quality dashboard."""
    reset_table(connection, "air_quality_dashboard_rollup")
    connection.execute(
        """
        INSERT INTO air_quality_dashboard_rollup
        (observed_date, station, observation_count, pm25_avg, pm25_max,
         pm10_avg, pm10_max, so2_avg, no2_avg, co_avg, o3_avg,
         temperature_avg, pressure_avg, rain_total)
        SELECT substr(observed_at, 1, 10), station, COUNT(*),
               AVG(pm25), MAX(pm25), AVG(pm10), MAX(pm10), AVG(so2),
               AVG(no2), AVG(co), AVG(o3), AVG(temperature), AVG(pressure),
               SUM(COALESCE(rain, 0))
        FROM air_quality_observations
        GROUP BY substr(observed_at, 1, 10), station
        """
    )
    return int(connection.execute("SELECT COUNT(*) FROM air_quality_dashboard_rollup").fetchone()[0])


def build_taxi_rollup(connection: sqlite3.Connection) -> int:
    """Materialize daily pickup-zone statistics used by the taxi dashboard."""
    reset_table(connection, "nyc_taxi_dashboard_rollup")
    connection.execute(
        """
        INSERT INTO nyc_taxi_dashboard_rollup
        (pickup_date, pickup_location_id, pickup_borough, pickup_zone,
         trip_count, passenger_sum, distance_sum, fare_sum, tip_sum,
         total_amount_sum, duration_sum)
        SELECT substr(t.pickup_at, 1, 10), COALESCE(t.pickup_location_id, 0),
               COALESCE(z.borough, ''), COALESCE(z.zone, ''), COUNT(*),
               SUM(COALESCE(t.passenger_count, 0)),
               SUM(COALESCE(t.trip_distance, 0)),
               SUM(COALESCE(t.fare_amount, 0)),
               SUM(COALESCE(t.tip_amount, 0)),
               SUM(COALESCE(t.total_amount, 0)),
               SUM(COALESCE(t.trip_duration_minutes, 0))
        FROM nyc_taxi_trips AS t
        LEFT JOIN nyc_taxi_zones AS z ON z.location_id = t.pickup_location_id
        WHERE t.pickup_at IS NOT NULL AND substr(t.pickup_at, 1, 10) <> ''
        GROUP BY substr(t.pickup_at, 1, 10), COALESCE(t.pickup_location_id, 0),
                 COALESCE(z.borough, ''), COALESCE(z.zone, '')
        """
    )
    return int(connection.execute("SELECT COUNT(*) FROM nyc_taxi_dashboard_rollup").fetchone()[0])


def process_aviation(data_dir: Path, connection: sqlite3.Connection) -> tuple[Path, int]:
    archive = first_file(data_dir / "aviation-ontime" / "raw", "*.zip", "aviation")
    reset_table(connection, "aviation_flights")
    insert_sql = """
      INSERT INTO aviation_flights
      (flight_id, flight_date, hour, origin, destination, carrier, direction,
       dep_delay, arr_delay, taxi_out, cancelled, diverted, delay_cause,
       delay_minutes, on_time, severe_delay)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    count = 0
    batch: list[tuple[Any, ...]] = []
    with zipfile.ZipFile(archive) as source:
        csv_names = [name for name in source.namelist() if name.lower().endswith(".csv")]
        if not csv_names:
            raise DatasetUnavailable(f"aviation archive contains no CSV: {archive}")
        with source.open(csv_names[0]) as raw_stream:
            reader = csv.DictReader(io.TextIOWrapper(raw_stream, encoding="utf-8-sig", errors="replace"))
            for row_number, source_row in enumerate(reader, start=1):
                row = {clean_key(key): value for key, value in source_row.items()}
                flight_date = text_value(row_value(row, "FL_DATE", "FLIGHT_DATE", "FLIGHTDATE"))
                origin = text_value(row_value(row, "ORIGIN"))
                destination = text_value(row_value(row, "DEST", "DESTINATION"))
                carrier = text_value(row_value(row, "OP_CARRIER", "OP_UNIQUE_CARRIER", "REPORTING_AIRLINE"))
                if not flight_date or not origin or not destination or not carrier:
                    continue
                flight_number = text_value(row_value(row, "OP_CARRIER_FL_NUM", "FL_NUM", "FLIGHT_NUMBER", "FLIGHT_NUMBER_REPORTING_AIRLINE")) or "unknown"
                hour_value = int_value(row_value(row, "CRS_DEP_TIME", "SCHEDULED_DEP_TIME", "CRSDEPTIME"))
                hour = hour_value // 100 if hour_value is not None else None
                dep_delay = float_value(row_value(row, "DEP_DELAY", "DEPDELAY")) or 0.0
                arr_delay = float_value(row_value(row, "ARR_DELAY", "ARRDELAY")) or 0.0
                taxi_out = float_value(row_value(row, "TAXI_OUT", "TAXIOUT"))
                cancelled = bool_value(row_value(row, "CANCELLED"))
                diverted = bool_value(row_value(row, "DIVERTED"))
                causes = {
                    "carrier": max(float_value(row_value(row, "CARRIER_DELAY", "CARRIERDELAY")) or 0.0, 0.0),
                    "weather": max(float_value(row_value(row, "WEATHER_DELAY", "WEATHERDELAY")) or 0.0, 0.0),
                    "nas": max(float_value(row_value(row, "NAS_DELAY", "NASDELAY")) or 0.0, 0.0),
                    "security": max(float_value(row_value(row, "SECURITY_DELAY", "SECURITYDELAY")) or 0.0, 0.0),
                }
                delay_minutes = sum(causes.values())
                delay_cause = max(causes, key=causes.get) if delay_minutes else "none"
                on_time = int(not cancelled and arr_delay <= 15)
                severe_delay = int(dep_delay >= 60)
                base_id = f"{flight_date}-{carrier}-{flight_number}-{origin}-{destination}-{row_number}"
                for direction, active_delay, suffix in (
                    ("departure", dep_delay, ""),
                    ("arrival", arr_delay, "-ARR"),
                ):
                    batch.append((
                        f"{base_id}{suffix}", flight_date, hour, origin, destination,
                        carrier, direction, active_delay, arr_delay, taxi_out,
                        cancelled, diverted, delay_cause, delay_minutes,
                        int(not cancelled and active_delay <= 15), int(active_delay >= 60),
                    ))
                if len(batch) >= 2000:
                    connection.executemany(insert_sql, batch)
                    count += len(batch)
                    batch.clear()
    if batch:
        connection.executemany(insert_sql, batch)
        count += len(batch)
    rollup_count = build_aviation_rollup(connection)
    build_aviation_dictionaries(connection, data_dir / "aviation-ontime" / "airport-reference.csv")
    print(f"aviation-ontime: built {rollup_count} dashboard aggregate rows", flush=True)
    return archive, count


def process_air_quality(data_dir: Path, connection: sqlite3.Connection) -> tuple[Path, int]:
    archive = first_file(data_dir / "beijing-air-quality" / "raw", "*.zip", "air quality")
    reset_table(connection, "air_quality_observations")
    sql = """
      INSERT INTO air_quality_observations
      (observed_at, station, pm25, pm10, so2, no2, co, o3, temperature,
       pressure, dew_point, rain, wind_direction, wind_speed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    count = 0
    batch: list[tuple[Any, ...]] = []
    def consume(stream: Any) -> None:
        nonlocal count
        reader = csv.DictReader(io.TextIOWrapper(stream, encoding="utf-8-sig", errors="replace"))
        for row in reader:
            normalized = {clean_key(key): value for key, value in row.items()}
            station = text_value(row_value(normalized, "STATION"))
            year = int_value(row_value(normalized, "YEAR"))
            month = int_value(row_value(normalized, "MONTH"))
            day = int_value(row_value(normalized, "DAY"))
            hour = int_value(row_value(normalized, "HOUR"))
            if not station or None in (year, month, day, hour):
                continue
            observed_at = f"{year:04d}-{month:02d}-{day:02d}T{hour:02d}:00:00"
            batch.append((
                observed_at, station,
                float_value(row_value(normalized, "PM2.5", "PM25")),
                float_value(row_value(normalized, "PM10")),
                float_value(row_value(normalized, "SO2")),
                float_value(row_value(normalized, "NO2")),
                float_value(row_value(normalized, "CO")),
                float_value(row_value(normalized, "O3")),
                float_value(row_value(normalized, "TEMP")),
                float_value(row_value(normalized, "PRES")),
                float_value(row_value(normalized, "DEWP")),
                float_value(row_value(normalized, "RAIN")),
                text_value(row_value(normalized, "WD")),
                float_value(row_value(normalized, "WSPM")),
            ))
            if len(batch) >= 2000:
                connection.executemany(sql, batch)
                count += len(batch)
                batch.clear()

    with zipfile.ZipFile(archive) as source:
        for member in source.infolist():
            if member.filename.lower().endswith(".zip"):
                with source.open(member) as nested_stream:
                    nested_bytes = io.BytesIO(nested_stream.read())
                with zipfile.ZipFile(nested_bytes) as nested:
                    for csv_name in nested.namelist():
                        if csv_name.lower().endswith(".csv"):
                            with nested.open(csv_name) as raw_stream:
                                consume(raw_stream)
            elif member.filename.lower().endswith(".csv"):
                with source.open(member) as raw_stream:
                    consume(raw_stream)
    if batch:
        connection.executemany(sql, batch)
        count += len(batch)
    rollup_count = build_air_quality_rollup(connection)
    print(f"beijing-air-quality: built {rollup_count} daily station aggregate rows", flush=True)
    return archive, count


def find_xlsx(archive: Path) -> tuple[Path, str | None]:
    if archive.suffix.lower() == ".xlsx":
        return archive, None
    with zipfile.ZipFile(archive) as source:
        xlsx_names = [name for name in source.namelist() if name.lower().endswith(".xlsx")]
        if not xlsx_names:
            raise DatasetUnavailable(f"retail archive contains no XLSX: {archive}")
        return archive, xlsx_names[0]


def process_retail(data_dir: Path, connection: sqlite3.Connection) -> tuple[Path, int]:
    archive = first_file(data_dir / "online-retail-ii" / "raw", "*.zip", "retail")
    reset_table(connection, "retail_transactions")
    try:
        import openpyxl
    except ImportError as error:
        raise DatasetUnavailable("online-retail-ii requires openpyxl; run `uv sync` in examples/data-sources") from error
    source_path, member = find_xlsx(archive)
    workbook_source: Any
    if member:
        with zipfile.ZipFile(source_path) as source:
            workbook_source = io.BytesIO(source.read(member))
    else:
        workbook_source = source_path
    workbook = openpyxl.load_workbook(workbook_source, read_only=True, data_only=True)
    sql = """
      INSERT INTO retail_transactions
      (invoice_no, stock_code, description, quantity, invoice_date, unit_price,
       customer_id, country, line_amount, is_cancellation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    count = 0
    for sheet in workbook.worksheets:
        rows = sheet.iter_rows(values_only=True)
        header: list[str] | None = None
        indexes: dict[str, int] = {}
        for row in rows:
            normalized = [clean_key(value) for value in row]
            if {"STOCKCODE", "QUANTITY"}.issubset(set(normalized)) and {"INVOICENO", "INVOICE"}.intersection(normalized):
                header = normalized
                indexes = {name: index for index, name in enumerate(header)}
                break
        if not header:
            continue
        batch: list[tuple[Any, ...]] = []
        for row in rows:
            def cell(*names: str) -> Any:
                for name in names:
                    index = indexes.get(name)
                    if index is not None and index < len(row):
                        return row[index]
                return None

            invoice_no = text_value(cell("INVOICENO", "INVOICE"))
            quantity = float_value(cell("QUANTITY"))
            unit_price = float_value(cell("UNITPRICE", "PRICE"))
            invoice_date = iso_datetime(cell("INVOICEDATE"))
            if invoice_no is None or quantity is None or unit_price is None:
                continue
            batch.append((
                invoice_no,
                text_value(cell("STOCKCODE")),
                text_value(cell("DESCRIPTION")),
                quantity,
                invoice_date,
                unit_price,
                text_value(cell("CUSTOMERID", "CUSTOMER_ID")),
                text_value(cell("COUNTRY")),
                quantity * unit_price,
                int(invoice_no.upper().startswith("C")),
            ))
            if len(batch) >= 2000:
                connection.executemany(sql, batch)
                count += len(batch)
                batch.clear()
        if batch:
            connection.executemany(sql, batch)
            count += len(batch)
    workbook.close()
    return archive, count


def process_taxi(data_dir: Path, connection: sqlite3.Connection) -> tuple[Path, int]:
    raw_dir = data_dir / "nyc-taxi" / "raw"
    parquet = first_file(raw_dir, "*.parquet", "NYC taxi")
    zone_csv = first_file(raw_dir, "*zone*.csv", "NYC taxi zone")
    try:
        import pyarrow.parquet as pq
    except ImportError as error:
        raise DatasetUnavailable("nyc-taxi requires pyarrow; run `uv sync` in examples/data-sources") from error
    reset_table(connection, "nyc_taxi_trips")
    reset_table(connection, "nyc_taxi_zones")
    with zone_csv.open("r", encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        connection.executemany(
            "INSERT OR REPLACE INTO nyc_taxi_zones (location_id, borough, zone, service_zone) VALUES (?, ?, ?, ?)",
            [(
                int_value(row_value({clean_key(k): v for k, v in row.items()}, "LOCATIONID")),
                text_value(row_value({clean_key(k): v for k, v in row.items()}, "BOROUGH")),
                text_value(row_value({clean_key(k): v for k, v in row.items()}, "ZONE")),
                text_value(row_value({clean_key(k): v for k, v in row.items()}, "SERVICE_ZONE")),
            ) for row in reader],
        )
    parquet_file = pq.ParquetFile(parquet)
    available = set(parquet_file.schema.names)
    requested = [
        "VendorID", "tpep_pickup_datetime", "tpep_dropoff_datetime", "passenger_count",
        "trip_distance", "RatecodeID", "store_and_fwd_flag", "PULocationID",
        "DOLocationID", "payment_type", "fare_amount", "tip_amount", "total_amount",
    ]
    columns = [column for column in requested if column in available]
    indexes = {column: index for index, column in enumerate(columns)}
    sql = """
      INSERT INTO nyc_taxi_trips
      (vendor_id, pickup_at, dropoff_at, passenger_count, trip_distance, rate_code_id,
       store_and_forward_flag, pickup_location_id, dropoff_location_id, payment_type,
       fare_amount, tip_amount, total_amount, trip_duration_minutes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    count = 0
    for batch in parquet_file.iter_batches(columns=columns, batch_size=100000):
        values = batch.to_pydict()
        size = batch.num_rows
        rows: list[tuple[Any, ...]] = []

        def get(name: str, row_index: int) -> Any:
            column = values.get(name)
            return column[row_index] if column is not None else None

        for index in range(size):
            pickup = iso_datetime(get("tpep_pickup_datetime", index))
            dropoff = iso_datetime(get("tpep_dropoff_datetime", index))
            duration = None
            if pickup and dropoff:
                try:
                    duration = (datetime.fromisoformat(dropoff) - datetime.fromisoformat(pickup)).total_seconds() / 60
                except ValueError:
                    duration = None
            rows.append((
                text_value(get("VendorID", index)), pickup, dropoff,
                float_value(get("passenger_count", index)), float_value(get("trip_distance", index)),
                text_value(get("RatecodeID", index)), text_value(get("store_and_fwd_flag", index)),
                int_value(get("PULocationID", index)), int_value(get("DOLocationID", index)),
                text_value(get("payment_type", index)), float_value(get("fare_amount", index)),
                float_value(get("tip_amount", index)), float_value(get("total_amount", index)), duration,
            ))
        connection.executemany(sql, rows)
        count += len(rows)
        connection.commit()
        print(f"nyc-taxi: processed {count} rows", flush=True)
    rollup_count = build_taxi_rollup(connection)
    print(f"nyc-taxi: built {rollup_count} daily pickup-zone aggregate rows", flush=True)
    return parquet, count


def process_otel(data_dir: Path, connection: sqlite3.Connection) -> tuple[Path, int]:
    raw_dir = data_dir / "otel-demo" / "raw"
    manifests = sorted(raw_dir.glob("*/manifest.json"))
    if not manifests:
        raise DatasetUnavailable(
            f"otel-demo capture not found in {raw_dir}; run `pnpm data:collect:otel -- --duration 300`"
        )
    for table in (
        "otel_log_minute_rollup",
        "otel_metric_minute_rollup",
        "otel_service_edge_rollup",
        "otel_service_minute_rollup",
        "otel_logs",
        "otel_metric_points",
        "otel_spans",
        "otel_services",
        "otel_capture_runs",
    ):
        reset_table(connection, table)
    total_rows = 0
    for manifest_path in manifests:
        verify_checksums(manifest_path.parent)
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        capture_id = str(manifest.get("captureId") or manifest_path.parent.name)
        source = manifest.get("source") if isinstance(manifest.get("source"), dict) else {}
        traces_path = manifest_path.parent / "traces.jsonl"
        metrics_path = manifest_path.parent / "metrics.jsonl"
        logs_path = manifest_path.parent / "logs.jsonl"
        missing = [path.name for path in (traces_path, metrics_path, logs_path) if not path.is_file()]
        if missing:
            raise DatasetUnavailable(f"otel-demo capture {capture_id} is missing: {', '.join(missing)}")
        connection.execute(
            """
            INSERT INTO otel_capture_runs
            (capture_id, source_revision, started_at, ended_at, duration_seconds,
             scenario, source_path, manifest_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                capture_id,
                str(source.get("revision") or "unknown"),
                str(manifest.get("startedAt") or ""),
                str(manifest.get("endedAt") or ""),
                int(manifest.get("durationSeconds") or 0),
                str(manifest.get("scenario") or "unspecified"),
                str(manifest_path.parent),
                compact_json(manifest),
            ),
        )
        span_count = process_otel_traces(connection, capture_id, traces_path)
        metric_count = process_otel_metrics(connection, capture_id, metrics_path)
        log_count = process_otel_logs(connection, capture_id, logs_path)
        total_rows += span_count + metric_count + log_count
        connection.commit()
        print(
            f"otel-demo: {capture_id} loaded {span_count} spans, "
            f"{metric_count} metric points, {log_count} logs",
            flush=True,
        )
    service_rows, edge_rows, metric_rows, log_rows = build_otel_rollups(connection)
    print(
        f"otel-demo: built {service_rows} service-minute, {edge_rows} service-edge, "
        f"{metric_rows} metric-minute, {log_rows} log-minute aggregate rows",
        flush=True,
    )
    return manifests[-1], total_rows


PROCESSORS = {
    "aviation-ontime": process_aviation,
    "online-retail-ii": process_retail,
    "beijing-air-quality": process_air_quality,
    "nyc-taxi": process_taxi,
    "otel-demo": process_otel,
}


@app.command()
def process(
    dataset: DatasetName = typer.Option(DatasetName.ALL, "--dataset", help="Dataset to process; defaults to all supported datasets."),
    db: Path | None = typer.Option(None, "--db", help="SQLite output path; defaults to data/dashboard.sqlite."),
    strict: bool = typer.Option(False, "--strict", help="Fail when raw data or optional dependencies are missing."),
) -> None:
    script_dir = Path(__file__).resolve().parent
    data_dir = script_dir.parent / "data"
    database = db or data_dir / "dashboard.sqlite"
    database.parent.mkdir(parents=True, exist_ok=True)
    selected = DATASETS if dataset == DatasetName.ALL else (dataset.value,)
    connection = sqlite3.connect(database)
    connection.execute("PRAGMA journal_mode=WAL")
    create_schema(connection)
    for dataset in selected:
        try:
            source, row_count = PROCESSORS[dataset](data_dir, connection)
            connection.execute(
                """
                INSERT OR REPLACE INTO dataset_runs
                (dataset_id, source_path, source_sha256, processed_at, row_count, status, error)
                VALUES (?, ?, ?, datetime('now'), ?, 'processed', NULL)
                """,
                (dataset, str(source), sha256(source), row_count),
            )
            connection.commit()
            print(f"{dataset}: processed {row_count} rows from {source.name}")
        except DatasetUnavailable as error:
            connection.rollback()
            print(f"{dataset}: skipped - {error}", file=sys.stderr)
            if strict:
                connection.close()
                raise typer.Exit(code=2)
    connection.close()


if __name__ == "__main__":
    app()
