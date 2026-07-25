#!/usr/bin/env python3
"""Normalize downloaded example data into one SQLite database.

The script never creates fallback rows. A dataset is processed only when its
raw source file is present and readable.
"""

from __future__ import annotations

import csv
import hashlib
import io
import sqlite3
import sys
import zipfile
from datetime import date, datetime
from pathlib import Path
from enum import Enum
from typing import Any

import typer


DATASETS = (
    "aviation-ontime",
    "online-retail-ii",
    "beijing-air-quality",
    "nyc-taxi",
)
app = typer.Typer(add_completion=False, no_args_is_help=True, help="Clean downloaded example data into SQLite.")


class DatasetName(str, Enum):
    ALL = "all"
    AVIATION = "aviation-ontime"
    RETAIL = "online-retail-ii"
    AIR_QUALITY = "beijing-air-quality"
    TAXI = "nyc-taxi"
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
        """
    )
    try:
        connection.execute("ALTER TABLE aviation_airport_dictionary ADD COLUMN city_en TEXT NOT NULL DEFAULT ''")
    except sqlite3.OperationalError as error:
        if "duplicate column name" not in str(error):
            raise


def reset_table(connection: sqlite3.Connection, table: str) -> None:
    connection.execute(f"DELETE FROM {table}")


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
    return parquet, count


PROCESSORS = {
    "aviation-ontime": process_aviation,
    "online-retail-ii": process_retail,
    "beijing-air-quality": process_air_quality,
    "nyc-taxi": process_taxi,
}


@app.command()
def process(
    dataset: DatasetName = typer.Option(DatasetName.ALL, "--dataset", help="Dataset to process; defaults to all four supported datasets."),
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
