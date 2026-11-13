"""Deterministic synthetic demonstration data, not clinical reference data."""
import argparse
import json
import math
import random
import statistics
from pathlib import Path

CREW = [
    dict(id="A", name="Ana", sex="F", age=36, module="Lab", hr=64, rr=14, spo2=98, sbp=112, temp=36.6),
    dict(id="B", name="Ben", sex="M", age=41, module="Lab", hr=58, rr=13, spo2=97, sbp=122, temp=36.5),
    dict(id="C", name="Carla", sex="F", age=33, module="Hab", hr=68, rr=15, spo2=98, sbp=108, temp=36.7),
    dict(id="D", name="Diego", sex="M", age=45, module="Hab", hr=62, rr=14, spo2=97, sbp=126, temp=36.6),
]
ANA = {18: dict(hr=92, rr=19, temp=37.8),
       19: dict(hr=105, rr=22, temp=38.5, spo2=95),
       20: dict(hr=116, rr=24, temp=39.2, spo2=94)}
NOISE = dict(hr=3, rr=1, spo2=0.7, sbp=5, temp=0.15)

def generate(seed=42):
    rng = random.Random(seed)
    vitals, daily, environment = [], [], []
    for person in CREW:
        for day in range(30):
            for hour in range(24):
                cycle = math.sin(2 * math.pi * (hour - 9) / 24)
                row = dict(astro=person["id"], day=day, hour=hour, synthetic=True)
                for key, spread in NOISE.items():
                    # Bounded uniform noise: the guide's +/- values are treated as bounds.
                    value = person[key] + rng.uniform(-spread, spread)
                    if key == "hr": value += 4 * cycle
                    if key == "temp": value += 0.2 * cycle
                    row[key] = round(min(100, value)) if key == "spo2" else round(value, 1) if key == "temp" else round(value)
                row.update(alert=True, on_oxygen=False, perfusion_index=round(rng.uniform(2, 5), 1))
                # Exact scripted values take precedence over noise for reproducible stories.
                if person["id"] == "A" and day in ANA:
                    row.update(ANA[day])
                if person["id"] == "D" and day == 25:
                    row.update(hr=97, rr=20)
                vitals.append(row)
            d = dict(astro=person["id"], day=day, synthetic=True,
                     sleep_h=round(rng.uniform(6.5, 7.5), 1), kss=rng.randint(2, 4),
                     pvt_lapses=rng.randint(0, 2), pvt_median_ms=round(rng.uniform(260, 300)),
                     feeling="fine", symptoms=[], eva_scheduled=False)
            if person["id"] == "A" and day in ANA:
                d.update(feeling="not fine", symptoms=["fever"] if day >= 19 else ["fatigue"])
            if person["id"] == "B" and 10 <= day <= 14:
                d.update(sleep_h=round(rng.uniform(5, 5.5), 1), kss=rng.randint(7, 8),
                         pvt_lapses=rng.randint(6, 9), pvt_median_ms=340, feeling="not fine")
            if person["id"] == "B" and day == 15:
                d["eva_scheduled"] = True
            if person["id"] == "C" and day == 22:
                d.update(symptoms=["headache"], feeling="not fine")
            daily.append(d)
        baseline = [r for r in vitals if r["astro"] == person["id"] and r["day"] < 7]
        for key in ("hr", "rr", "spo2", "temp"):
            mean = statistics.mean(r[key] for r in baseline)
            std = statistics.stdev(r[key] for r in baseline)
            for row in vitals:
                if row["astro"] == person["id"]:
                    row[key + "_z"] = round((row[key] - mean) / std, 2) if std else None
    for module in ("Lab", "Hab"):
        for day in range(30):
            for hour in range(24):
                co2 = 3.6 if module == "Hab" and day == 22 and 10 <= hour <= 13 else round(rng.uniform(1.7, 2.3), 2)
                environment.append(dict(module=module, day=day, hour=hour, co2_mmHg=co2, synthetic=True))
    return {"crew.json": [dict(p, synthetic=True) for p in CREW], "vitals.json": vitals,
            "daily.json": daily, "environment.json": environment}

def write_data(output, seed=42):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    data = generate(seed)
    for filename, rows in data.items():
        (output / filename).write_text(json.dumps(rows, ensure_ascii=False, allow_nan=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return {name: len(rows) for name, rows in data.items()}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out", type=Path, default=Path(__file__).resolve().parents[1] / "app/public/data")
    args = parser.parse_args()
    print(json.dumps({"synthetic": True, "output": str(args.out.resolve()), "rows": write_data(args.out, args.seed)}, indent=2))
