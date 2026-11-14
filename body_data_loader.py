from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path
from typing import List


@dataclass
class PhysiologicalInput:
    sex: str
    age: int
    height_cm: float
    weight_kg: float
    waist_cm: float
    hip_cm: float
    chest_cm: float
    muscle_mass_kg: float
    body_fat_pct: float


def load_dataset(dataset_path: str | Path = "data/body_profile_dataset.csv") -> List[PhysiologicalInput]:
    path = Path(dataset_path)
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")

    records: List[PhysiologicalInput] = []
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            records.append(
                PhysiologicalInput(
                    sex=row["sex"].strip().lower(),
                    age=int(float(row["age"])),
                    height_cm=float(row["height_cm"]),
                    weight_kg=float(row["weight_kg"]),
                    waist_cm=float(row["waist_cm"]),
                    hip_cm=float(row["hip_cm"]),
                    chest_cm=float(row["chest_cm"]),
                    muscle_mass_kg=float(row["muscle_mass_kg"]),
                    body_fat_pct=float(row["body_fat_pct"]),
                )
            )
    return records


def load_dataset_rows(dataset_path: str | Path = "data/body_profile_dataset.csv") -> List[dict]:
    path = Path(dataset_path)
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")

    with path.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))
