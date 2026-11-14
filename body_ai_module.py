from __future__ import annotations

import json
import math
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

from body_data_loader import load_dataset


TARGET_FEATURES = [
    "shoulder_width",
    "torso_width",
    "torso_height",
    "waist_width",
    "hip_width",
    "head_radius",
    "arm_length",
    "leg_length",
    "muscle_intensity",
    "symmetry_bias",
]


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


@dataclass
class BodyRenderProfile:
    sex: str
    shoulder_width: float
    torso_width: float
    torso_height: float
    waist_width: float
    hip_width: float
    head_radius: float
    arm_length: float
    leg_length: float
    muscle_intensity: float
    symmetry_bias: float


class PhysiologicalBodyModel:
    """Simple learning module that maps physiological data to body rendering parameters."""

    def __init__(self, model_path: str | Path | None = None):
        self.model_path = Path(model_path) if model_path else Path("output/body_ai_model.json")
        self.weights: Dict[str, List[float]] = {}
        self.means: Dict[str, float] = {}
        self.stds: Dict[str, float] = {}
        self.feature_names: List[str] = [
            "bias",
            "sex_male",
            "age",
            "height_cm",
            "weight_kg",
            "waist_cm",
            "hip_cm",
            "chest_cm",
            "muscle_mass_kg",
            "body_fat_pct",
        ]

    def _feature_vector(self, sample: PhysiologicalInput) -> List[float]:
        sex_value = 1.0 if sample.sex.lower() == "male" else 0.0
        return [
            1.0,
            sex_value,
            float(sample.age),
            float(sample.height_cm),
            float(sample.weight_kg),
            float(sample.waist_cm),
            float(sample.hip_cm),
            float(sample.chest_cm),
            float(sample.muscle_mass_kg),
            float(sample.body_fat_pct),
        ]

    def _standardize(self, value: float, mean: float, std: float) -> float:
        if std == 0:
            return 0.0
        return (value - mean) / std

    def _generate_synthetic_dataset(self, rows: int = 200) -> List[Tuple[PhysiologicalInput, BodyRenderProfile]]:
        dataset: List[Tuple[PhysiologicalInput, BodyRenderProfile]] = []
        for index in range(rows):
            sex = "male" if index % 2 == 0 else "female"
            age = 18 + (index % 22)
            height = 160 + ((index * 7) % 34)
            weight = 52 + ((index * 11) % 60)
            waist = 64 + ((index * 5) % 25)
            hip = 82 + ((index * 7) % 28)
            chest = 84 + ((index * 9) % 30)
            muscle_mass = 25 + ((index * 3) % 20)
            body_fat = 12 + ((index * 2) % 19)

            sample = PhysiologicalInput(
                sex=sex,
                age=age,
                height_cm=height,
                weight_kg=weight,
                waist_cm=waist,
                hip_cm=hip,
                chest_cm=chest,
                muscle_mass_kg=muscle_mass,
                body_fat_pct=body_fat,
            )

            is_female = sex == "female"
            scale = (weight - 45) / 75
            shoulder = 34 + scale * 18 + (0 if not is_female else -4)
            torso_w = 27 + scale * 12 + (2 if is_female else 0)
            torso_h = 52 + scale * 18
            waist_w = 23 + scale * 10 + (5 if is_female else 0)
            hip_w = 25 + scale * 12 + (7 if is_female else 0)
            head_r = 8 + (2 if is_female else 3)
            arm_l = 38 + scale * 12
            leg_l = 42 + scale * 15
            muscle_intensity = 0.62 + (muscle_mass / 100.0) + (0.08 if sex == "male" else -0.04)
            symmetry_bias = 0.04 if sex == "male" else 0.02

            profile = BodyRenderProfile(
                sex=sex,
                shoulder_width=shoulder,
                torso_width=torso_w,
                torso_height=torso_h,
                waist_width=waist_w,
                hip_width=hip_w,
                head_radius=head_r,
                arm_length=arm_l,
                leg_length=leg_l,
                muscle_intensity=min(max(muscle_intensity, 0.35), 1.1),
                symmetry_bias=symmetry_bias,
            )
            dataset.append((sample, profile))
        return dataset

    def _compute_means_and_stds(self, dataset: Iterable[PhysiologicalInput]) -> None:
        sample_list = list(dataset)
        if not sample_list:
            raise ValueError("No data to train on.")

        feature_count = len(self.feature_names) - 1
        for idx in range(feature_count):
            values = [self._feature_vector(sample)[idx + 1] for sample in sample_list]
            mean = sum(values) / len(values)
            variance = sum((value - mean) ** 2 for value in values) / max(len(values), 1)
            self.means[self.feature_names[idx + 1]] = mean
            self.stds[self.feature_names[idx + 1]] = math.sqrt(variance) if variance > 0 else 1.0

    def _train_target(self, feature_rows: List[List[float]], target_values: List[float], learning_rate: float = 0.01, epochs: int = 5000) -> List[float]:
        weights = [0.0 for _ in feature_rows[0]]
        for _ in range(epochs):
            total_error = 0.0
            for row, target in zip(feature_rows, target_values):
                prediction = sum(w * x for w, x in zip(weights, row))
                error = target - prediction
                total_error += error * error
                for idx, x in enumerate(row):
                    weights[idx] += learning_rate * error * x / max(len(row), 1)
            if total_error < 1e-9:
                break
        return weights

    def fit(self, training_data: List[Tuple[PhysiologicalInput, BodyRenderProfile]]) -> Dict[str, List[float]]:
        if not training_data:
            raise ValueError("Training data is empty.")

        self.weights = {}
        feature_rows: List[List[float]] = []
        for sample, _ in training_data:
            feature_rows.append(self._feature_vector(sample))

        self._compute_means_and_stds([sample for sample, _ in training_data])

        for target_name in TARGET_FEATURES:
            target_values: List[float] = []
            for _, profile in training_data:
                value = getattr(profile, target_name)
                target_values.append(float(value))

            normalized_rows: List[List[float]] = []
            for row in feature_rows:
                normalized = []
                for index, feature_name in enumerate(self.feature_names):
                    if feature_name == "bias":
                        normalized.append(1.0)
                    else:
                        raw_value = row[index]
                        feature_mean = self.means.get(feature_name, 0.0)
                        feature_std = self.stds.get(feature_name, 1.0)
                        normalized.append(self._standardize(raw_value, feature_mean, feature_std))
                normalized_rows.append(normalized)

            weights = self._train_target(normalized_rows, target_values)
            self.weights[target_name] = weights

        return self.weights

    def fit_from_dataset(self, samples: List[PhysiologicalInput]) -> Dict[str, List[float]]:
        training_data = []
        for sample in samples:
            rendered = self._profile_from_sample(sample)
            training_data.append((sample, rendered))
        return self.fit(training_data)

    def _profile_from_sample(self, sample: PhysiologicalInput) -> BodyRenderProfile:
        is_female = sample.sex.lower() == "female"
        scale = (sample.weight_kg - 45) / 75
        return BodyRenderProfile(
            sex=sample.sex.lower(),
            shoulder_width=34 + scale * 18 + (0 if not is_female else -4),
            torso_width=27 + scale * 12 + (2 if is_female else 0),
            torso_height=52 + scale * 18,
            waist_width=23 + scale * 10 + (5 if is_female else 0),
            hip_width=25 + scale * 12 + (7 if is_female else 0),
            head_radius=8 + (2 if is_female else 3),
            arm_length=38 + scale * 12,
            leg_length=42 + scale * 15,
            muscle_intensity=min(max(0.62 + (sample.muscle_mass_kg / 100.0) + (0.08 if sample.sex.lower() == "male" else -0.04), 0.35), 1.1),
            symmetry_bias=0.04 if sample.sex.lower() == "male" else 0.02,
        )

    def predict(self, sample: PhysiologicalInput) -> BodyRenderProfile:
        if not self.weights:
            raise ValueError("Model must be trained before prediction.")

        feature_vector = self._feature_vector(sample)
        normalized = []
        for index, feature_name in enumerate(self.feature_names):
            if feature_name == "bias":
                normalized.append(1.0)
            else:
                raw_value = feature_vector[index]
                feature_mean = self.means.get(feature_name, 0.0)
                feature_std = self.stds.get(feature_name, 1.0)
                normalized.append(self._standardize(raw_value, feature_mean, feature_std))

        predictions = {}
        for target_name in TARGET_FEATURES:
            weights = self.weights[target_name]
            prediction = sum(w * x for w, x in zip(weights, normalized))
            predictions[target_name] = prediction

        return BodyRenderProfile(
            sex=sample.sex.lower(),
            shoulder_width=predictions["shoulder_width"],
            torso_width=predictions["torso_width"],
            torso_height=predictions["torso_height"],
            waist_width=predictions["waist_width"],
            hip_width=predictions["hip_width"],
            head_radius=predictions["head_radius"],
            arm_length=predictions["arm_length"],
            leg_length=predictions["leg_length"],
            muscle_intensity=max(0.3, min(1.2, predictions["muscle_intensity"])),
            symmetry_bias=max(0.0, min(0.25, predictions["symmetry_bias"])),
        )

    def save(self, path: str | Path | None = None) -> str:
        output_path = Path(path) if path else self.model_path
        output_path.parent.mkdir(parents=True, exist_ok=True)

        payload = {
            "feature_names": self.feature_names,
            "means": self.means,
            "stds": self.stds,
            "weights": self.weights,
        }
        output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return str(output_path)

    def load(self, path: str | Path | None = None) -> None:
        input_path = Path(path) if path else self.model_path
        payload = json.loads(input_path.read_text(encoding="utf-8"))
        self.feature_names = payload.get("feature_names", self.feature_names)
        self.means = payload.get("means", {})
        self.stds = payload.get("stds", {})
        self.weights = payload.get("weights", {})


def train_default_model(model_path: str | Path | None = None) -> PhysiologicalBodyModel:
    model = PhysiologicalBodyModel(model_path=model_path)
    dataset_path = Path("data/body_profile_dataset.csv")
    if dataset_path.exists():
        try:
            dataset = load_dataset(dataset_path)
            model.fit_from_dataset(dataset)
        except Exception:
            dataset = model._generate_synthetic_dataset(rows=180)
            model.fit(dataset)
    else:
        dataset = model._generate_synthetic_dataset(rows=180)
        model.fit(dataset)
    model.save(model.model_path)
    return model


def predict_for_profile(sample: PhysiologicalInput, model_path: str | Path | None = None) -> BodyRenderProfile:
    model = PhysiologicalBodyModel(model_path=model_path)
    if Path(model_path).exists() if model_path else model.model_path.exists():
        model.load(model_path if model_path else model.model_path)
    else:
        train_default_model(model_path if model_path else model.model_path)
        model.load(model_path if model_path else model.model_path)
    return model.predict(sample)


def write_render_profile_file(profile: BodyRenderProfile, path: str | Path = "output/body_render_profile.json") -> str:
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps({"render_profile": asdict(profile)}, indent=2), encoding="utf-8")
    return str(output_path)


def main() -> None:
    sample = PhysiologicalInput(
        sex="male",
        age=29,
        height_cm=181,
        weight_kg=78,
        waist_cm=82,
        hip_cm=96,
        chest_cm=101,
        muscle_mass_kg=39,
        body_fat_pct=17,
    )

    model = train_default_model("output/body_ai_model.json")
    profile = model.predict(sample)
    write_render_profile_file(profile, "output/body_render_profile.json")
    output = {
        "input": asdict(sample),
        "render_profile": asdict(profile),
    }
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
