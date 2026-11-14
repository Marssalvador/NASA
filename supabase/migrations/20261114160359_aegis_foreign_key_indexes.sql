-- Covering indexes for foreign keys reported by the performance advisor (lint 0001).
create index assessment_feedback_reviewer on aegis.assessment_feedback (reviewer_user_id);
create index astronaut_access_granted_by on aegis.astronaut_access (granted_by);
create index derived_features_biomarker on aegis.derived_features (biomarker_id);
create index measurements_biomarker_unit on aegis.measurements (biomarker_id, unit);
create index measurements_ingested_by on aegis.measurements (ingested_by);
create index medical_history_recorded_by on aegis.medical_history (recorded_by);
create index baselines_biomarker on aegis.physiological_baselines (biomarker_id);
create index baselines_parent on aegis.physiological_baselines (parent_id);
create index risk_assessments_model_version on aegis.risk_assessments (model_version_id);
create index risk_assessments_risk on aegis.risk_assessments (risk_id);
create index risk_assessments_supersedes on aegis.risk_assessments (supersedes_id);
create index test_requests_assessment on aegis.test_requests (assessment_id);
create index test_requests_biomarker on aegis.test_requests (biomarker_id);
create index test_requests_decided_by on aegis.test_requests (decided_by);
create index test_requests_reevaluation on aegis.test_requests (reevaluation_assessment_id);
create index test_requests_result on aegis.test_requests (result_measurement_id);
