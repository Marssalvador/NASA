# AEGIS

Local research demonstrator. Python/FastAPI + SQLite in backend/, React/TypeScript in frontend/. Never add cloud dependencies, external AI calls, runtime CDNs or remote fonts.

Biomarker definitions live in data/biomarker_registry.json and are read at request time. No metric-specific frontend branches. Keep analysis, persistence, guidance and model adapters independent. All measurement dates must have an explicit timezone; store UTC. Reject non-finite values and incompatible units. Preserve source, quality and synthetic provenance. Never pool people or synthetic and real observations. Baselines are separately recorded, never inferred from the same evaluation window.

Missing, expired, invalid-quality or inadequately sampled data cannot produce a normal evaluation. Statistical review flags are research heuristics, never clinical thresholds. No disease probabilities from unvalidated models. Medical guidance requires a reviewed local protocol with reviewer and reference; otherwise show 'Pendiente de revisión médica'. Declared emergency symptoms bypass model inference.

Use pytest for statistical, import, persistence and adapter behavior; Vitest for frontend logic; Playwright for browser flows. Run build and affected tests after changes. Document actual limitations in IMPLEMENTATION_STATUS.md. Make commits for functional phases. Do not commit datasets containing personal information or runtime SQLite files.
