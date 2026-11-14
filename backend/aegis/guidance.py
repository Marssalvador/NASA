import json
from .registry import ROOT
from .schemas import Finding, MeasurementRequest, GuidanceProtocol

EMERGENCY_SYMPTOMS = {'chest_pain', 'severe_breathlessness', 'loss_of_consciousness'}


class GuidanceEngine:
    def evaluate(self, analyses, definitions, events):
        findings, requests, guidance = [], [], []
        emergency = any(e['symptom'] in EMERGENCY_SYMPTOMS for e in events)
        if emergency:
            findings.append(Finding(id='declared-emergency', status='emergency', title='Emergencia por síntoma declarado',
                                    explanation='Alerta directa independiente de la IA. Activar el protocolo de emergencia aprobado de la misión. No hay un protocolo clínico validado instalado en esta demo.'))
        for a in analyses:
            if a.status == 'stable':
                continue
            d = definitions[a.metric_id]
            reason = 'Desviación del patrón personal (heurística |z| ≥ 3).' if a.status == 'review' else {
                'stale': 'Medición caducada según la frecuencia de adquisición configurada.',
                'missing': 'Falta una medición disponible.', 'poor_quality': 'Calidad insuficiente en la última adquisición.',
                'available': 'Faltan muestras o un baseline previo compatible.'}[a.data_state]
            findings.append(Finding(id=f'metric-{d.id}', metric_id=d.id, status=a.status,
                                    title=d.name, explanation=reason))
            requests.append(MeasurementRequest(metric_id=d.id, reason=reason,
                                                how_to_measure=f'Método registrado: {d.measurement_method}. Verificar identificación, unidad y calidad de la adquisición conforme al procedimiento local.'))
        # Only reviewed local protocols may supply medical recommendations.
        protocol_file = ROOT / 'data' / 'guidance_protocols.json'
        protocols = [GuidanceProtocol.model_validate(x) for x in json.loads(protocol_file.read_text(encoding='utf-8'))]
        for finding in findings:
            trigger = 'emergency' if finding.status == 'emergency' else finding.metric_id
            protocol = next((p for p in protocols if p.trigger == trigger and p.validation_status == 'reviewed'), None)
            if protocol:
                guidance.append(protocol)
            else:
                guidance.append(GuidanceProtocol(id=f'pending-{finding.id}', trigger=str(trigger),
                    explanation=finding.explanation, suggested_check='Pendiente de revisión médica',
                    how_to_measure='La demo solo solicita verificar la adquisición; no prescribe intervenciones.',
                    reference='Sin protocolo clínico revisado instalado.', authorization_level='medical_review_required',
                    validation_status='pending_medical_review'))
        overall = 'emergency' if emergency else 'review' if any(a.status == 'review' for a in analyses) else 'insufficient_data' if any(a.status == 'insufficient_data' for a in analyses) or not analyses else 'stable'
        return overall, findings, requests, guidance
