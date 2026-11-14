# PULSS · demostrador AEGIS

Gemelo digital fisiológico para investigación local. Demostrador independiente; sin afiliación ni validación de NASA. No proporciona diagnósticos ni probabilidades de enfermedad.

La interfaz de presentación consume el motor médico real `/api/v2`: A-112, reproducción de mediciones sintéticas, referencias personales, hallazgos, pruebas pendientes y reevaluación con evidencias. Abrir **http://127.0.0.1:8000**. Guion completo: [docs/PULSS_DEMO.md](docs/PULSS_DEMO.md).

## Inicio en Windows

Requisitos: Node.js 24 LTS (o 22.12+ de la rama 22), Python 3.11+ y Git. Verificado con Node 24.14.1 y Python 3.14. Desde la raíz:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r backend/requirements.txt
cd frontend
npm install
cd ..
.\scripts\start.ps1
```

La descarga inicial necesita internet. La ejecución es local: http://127.0.0.1:8000 (web de producción y API). Para desarrollo: backend con `python -m uvicorn backend.aegis.main:app --host 127.0.0.1 --port 8000` y `npm run dev` desde frontend (http://127.0.0.1:5173). Usar el Python de .venv.

Para la presentación: `./scripts/start.ps1 -Presentation`. Pulsar **Cardiovascular → Iniciar simulación**, esperar dos pasos y pausar. Registrar el resultado de la prueba de presión arterial para obtener la reevaluación del motor. **Introducir medición** permite ensayar otros valores y calidades. **Reiniciar escenario** crea una copia sintética nueva y conserva los expedientes anteriores. La API anterior de SQLite sigue disponible para compatibilidad; la interfaz de presentación usa `/api/v2`.

La experiencia visual usa anatomía real de Z-Anatomy y BodyParts3D 4.0, almacenada en assets/models/humanoid.glb. Conserva los temas claro/oscuro, sistemas seleccionables, capas, rotación y vista posterior. Las secciones abren las imágenes/vídeos locales existentes; el cuerpo completo sigue siendo 3D. Las cuatro referencias están en references/.

Créditos y licencias: [assets/models/ATTRIBUTION.md](assets/models/ATTRIBUTION.md). El atlas es genérico; no es un escáner del astronauta. El motor por reglas existente sigue siendo demostrativo e intercambiable, sin validación clínica. Esta entrega no genera medios nuevos.

La guía completa y los contratos están en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). El estado real de cada fase está en [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md). La revisión visual comparativa se guarda en docs/visual-review/.

## Comprobaciones

```powershell
.\.venv\Scripts\python -m pytest -q
cd frontend
npm test
npm run build
npx playwright install chrome
npm run test:e2e
```

La última orden usa SQLite temporal y no modifica la base de datos de uso local.
