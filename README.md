# AEGIS

Gemelo digital fisiológico para investigación local. Demostrador independiente; sin afiliación ni validación de NASA. No proporciona diagnósticos ni probabilidades de enfermedad.

## Inicio en Windows

Requisitos: Node.js 20.19+ o 22.12+, Python 3.11+ y Git. Desde la raíz:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r backend/requirements.txt
cd frontend
npm install
cd ..
.\scripts\start.ps1
```

La descarga inicial necesita internet. La ejecución es local: http://127.0.0.1:8000 (web de producción y API). Para desarrollo: backend con `python -m uvicorn backend.aegis.main:app --host 127.0.0.1 --port 8000` y `npm run dev` desde frontend (http://127.0.0.1:5173). Usar el Python de .venv.

La guía completa y los contratos están en docs/ARCHITECTURE.md. El estado real de cada fase está en IMPLEMENTATION_STATUS.md.
