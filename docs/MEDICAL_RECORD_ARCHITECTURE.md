# AEGIS Medical Intelligence — expediente longitudinal y motor de evaluación

Estado: noviembre de 2026 · entorno de desarrollo · **solo datos sintéticos** · sin validación clínica.

## 1. Piezas desacopladas

```
 Frontend (React)  ──HTTP──▶  FastAPI /api/v2  ──▶  Engine (Python)  ──▶  Repository
                                                      │                      ├─ InMemoryRepository (offline / tests)
                                                      │                      └─ PostgresRepository (Supabase, RLS)
                                                      └─ ModelAdapter (RuleEngineAdapter por defecto; modelos externos)
 Especificación versionada: data/biomarker_registry.json · data/medical/{risk_catalog,protocols,cycle_modifiers}.json
```

* **PostgreSQL / Supabase** — proyecto `AEGIS-Development` (`hudkkzrkwdbgoltrtlqu`, eu-central-1, plan gratuito). Esquema privado `aegis`, no expuesto a la Data API.
* **Motor Python** — `backend/aegis/medical/`. No depende de la base de datos: recibe un `Repository`.
* **Modo local u offline** — `AEGIS_RECORD_BACKEND=memory` (por defecto) carga los astronautas sintéticos en memoria; no requiere red.
* **Modo Supabase** — `AEGIS_RECORD_BACKEND=postgres` y `AEGIS_DATABASE_URL=<cadena de conexión del panel>`.

## 2. Esquema (`supabase/migrations/`)

| Migración | Contenido |
| --- | --- |
| `…160129_aegis_record_core` | 14 entidades + `audit_log`, restricciones, índices temporales, triggers de solo-añadir |
| `…160157_aegis_access_rls` | `astronaut_access`, funciones `can_read / can_write / is_flight_surgeon`, RLS en todas las tablas, privilegios mínimos |
| `…160340_aegis_reference_catalog` | **Generada** por `scripts/build_supabase_seed.py` desde los JSON de `data/` |
| `…160412_aegis_foreign_key_indexes` | Índices de claves foráneas (asesor de rendimiento) |
| `…160854_aegis_mission_start` | Inicio de misión en el perfil: separa la referencia inicial de la ventana evaluada |

Garantías verificadas en la base real con `supabase/tests/record_guarantees.sql` (transacción revertida):
aislamiento entre astronautas, `anon` sin acceso al esquema, imposibilidad de concederse permisos, mediciones y
evaluaciones inmutables incluso para el propietario, rechazo de NaN / unidad incompatible / duplicado, correcciones
encadenadas con motivo, revocación inmediata, el motor no puede registrar `clinical_diagnosis` ni
`disease_probability`. Asesor de seguridad de Supabase: sin hallazgos.

Trazabilidad: una corrección es una fila nueva con `supersedes_id` y `correction_reason`;
`aegis.current_measurements` muestra la versión vigente y `GET /api/v2/measurements/{id}` toda la cadena. Cada
evaluación guarda modelo y versión, entradas, entradas ausentes, ids de evidencia, incertidumbre, contexto y un
`reproducibility_hash`; las reevaluaciones enlazan la evaluación previa con `supersedes_id`.

## 3. Memoria fisiológica (`memory.py`)

* Agregado diario UTC (mediana) por biomarcador, solo calidad `good` y una sola cohorte de procedencia
  (real y sintético nunca se mezclan). Temperatura: lecturas de mañana (kb 2.3, «mismo momento del día»).
* **Referencia inicial estable**: solo preflight (antes de `mission_start`), mediana y 1,4826·MAD, mínimo 8 días.
* **Referencias por contexto**: con ciclo activo declarado, referencias `cycle_phase=follicular|luteal` para
  temperatura, HRV y FC (documento de ciclo §5), mínimo 5 días por fase.
* **Patrón reciente**: últimos 7 días de misión (mínimo 4).
* **Cambio persistente**: |z| ≥ 2 entre patrón reciente y referencia inicial → se informa; **la referencia inicial
  nunca se actualiza con datos de misión** (no se normaliza una posible alteración).
* **Versionado**: cada referencia guarda versión, padre e ids de entrada; con entradas idénticas se reutiliza.

## 4. Pipeline de evaluación (`engine.py`)

1. Validación al importar (`validation.py`): biomarcador registrado, unidad exacta del registro, zona horaria,
   valor finito, procedencia declarada, duplicados. Importación atómica: un error rechaza el lote.
2. Características (`features.py`): cambio diario frente a la referencia (delta, %, z robusto), último valor,
   métricas CGM de 7 días (TIR, CV, % <70, % <54) y noches con sueño < 6 h.
3. Anomalías individuales: |z| ≥ 3 en dos días consecutivos.
4. Patrón multivariable por riesgo: `ModelAdapter` (por defecto, recuento de señales disparadoras desviadas).
5. Reglas documentadas (`rules.py` sobre `protocols.json`).
6. Solicitud justificada de pruebas de capa 2 cuando hay sospecha y no hay confirmación reciente.
7. Reevaluación al registrar el resultado (`record_test_result`), con enlace a la evaluación anterior.

Las **emergencias** (`emergency.py`) se evalúan antes y aparte: fiebre ≥ 38 °C con malestar, glucosa < 54 mg/dL,
arritmia/dolor torácico/síncope declarados, signos de cetoacidosis, dolor de flanco o hematuria, dolor o sangrado
menstrual intenso, o cualquier evento declarado con severidad `emergency`. Si el modelo falla, las emergencias se
siguen devolviendo y el error se informa en `model_error`.

Vocabulario de certeza: `observation` → `suspicion` → `confirmed_finding`. `clinical_diagnosis` solo puede
registrarlo un profesional (`assessment_feedback`, rol `flight_surgeon`). Ninguna salida contiene probabilidades.

Recomendaciones: todas las reglas están `pending_medical_review`; la API muestra «Pendiente de revisión médica»,
incluye el texto documental de las contramedidas no farmacológicas como «propuesta no revisada» y **retiene** el
contenido farmacológico hasta que un protocolo tenga revisor, fecha y referencia.

## 5. ML (`adapter.py`)

`ModelAdapter.predict(ModelInput) -> list[ModelOutput]`. Cada salida incluye astronauta, periodo, entradas usadas,
calidad, resultado, incertidumbre, nombre/versión/estado de validación del modelo e ids de evidencia. `guard()`
rechaza otra persona u otro periodo, la ausencia de incertidumbre, cualquier clave de probabilidad en un modelo no
validado y cualquier probabilidad de enfermedad. Un modelo nuevo se registra en `aegis.model_versions` y se activa
con `AEGIS_MEDICAL_MODEL=paquete.modulo:Clase`, sin cambiar esquema ni API. No hay reentrenamiento automático.

## 6. API (`/api/v2`, cabecera `X-AEGIS-User`)

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/astronauts` | Expedientes con permiso explícito |
| GET | `/astronauts/{code}/record` | Perfil, último valor por biomarcador (con enlace), eventos, solicitudes abiertas, referencias |
| GET | `/astronauts/{code}/trends?biomarker=&days=` | Serie diaria con enlaces a cada medición y referencias |
| POST | `/astronauts/{code}/measurements` | Importación CSV/JSON validada y atómica |
| POST | `/measurements/{id}/corrections` | Corrección trazable |
| GET | `/measurements/{id}` | Medición original y su cadena de correcciones |
| POST | `/astronauts/{code}/evaluations?as_of=` | Ejecuta el pipeline y persiste |
| GET | `/astronauts/{code}/evaluations` | Historial inmutable |
| POST | `/test-requests/{id}/result` | Resultado de capa 2 → reevaluación |
| GET | `/astronauts/{code}/body-systems` | Regiones con hallazgos para resaltar en el frontend |

`X-AEGIS-User` es una identidad de desarrollo. En producción debe derivarse de un JWT de Supabase verificado
antes de llegar al router (no implementado en este demostrador).

## 7. Qué está validado y qué es demostrativo

| Elemento | Estado |
| --- | --- |
| Integridad, inmutabilidad, aislamiento RLS, unidades, duplicados, reproducibilidad | **Verificado por software** (pytest + SQL en la base real). No es validación clínica. |
| Estadística robusta (mediana, MAD, z) | Métodos estándar; su uso como alerta es **heurística de investigación**. |
| Umbrales HRV/FC y temperatura | Transcritos del documento del usuario (kb 2.1, 2.3); **orientativos, sin revisión médica**. |
| Umbrales CGM (TIR 70-180, CV 36 %, <70, <54) | Del documento (kb 2.4); el **nivel de alerta** asignado es supuesto del motor. |
| Sueño < 6 h «de forma repetida», «mantenida», ventanas de 7 días | **Supuestos del motor** declarados en `protocols.json → engine_assumptions`. |
| Rutas de riesgo (disparadores y confirmaciones) | **Hipótesis de diseño** documentales; ninguna validada. |
| Ajustes por fase del ciclo | Del documento de ciclo; la escala proporcional de la fase es supuesto del motor. |
| Sensores de sudor/ISF (lactato, electrolitos, cortisol, hormonas) | **Experimentales**; desactivados en el panel hasta disponer de datos. |
| Contramedidas farmacológicas | **Retenidas** hasta revisión médica. |
| RuleEngineAdapter | `demo_unvalidated`: recuento de señales, sin entrenamiento ni calibración. |

## 8. Operación

* Regenerar el catálogo tras cambiar los JSON: `python scripts/build_supabase_seed.py <nueva migración>`.
* Astronauta sintético de ejemplo en Supabase: `supabase/seed/synthetic_a112.sql` (A-112, 796 mediciones).
* Las versiones de `supabase/migrations` coinciden con el historial remoto.
* Prueba de integración Postgres: `AEGIS_DATABASE_URL=… pytest tests/test_medical_postgres.py` (se omite sin la variable).
* Pendiente: conceder accesos reales (`astronaut_access`) a usuarios de Supabase Auth, verificación del JWT en la
  API, conexión del frontend a `/api/v2` y revisión médica de los protocolos.

## 9. Verificación real de PostgreSQL — superada el 14 de noviembre de 2026

El usuario introdujo la contraseña de forma oculta mediante `scripts/configure-postgres.ps1`; la conexión se guardó como variable de usuario `AEGIS_DATABASE_URL`, fuera del repositorio. **La conexión al proyecto `hudkkzrkwdbgoltrtlqu` y las cuatro pruebas PostgreSQL han pasado**, sin pruebas omitidas en esa ejecución: `4 passed` en 168,28 s. Se conservan además las 80 pruebas locales superadas en la ejecución anterior. Las cinco migraciones locales coinciden exactamente con las cinco versiones aplicadas; no se modificaron ni volvieron a aplicar.

Se corrigieron problemas encontrados en la revisión y cubiertos por regresiones locales:

- El repositorio de cada solicitud conserva una identidad independiente: las lecturas de mediciones, eventos, referencias, evaluaciones y solicitudes también usan `authenticated`, no solo la consulta inicial de permisos. Los resultados internos del motor usan explícitamente `service_role`, como requieren las políticas existentes.
- Registrar el resultado de una prueba exige permiso de médico de vuelo y escritura, antes de insertar mediciones. Las actualizaciones que RLS deja sin filas ya no se consideran exitosas.
- La API de correcciones selecciona la medición solicitada de la cadena, conservando la original.
- Los errores al abrir una conexión no exponen el mensaje del controlador, que podría contener la URL. Las conexiones tienen un tiempo máximo de establecimiento de 12 segundos.

`scripts/verify-postgres.ps1` lee la variable del proceso o del usuario sin imprimirla y ejecuta la prueba PostgreSQL anterior y `tests/test_medical_postgres_workflow.py`. Se detiene con error si falta la variable; nunca sustituye esta comprobación por el modo en memoria.

Resultados verificados, con evidencia en `docs/verification/postgres-live.json`:

| Comprobación | Resultado observado |
| --- | --- |
| Conexión | PostgreSQL real, proyecto correcto, TLS entre el cliente y el Session pooler. |
| Migraciones | `20261114160129`, `20261114160157`, `20261114160340`, `20261114160412`, `20261114160854`, todas aplicadas. |
| RLS | Activo en las 16 tablas del esquema `aegis`. |
| A-112 persistido | 796 mediciones originales, 46 referencias versionadas, 4 evaluaciones y 6 solicitudes de pruebas. Recargados desde conexiones independientes. |
| Recorrido completo | Importación de una HRV sintética → tendencia con enlace a esa medición → evaluación → solicitud CTX-I → resultado sintético → reevaluación persistida `confirmed_finding`, enlazada a la evaluación anterior. |
| Identificadores del recorrido | Copia `Z-000`; nueva medición 1608; resultado 1609; solicitud `07c20cc3-d49b-4d88-89a3-e0141672221a`; reevaluación `9de8bf20-a2f4-4fc6-80ba-8ae2e26ded80`. |
| Aislamiento sin privilegios | `current_user=authenticated`, `rolsuper=false`, `rolbypassrls=false`: lecturas de otro expediente vacías e INSERT ajeno rechazado por PostgreSQL. La API devuelve 404 para expediente, tendencias, evaluaciones, sistemas, medición y solicitud ajenos. |
| Autorización del resultado | El propietario sin rol médico recibe 403 antes de insertar datos; el médico de vuelo con escritura completa el resultado y su reevaluación. |

Las pruebas del recorrido usan el router real FastAPI mediante ASGI y PostgreSQL remoto. Además se arrancó **la aplicación completa con Uvicorn en `http://127.0.0.1:8003`, con `AEGIS_RECORD_BACKEND=postgres`**. Peticiones HTTP reales devolvieron 200 para expediente, tendencias, evaluaciones y regiones de A-112, y para una medición original. Se compararon sus evaluaciones con los identificadores consultados en PostgreSQL. También se recuperaron por HTTP el resultado 1609 y su reevaluación confirmada en Z-000; otro usuario recibió 404. Evidencia: `docs/verification/postgres-http.json`.

Se corrigió una comprobación de las pruebas: `pg_stat_ssl` muestra el tramo pooler → PostgreSQL, no el cliente → pooler. TLS del cliente se comprobó mediante `conn.pgconn.ssl_in_use`, sin relajar `sslmode=require`. El valor observado del tramo interno fue `false` y queda registrado por separado; no se afirma cifrado de extremo a extremo.

La suite añadió tres usuarios ficticios `@aegis.invalid` sin contraseñas, permisos explícitos y dos expedientes sintéticos `Z-000` y `Z-001`, además de nuevas evaluaciones/referencias/solicitudes para el A-112 existente. El recorrido de inserción y resultado se realizó sobre una copia sintética para conservar intactas sus 796 mediciones originales. Esos datos quedan etiquetados y conservados para verificar persistencia; no hubo limpieza destructiva, cambios de esquema ni cambios en migraciones. Los archivos de evidencia contienen solo identificadores sintéticos, contadores y respuestas HTTP; no contienen credenciales.

Para arrancar otra vez el modo remoto: `./scripts/start.ps1 -MedicalPostgres -SkipBuild -Port 8003`. El arranque habitual conserva el modo offline por defecto. Para repetir las pruebas: `./scripts/verify-postgres.ps1`; una repetición añade nuevas copias sintéticas y evaluaciones, no elimina las anteriores.

**Errores funcionales restantes en este recorrido: ninguno observado.** Sigue pendiente verificar JWT: `X-AEGIS-User` es una identidad de desarrollo. Que las consultas usen RLS no autentica por sí solo al titular de esa cabecera. Tampoco se ha conectado la interfaz a `/api/v2`. Los protocolos y el adaptador por reglas siguen siendo demostrativos, sin validación clínica; la verificación de PostgreSQL no cambia ese estado. La advertencia no bloqueante de Starlette/httpx permanece.
