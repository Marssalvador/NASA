"""AEGIS medical intelligence: longitudinal record, physiological memory and evaluation engine.

Modules are independent and wired by `engine.Engine`:
  knowledge   versioned specification data (biomarkers, risks, protocols, cycle modifiers)
  validation  acceptance of incoming observations
  cycle       declared menstrual-cycle phase as a context modifier
  memory      individual baselines (initial stable vs recent), versioned, never auto-normalised
  features    temporal features named by the documented rules
  rules       evaluation of documented protocol triggers
  emergency   protocol-driven escalation, independent of any predictive model
  adapter     ModelAdapter contract for external trained models
  repository  storage contract: in-memory (offline/tests) and PostgreSQL (Supabase)
"""
