# AEGIS · Guía de desarrollo y uso

## Alcance

Aplicación de investigación completamente local, independiente de NASA. La aplicación y la base de datos funcionan sin conexión a internet después de instalar dependencias. Codex y la descarga inicial tienen sus propios requisitos de conexión. No hay telemetría de aplicación, CDN, fuentes remotas, servicios cloud ni APIs externas de IA. Los enlaces de referencias solo abren páginas externas si el usuario los pulsa.

No se ha validado ningún componente para decisiones clínicas. Las pruebas verifican comportamiento de software y cálculos, no eficacia médica. No hay protocolos médicos revisados instalados. No se administran tratamientos ni se calculan probabilidades de enfermedades.

## Ejecutar

Desde la raíz en PowerShell, después de la instalación del README:

```powershell
.\scripts\start.ps1
# Si el frontend ya está compilado:
.\scripts\start.ps1 -SkipBuild
# Otro puerto:
.\scripts\start.ps1 -Port 8080
```

Una única instancia FastAPI sirve el frontend compilado y la API desde http://127.0.0.1:8000. Se limita a loopback. Detener con Ctrl+C en esa terminal. En desarrollo, el frontend Vite puede ejecutarse aparte en el puerto 5173 y dirige /api al backend 8000. La documentación OpenAPI está en http://127.0.0.1:8000/docs.

SQLite se crea en data/aegis.sqlite. El primer inicio genera tres personas ficticias con una semilla fija y fechas relativas al primer inicio. Los baselines sintéticos tienen 24 muestras previas a los 30 días de misión y no se recalculan al importar. Las mediciones demo envejecen con el tiempo: pueden caducar en ejecuciones posteriores. El replay permite inspeccionar el periodo histórico. No se sobrescriben automáticamente bases de datos existentes. Se puede ejecutar una demo separada mediante AEGIS_DB_PATH, conservando la base original.

backend/requirements.lock.txt registra las versiones exactas verificadas con Python 3.14. frontend/package-lock.json fija el árbol de dependencias Node. Para reproducir ese entorno usar pip install -r backend/requirements.lock.txt y npm ci. En otras versiones de Python, requirements.txt permite seleccionar versiones compatibles dentro de los rangos declarados.

```powershell
$env:AEGIS_DB_PATH = "$PWD\data\otra-demo.sqlite"
.\scripts\start.ps1 -SkipBuild
```

## Flujo de la interfaz

1. Seleccionar astronauta: Elena (patrón estable), Alex (desviaciones y adquisiciones pendientes) o Kai (síntoma de emergencia declarado).
2. Pulsar una región del humanoide o su botón en Sistemas corporales. La lista también sirve para teclado y para la vista 3D.
3. Seleccionar un biomarcador para ver su evolución. Abrir **Ver análisis y procedencia** para revisar muestras, media, desviación, mediana, MAD, tendencia, baseline, origen e incertidumbre.
4. Cambiar el periodo de visualización o reproducir la misión con el control REPLAY. Cada paso consulta nuevamente el backend con as_of; los estados se recalculan sin colores fijados por escenario en React.
5. Abrir **Hallazgos / Ver todos** para comprobar el motivo, la adquisición sugerida, la referencia disponible, la autorización y el estado de validación.
6. Exportar resultados JSON desde el botón superior. La exportación CSV de mediciones está en el panel de ayuda (icono ?).

Los colores regionales agregan el estado de sus biomarcadores. Prioridad: emergencia, revisión, datos insuficientes, sin desviaciones. Una región puede mostrar revisión aunque también tenga mediciones insuficientes; cada tarjeta mantiene su estado individual. La emergencia por síntoma se muestra como alerta global; no colorea órganos como si existiera una localización de daño conocida.

## Añadir o modificar una variable

Editar data/biomarker_registry.json y abrir **Biomarcadores → Actualizar registro**. No es necesario recompilar ni reiniciar. Si otro proceso cambia el archivo mientras se lee, se debe guardar atómicamente (escribir temporal y reemplazar) para evitar JSON parcial.

Cada objeto debe cumplir el contrato BiomarkerDefinition. Ejemplo:

```json
{
  "id": "new_research_variable",
  "name": "Nueva variable de investigación",
  "unit": "a.u.",
  "body_system": "metabolic",
  "body_region": "metabolic",
  "sample_type": "sensor",
  "measurement_method": "Procedimiento local documentado por el equipo",
  "expected_frequency": 24,
  "reference_source": "Referencia real seleccionada por el equipo científico",
  "enabled": true
}
```

expected_frequency está expresada en horas: solo configura cuándo una adquisición se considera caducada. No es un umbral de seguridad. Las frecuencias, centros y dispersiones de los datos demo son parámetros sintéticos sin validación clínica. reference_source debe sustituirse por una fuente específica al acordar las variables definitivas. Los enlaces de NASA actualmente son contexto general, no respaldo de métodos o frecuencias.

Sistemas: cardiovascular, muscular, skeletal, renal, immune, neurological y metabolic. Regiones gráficas: heart, lungs, kidneys, muscles, skeleton, brain y metabolic. Se pueden añadir métricas libremente dentro de ellas. Crear una región visual nueva requiere extender el mapa y las geometrías. Cambiar la unidad de una métrica que ya tiene datos exige migrar esos datos explícitamente; no reutilizar un ID para una magnitud distinta.

## Importar CSV y JSON

**Importar datos** permite seleccionar persona, origen, archivo, fecha y procedencia sintética explícita. Un archivo pertenece a una sola persona. Si contiene astronaut_id, todas las filas deben coincidir con la selección. La etiqueta is_synthetic del archivo también debe coincidir con la selección.

Formato largo: columnas timestamp, metric_id, value, unit; la columna de fecha se puede cambiar en la interfaz. Columnas opcionales: astronaut_id, quality, measurement_method, is_synthetic. Las columnas largas de métrica, valor y unidad pueden renombrarse usando metric_column, value_column y unit_column en la API.

```csv
timestamp,metric_id,value,unit
2026-11-14T10:00:00+01:00,heart_rate,70,bpm
2026-11-14T10:05:00+01:00,heart_rate,71,bpm
```

Formato ancho: una columna por variable. Asociar cada columna a una métrica y confirmar su unidad. JSON debe ser un array de objetos, con el mismo contrato de columnas. CSV admite coma, punto y coma o tabulador y valores entrecomillados. Los archivos de ejemplo en data/ son **sintéticos**: seleccionar crew-01 y activar la casilla sintética. En example_wide.json asociar pulse → heart_rate / bpm y sugar → glucose / mmol/L.

Fechas ISO 8601 con zona horaria obligatoria, normalizadas a UTC. quality admite good, questionable, invalid o missing. Los valores vacíos se guardan como ausentes; NaN e infinito se rechazan. No se inventan límites fisiológicos. Se exige coincidencia de unidad; solo se convierten glucosa mmol/L → mg/dL (factor 18.0182) y temperatura °F → °C. No se infiere la equivalencia de unidades por su nombre.

La previsualización valida todo el archivo y no persiste registros. Una fila inválida impide guardar el lote completo. Los duplicados internos se rechazan; los ya guardados se omiten y cuentan. Clave de duplicado: persona, variable, fecha UTC, método y etiqueta sintética. El origen no crea una nueva medición si esa clave coincide. No existe una interfaz de edición destructiva de mediciones.

Límites del importador: 2 MB y 5000 filas. Admite una persona por lote, sin descubrimiento automático de identidad. Los parámetros de formato se validan en el backend. Revisar el informe antes de guardar. La exportación CSV conserva procedencia y aplica escape a textos que podrían ejecutarse como fórmulas al abrirlos con una hoja de cálculo.

## Estadística y baseline

backend/aegis/analysis.py funciona de forma independiente del frontend y del modelo. Usa NumPy para estadísticos descriptivos y SciPy para regresión y t de Student. pandas normaliza las fechas del importador.

- Excluye muestras ausentes y de calidad cuestionable o inválida. Muestra su número y las advertencias de calidad.
- La procedencia de la adquisición más reciente selecciona la cohorte. En un empate exacto de fecha, se prioriza la observación real. Nunca mezcla personas, observaciones sintéticas y reales ni baselines de procedencia distinta.
- Calcula media, desviación muestral (ddof=1), mediana, MAD sin escalar y pendiente descriptiva por día con al menos tres tiempos distintos.
- Compara la última observación aceptada con un baseline previo compatible. Requiere al menos tres observaciones y ocho muestras de baseline, dispersión positiva y baseline anterior a toda la cohorte de evaluación.
- La revisión |z| ≥ 3 es una **heurística demostrativa**. Los mínimos de muestras son reglas conservadoras de software, no validaciones estadísticas o clínicas universales. No representan umbrales de seguridad.
- Datos caducados, de mala calidad, ausentes o sin información suficiente producen insufficient_data, nunca normal.
- El IC 95 % de la media solo está habilitado en la función interna cuando el llamante declara explícitamente independencia y normalidad y hay al menos ocho muestras. El dashboard de series temporales no hace esa declaración y no dibuja intervalos. El campo de intervalo de predicción permanece vacío: no hay modelo con un estimador validado instalado.
- La pendiente no implica significación estadística. No se comprueban ajustes de confusores, comparaciones múltiples, cambios de método o calibración de instrumentos. No se debe interpretar el número de revisiones simultáneas como una probabilidad global.

Referencia de la fórmula del intervalo de la media y sus supuestos: [NIST, Confidence Limits for the Mean](https://www.itl.nist.gov/div898/handbook/eda/section3/eda352.htm). Contexto de investigación multiorgánico: [NASA CIPHER](https://www.nasa.gov/about-cipher/). Ninguna de estas referencias valida AEGIS.

Un baseline real debe proceder de un periodo separado, con método y contexto comparables, revisado por el equipo. Puede registrarse desde POST /api/baselines (ver /docs): astronaut_id, metric_id, mean, std, n, unit, start, end, is_synthetic y source. No se genera un baseline real a partir de los valores evaluados. La importación de datos reales en una persona ficticia conserva la etiqueta real de cada medición y muestra información insuficiente hasta disponer de un baseline real compatible. Para personas nuevas se usa POST /api/astronauts; el campo scenario es metadato de presentación, no determina la evaluación del motor.

## Instalar el modelo real

1. Implementar ModelAdapter de backend/aegis/adapters.py en un módulo Python local bajo models/.
2. Exponer create_adapter(), que devuelve una instancia con load(), validate_input(), predict(), explain() y get_metadata(). models/example_adapter.py es un ejemplo **demostrativo**, no un modelo entrenado.
3. Guardar pesos y preprocesamiento localmente; instalarlos solo desde fuentes confiables. Los módulos Python son código ejecutable local. No se descarga ni deserializa un modelo elegido por el navegador.
4. Entregar documentación: datos de entrenamiento y población, unidades, variables requeridas, tratamiento de ausencias, preprocesamiento, versiones, evaluación externa, calibración, sesgos y limitaciones. No hay un cargador genérico de pickle/joblib deliberadamente.
5. Configurar y reiniciar el backend:

```powershell
$env:AEGIS_MODEL_MODULE = 'models.my_adapter'
.\scripts\start.ps1 -SkipBuild
# Volver al mock:
Remove-Item Env:AEGIS_MODEL_MODULE
```

predict devuelve Prediction (consultar schemas.py): model_id, model_version, prediction, prediction_kind, uncertainty, input_quality, variables_used, missing_variables, explanation, validation_status, is_synthetic. El motor entrega objetos StatisticalAnalysis con sus series, calidad, baseline y ausencias; el adaptador realiza el preprocesamiento apropiado. No se puede asumir que un campo ausente vale cero.

prediction_kind distingue anomaly_score, unavailable y validated_disease_probability. El mock devuelve máximo |z|, uncertainty=null, demo_unvalidated e is_synthetic=true incluso si la entrada es real. Una probabilidad clínica exige metadata validated=true, calibrated=true, validation_reference, salida validation_status=validated y procedencia no sintética. Es una barrera de contrato y **no** una certificación: el equipo debe comprobar las evidencias. No se acepta una probabilidad disfrazada dentro de la puntuación de anomalía. La implementación del modelo real y su validación corresponden al equipo científico.

Si falla predict, el análisis estadístico y la alerta directa de síntomas siguen disponibles, con model_error explícito. Un fallo de carga del plugin al iniciar impide arrancar el backend: corregir el módulo o quitar AEGIS_MODEL_MODULE. Actualmente los modelos pueden aportar su propia salida y explicaciones; los estados regionales siguen siendo calculados por el análisis independiente para que un modelo sin validar no determine un estado clínico. Integrar predicciones calibradas como reglas operativas requiere una revisión separada.

## Reglas y protocolos

GuidanceEngine no depende del modelo. Los síntomas de alerta demostrativos chest_pain, severe_breathlessness y loss_of_consciousness activan directamente emergencia mediante eventos, sin exigir predicción. No es una lista clínica completa. POST /api/astronauts/{id}/symptoms permite registrar un evento fechado con procedencia explícita. La alerta persiste; su resolución necesita el flujo aprobado del equipo, aún sin interfaz de resolución.

data/guidance_protocols.json se entrega vacío. Sin protocolo revisado se muestra **Pendiente de revisión médica**. Las únicas comprobaciones automáticas se limitan a verificar identificación, unidad, calidad y método de adquisición. No son tratamientos ni procedimientos médicos nuevos.

Para instalar protocolos revisados, usar el contrato GuidanceProtocol: id, trigger (ID de métrica o emergency), explanation, suggested_check, how_to_measure, reference, authorization_level, validation_status=reviewed, reviewer y reviewed_at con zona horaria. El sistema exige evidencia documental declarada; no puede verificar por sí mismo la legitimidad de una revisión. La semántica de trigger actual es por variable o emergencia global, no un motor arbitrario de reglas clínicas.

## Humanoide y Blender

Blender MCP no está disponible en esta sesión. Se entrega el SVG interactivo de Humanoid.tsx y una vista React Three Fiber procedural en Body3D.tsx, ambos sin dependencias remotas. No se ha creado humanoid.glb ni .blend; assets/models/README.md documenta la integración futura.

Para sustituirlo por un modelo propio, guardar assets/models/humanoid.glb con su licencia, copiarlo a frontend/public/models/humanoid.glb durante el build y cargarlo con GLTFLoader/useGLTF desde /models/humanoid.glb. Mantener regiones separadas y nombres region_heart, region_lungs, region_kidneys, region_muscles, region_skeleton, region_brain y region_metabolic. Aplicar los estados a materiales, mapear clics a onSelect y conservar el selector de sistemas accesible y el SVG de reserva. No cargar recursos desde una URL externa. El modelo actual no usa anatomía exacta ni pretende hacerlo.

## Verificación

```powershell
.\.venv\Scripts\python -m pytest -q
cd frontend
npm test
npm run build
# Una sola vez para descargar el navegador de pruebas:
npx playwright install chromium
npm run test:e2e
```

Playwright levanta un servidor separado en 8001 con SQLite temporal; no toca data/aegis.sqlite. El servidor de desarrollo y el de pruebas sirven el frontend compilado: ejecutar build después de cambiar código. Las pruebas sin internet bloquean destinos externos y permiten loopback, incluida la carga diferida 3D. Esto verifica independencia de servicios externos; no convierte el sitio en una PWA capaz de funcionar con el backend detenido.

La base de datos local no se cifra y la aplicación no implementa autenticación multiusuario. No hay despliegue en red ni controles para investigación regulada. El modo de uso autorizado en esta versión es demostración e investigación local con datasets apropiados. Las copias de seguridad y las reglas de conservación de datos deberán definirse antes de usar información personal real.
