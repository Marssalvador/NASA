# AEGIS

Gemelo digital fisiológico para investigación local. Demostrador independiente; sin afiliación ni validación de NASA. No proporciona diagnósticos ni probabilidades de enfermedad.

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

Selecciona una de las tres personas ficticias, pulsa una región del humanoide y elige una métrica. El botón Importar permite validar y guardar CSV/JSON. Los archivos de ejemplo de data/ son sintéticos: selecciona Elena / crew-01 y marca la casilla de datos sintéticos.

La guía completa y los contratos están en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). El estado real de cada fase está en [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md). Blender MCP no está conectado: se incluye SVG interactivo y una vista 3D procedural. El modelo de IA inicial es una demo intercambiable, sin validación clínica.

## Comprobaciones

```powershell
.\.venv\Scripts\python -m pytest -q
cd frontend
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

La última orden usa SQLite temporal y no modifica la base de datos de uso local.
