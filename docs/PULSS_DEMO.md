# PULSS — recorrido de presentación

## Abrir la demostración

La web de presentación se sirve en **http://127.0.0.1:8000**. Mantener el backend en ejecución mientras se presenta. Para volver a arrancarlo desde la raíz del proyecto:

```powershell
.\scripts\start.ps1 -Presentation -SkipBuild
```

`-Presentation` selecciona explícitamente el repositorio local que ya usa el motor médico. No necesita Supabase ni internet. Si faltara la compilación de la web, omitir `-SkipBuild`. El humanoide, las imágenes/vídeos de secciones y ambos temas conservan el diseño existente.

## Recorrido A — basal a patrón cardiovascular

1. Abrir la web. Se recupera A-112 y se crea una copia sintética `P-NNN` con sus datos de preflight y misión hasta el día 22. La referencia personal se calcula con el motor existente, sin usar los datos futuros.
2. Pulsar **Cardiovascular**. Observar frecuencia cardíaca, HRV, referencia personal y el análisis inicial del motor.
3. Pulsar **Iniciar simulación**. Cada paso añade las mediciones originales del día siguiente en orden cronológico: no mueve únicamente una gráfica ni sustituye respuestas de API.
4. Tras **dos pasos** (unos cuatro segundos en modo local), el motor detecta el patrón de FC/HRV y muestra **Sospecha · pendiente de confirmar**, con sus evidencias. Pulsar **Pausar**.
5. En **Tendencia**, comparar las medianas diarias UTC con la línea de referencia personal. Las reglas que exigen dos días se conservan; no se han acelerado sus umbrales clínicos, solo el tiempo de reproducción.

## Recorrido B — prueba adicional y reevaluación

1. Con el patrón detectado, bajar dentro del panel derecho hasta **Pruebas adicionales**.
2. En **Presión arterial sistólica**, pulsar **Registrar resultado**.
3. El valor de muestra **140 mmHg** es exclusivamente sintético, elegido para demostrar la ruta existente. No es un umbral nuevo ni una recomendación. Se puede introducir otro valor.
4. Pulsar **Guardar resultado y reevaluar**. El motor guarda la medición, completa la solicitud y realiza la reevaluación. El resultado de muestra produce **Hallazgo confirmado · no diagnóstico**.
5. Abrir **Evidencias originales** y una medición: el modal recupera el registro real de `/api/v2/measurements/{id}`, con fuente, fecha, calidad y procedencia sintética. La reevaluación identifica la evaluación anterior.

## Entrada manual y reinicio

- **Introducir medición** acepta una señal de capa 1, su valor y calidad. Se asigna el siguiente minuto del reloj virtual y se utiliza la misma validación e importación que `/api/v2/astronauts/{code}/measurements`. Después se llama al motor. Una lectura aislada no activa necesariamente una regla que exige varios días.
- Una adquisición ausente o de calidad insuficiente queda identificada; no se imputa como normal. Los valores caducados se muestran como «—» en la vista actual. Los sistemas sin una ruta del motor muestran datos insuficientes para concluir.
- **Reiniciar escenario** crea otra copia. No elimina ni sobrescribe A-112, los escenarios anteriores ni expedientes reales. Los ensayos anteriores permanecen en el repositorio mientras vive el proceso.
- Recargar la página recupera la misma sesión mediante su identificador local. Si el servidor local se ha reiniciado, se informa mediante la creación de un escenario nuevo; el almacenamiento local existente es **en memoria**, no se promete persistencia de sesiones después de cerrar Python.

## Motor, almacenamiento y API

El frontend activo usa `usePresentation.ts`, `/api/v2/demo/sessions` y el mismo motor `backend/aegis/medical/engine.py`. El módulo `demo.py` organiza la reproducción y las copias; no evalúa riesgos ni contiene umbrales clínicos. Reutiliza la importación validada, `Engine.evaluate`, `Engine.record_test_result`, `memory.daily` y `features.reference_for`. Las lecturas de seguimiento no crean evaluaciones: polling de 2,5 segundos, sin peticiones solapadas. Las mutaciones llevan identificador y revisión para evitar duplicados y respuestas atrasadas.

El modo PostgreSQL existente también admite las sesiones de demo con `-MedicalPostgres` en lugar de `-Presentation`, usando únicamente AEGIS-Development y `AEGIS_DATABASE_URL`. Se crean usuarios ficticios y copias sintéticas; no hay migraciones ni otro proyecto. Es más lento que la memoria local. Si no está configurado o no se puede conectar **antes de iniciar una sesión**, la demo pasa al repositorio local existente y lo indica en pantalla. Una sesión remota ya iniciada no se cambia silenciosamente de almacenamiento si falla la red.

No hay datos reales en estos recorridos, diagnóstico automatizado, nuevas reglas, entrenamiento ni solicitudes de generación de medios. `X-AEGIS-User` sigue siendo una identidad de desarrollo; la autenticación JWT y la validación clínica continúan pendientes.

## Verificación

- Python: **87 pruebas superadas**, 4 de integración PostgreSQL omitidas en la ejecución local ordinaria; incluyen siete pruebas nuevas de demo (recorrido real, duplicados/revisiones, reinicio, entrada manual, aislamiento y dos modos de fallback).
- Frontend: **19 pruebas Vitest superadas** y compilación de producción correcta.
- Navegador: **10 Playwright superadas**, con el backend real y sin respuestas clínicas simuladas. Cubren el recorrido A/B, evidencia original, entrada manual/calidad ausente, actualización por polling tras una escritura externa al componente, reinicio, atlas/capas/temas, recursos sin red externa, móvil, bloqueo de inclinación, fallo de imagen y restauración WebGL.
- Capturas: `docs/visual-review/pulss-basal.png`, `pulss-pattern.png`, `pulss-reevaluation.png`, `pulss-mobile.png`.

La prueba anterior de PostgreSQL y sus evidencias siguen en `docs/verification/postgres-live.json` y `postgres-http.json`. La verificación de esta demo contra Supabase, cuando se ejecuta, se registra por separado en `pulss-supabase.json`.
