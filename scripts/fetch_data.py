"""
Kardashev Type 1 Tracker — Data Pipeline
=========================================
Fetches global energy data from Our World in Data and writes clean JSON
files consumed by the frontend. Run this script once a year (or whenever
new annual data is published) to refresh the site's numbers.

Primary source: Our World in Data energy dataset (backed by the Energy
Institute Statistical Review and IEA).
  https://github.com/owid/energy-data

Sector data: IEA World Energy Balances (static per edition; update the
SECTOR_DATA dict below each year when IEA publishes new figures).

Usage:
    python3 scripts/fetch_data.py          # uses cached CSV if present
    python3 scripts/fetch_data.py --fresh  # force re-download
"""

import argparse
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import requests

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "data"
CACHE_DIR = Path(__file__).parent / "cache"

# ---------------------------------------------------------------------------
# Source URLs
# ---------------------------------------------------------------------------
OWID_CSV_URL = (
    "https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv"
)
# GitHub API: latest commit that touched the CSV (gives us publication date)
OWID_COMMIT_URL = (
    "https://api.github.com/repos/owid/energy-data/commits"
    "?path=owid-energy-data.csv&page=1&per_page=1"
)

# ---------------------------------------------------------------------------
# Kardashev physics
# ---------------------------------------------------------------------------
# Type 1 threshold: ~10^16 W (Sagan's definition)
K1_THRESHOLD_W = 10**16

# Columns in OWID dataset → friendly labels
SOURCE_COLS = {
    "coal_consumption": "coal",
    "oil_consumption": "oil",
    "gas_consumption": "gas",
    "nuclear_consumption": "nuclear",
    "hydro_consumption": "hydro",
    "solar_consumption": "solar",
    "wind_consumption": "wind",
    "biofuel_consumption": "biofuels",
    "other_renewable_consumption": "other_renewables",
}

# ---------------------------------------------------------------------------
# Sector data — IEA World Energy Balances 2024 edition (data year 2022)
# Update this dict each year with new IEA figures.
# Source: https://www.iea.org/data-and-statistics/data-product/world-energy-balances
# Unit: TWh of final energy consumption (distinct from primary energy)
# ---------------------------------------------------------------------------
SECTOR_DATA = {
    "data_year": 2022,
    "edition": "IEA World Energy Balances 2024",
    "note": (
        "Final energy consumption (not primary energy). "
        "Primary energy is higher due to conversion and transmission losses. "
        "Update SECTOR_DATA in fetch_data.py each year when IEA publishes new figures."
    ),
    "source_url": "https://www.iea.org/data-and-statistics/data-product/world-energy-balances",
    "unit": "TWh",
    "world": {
        "industry": 43_400,       # ~37% — manufacturing, mining, construction
        "transport": 29_700,      # ~25% — road, aviation, shipping, rail
        "residential": 26_000,    # ~22% — heating, cooling, appliances
        "commercial": 11_200,     # ~10% — offices, retail, public buildings
        "agriculture": 4_500,     #  ~4% — farming, forestry, fishing
        "other": 2_400,           #  ~2% — non-energy use, etc.
    },
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def twh_per_year_to_watts(twh: float) -> float:
    """Convert energy consumption rate in TWh/year to average power in watts."""
    joules_per_twh = 1e12 * 3600          # 1 TWh = 3.6e15 J
    seconds_per_year = 365.25 * 24 * 3600
    return twh * joules_per_twh / seconds_per_year


def kardashev(power_w: float) -> float:
    """K = (log10(P) - 6) / 10  where P is in watts (Sagan 1973)."""
    return (math.log10(power_w) - 6) / 10


def safe_float(value, ndigits: int = 2):
    """Return a rounded float, or None if NaN/missing."""
    try:
        v = float(value)
        return None if math.isnan(v) else round(v, ndigits)
    except (TypeError, ValueError):
        return None


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"  wrote {path.relative_to(ROOT)}")


# ---------------------------------------------------------------------------
# Download
# ---------------------------------------------------------------------------

def fetch_dataset_published_date() -> str | None:
    """Ask GitHub when owid-energy-data.csv was last committed."""
    try:
        resp = requests.get(OWID_COMMIT_URL, timeout=15)
        resp.raise_for_status()
        commits = resp.json()
        if commits:
            iso = commits[0]["commit"]["committer"]["date"]  # e.g. "2024-09-10T14:23:00Z"
            dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
            return dt.strftime("%B %Y")   # e.g. "September 2024"
    except Exception as exc:
        print(f"  [warn] could not fetch dataset publish date: {exc}")
    return None


def download_owid_csv(force: bool = False) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = CACHE_DIR / "owid_energy.csv"

    if cache_path.exists() and not force:
        size_mb = cache_path.stat().st_size / 1e6
        print(f"  using cached OWID CSV ({size_mb:.1f} MB) — pass --fresh to re-download")
        return cache_path

    print("  downloading OWID energy dataset …", end=" ", flush=True)
    resp = requests.get(OWID_CSV_URL, timeout=120, stream=True)
    resp.raise_for_status()

    with open(cache_path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=65536):
            f.write(chunk)

    size_mb = cache_path.stat().st_size / 1e6
    print(f"done ({size_mb:.1f} MB)")
    return cache_path


# ---------------------------------------------------------------------------
# Processing
# ---------------------------------------------------------------------------

def load_and_validate(csv_path: Path) -> pd.DataFrame:
    df = pd.read_csv(csv_path, low_memory=False)
    required = {"country", "year", "iso_code", "primary_energy_consumption"}
    missing = required - set(df.columns)
    if missing:
        sys.exit(f"ERROR: OWID CSV is missing expected columns: {missing}")

    # Confirm source columns exist (OWID occasionally renames things)
    for col in SOURCE_COLS:
        if col not in df.columns:
            print(f"  [warn] source column not found in dataset: {col}")

    return df


def find_latest_complete_year(world_df: pd.DataFrame) -> int:
    """Latest year where the World row has primary_energy_consumption data."""
    valid = world_df.dropna(subset=["primary_energy_consumption"])
    if valid.empty:
        sys.exit("ERROR: no World-level primary energy data found in OWID dataset.")
    return int(valid["year"].max())


def find_best_country_year(df: pd.DataFrame, min_countries: int = 150) -> int:
    """
    Latest year where at least min_countries have primary energy data.
    World aggregate updates faster than individual country data, so this
    year may lag the global data year by one.
    """
    real = df[
        df["iso_code"].notna()
        & (~df["iso_code"].astype(str).str.startswith("OWID"))
    ]
    for year in sorted(real["year"].unique(), reverse=True):
        count = real[real["year"] == year].dropna(subset=["primary_energy_consumption"]).shape[0]
        if count >= min_countries:
            return int(year)
    sys.exit(f"ERROR: no year found with >= {min_countries} countries having primary energy data.")


def build_global(world_row: pd.Series, data_year: int, published: str | None) -> dict:
    total_twh = float(world_row["primary_energy_consumption"])
    total_w = twh_per_year_to_watts(total_twh)
    k = kardashev(total_w)
    # Progress: K goes 0→1 for Type 0→Type 1; clamp to [0,1] for display
    k_progress_pct = round(min(max(k, 0), 1) * 100, 4)

    return {
        "kardashev_number": round(k, 4),
        "kardashev_progress_pct": k_progress_pct,
        "kardashev_type1_threshold_w": K1_THRESHOLD_W,
        "total_primary_energy_twh": round(total_twh, 1),
        "average_power_tw": round(total_w / 1e12, 3),
        "data_year": data_year,
        "dataset_published": published or f"circa {data_year + 1}",
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "Our World in Data / Energy Institute Statistical Review",
        "source_url": "https://github.com/owid/energy-data",
    }


def build_by_source(world_df: pd.DataFrame, data_year: int, published: str | None) -> dict:
    world_row = world_df[world_df["year"] == data_year].iloc[0]

    current = {}
    for col, label in SOURCE_COLS.items():
        current[label] = safe_float(world_row.get(col), ndigits=1) or 0.0

    # 50-year historical trend — world total + source mix
    hist_rows = world_df[world_df["year"] >= data_year - 50].sort_values("year")
    trend = []
    for _, row in hist_rows.iterrows():
        pec = safe_float(row.get("primary_energy_consumption"), ndigits=1)
        if pec is None:
            continue
        sources = {
            label: safe_float(row.get(col), ndigits=1) or 0.0
            for col, label in SOURCE_COLS.items()
        }
        trend.append({
            "year": int(row["year"]),
            "total_twh": pec,
            "sources": sources,
        })

    return {
        "data_year": data_year,
        "dataset_published": published or f"circa {data_year + 1}",
        "unit": "TWh",
        "world": current,
        "trend": trend,
    }


def build_by_country(df: pd.DataFrame, data_year: int, published: str | None) -> dict:
    # All rows for latest year, real country ISO codes only
    latest = df[
        (df["year"] == data_year)
        & df["iso_code"].notna()
        & (~df["iso_code"].astype(str).str.startswith("OWID"))
    ].copy()

    countries = []
    for _, row in latest.iterrows():
        pec = safe_float(row.get("primary_energy_consumption"), ndigits=2)
        if pec is None or pec == 0:
            continue

        sources = {
            label: safe_float(row.get(col), ndigits=2) or 0.0
            for col, label in SOURCE_COLS.items()
        }

        countries.append({
            "iso": str(row["iso_code"]).upper(),
            "name": str(row["country"]),
            "primary_energy_twh": pec,
            "energy_per_capita_kwh": safe_float(row.get("energy_per_capita"), ndigits=0),
            "population": int(row["population"]) if safe_float(row.get("population")) else None,
            "sources": sources,
        })

    countries.sort(key=lambda x: x["primary_energy_twh"], reverse=True)

    return {
        "data_year": data_year,
        "dataset_published": published or f"circa {data_year + 1}",
        "unit": "TWh",
        "country_count": len(countries),
        "countries": countries,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main(force_download: bool = False) -> None:
    DATA_DIR.mkdir(exist_ok=True)

    print("\n[1/4] resolving dataset publish date …")
    published = fetch_dataset_published_date()
    print(f"  dataset last updated: {published or 'unknown'}")

    print("\n[2/4] fetching OWID energy CSV …")
    csv_path = download_owid_csv(force=force_download)

    print("\n[3/4] processing …")
    df = load_and_validate(csv_path)
    world_df = df[df["country"] == "World"].copy()

    global_year = find_latest_complete_year(world_df)
    country_year = find_best_country_year(df)
    world_row = world_df[world_df["year"] == global_year].iloc[0]

    print(f"  global data year   : {global_year}")
    print(f"  country data year  : {country_year}  (most recent with full coverage)")

    print("\n[4/4] writing JSON …")
    write_json(DATA_DIR / "global.json",     build_global(world_row, global_year, published))
    write_json(DATA_DIR / "by_source.json",  build_by_source(world_df, global_year, published))
    write_json(DATA_DIR / "by_country.json", build_by_country(df, country_year, published))
    write_json(DATA_DIR / "by_sector.json",  {
        **SECTOR_DATA,
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    })

    # Summary
    total_twh = float(world_row["primary_energy_consumption"])
    total_w = twh_per_year_to_watts(total_twh)
    k = kardashev(total_w)
    print(f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Global data year : {global_year}
  Country data year: {country_year}
  Dataset published: {published or 'unknown'}
  Primary energy   : {total_twh:,.0f} TWh/year
  Average power    : {total_w / 1e12:.2f} TW
  Kardashev K      : {k:.4f}
  Progress to K=1  : {min(k, 1) * 100:.2f}%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
""")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch and process Kardashev energy data.")
    parser.add_argument("--fresh", action="store_true", help="Force re-download of OWID CSV.")
    args = parser.parse_args()
    main(force_download=args.fresh)
