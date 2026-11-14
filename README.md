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

La experiencia visual usa anatomía real de Z-Anatomy y BodyParts3D 4.0, almacenada en assets/models/humanoid.glb. Fondo claro, sistemas seleccionables, capas, rotación, vista posterior y cámara animada de 600 ms. Las cuatro referencias están en references/. Las imágenes no se usan como sustituto del modelo.

Créditos y licencias: [assets/models/ATTRIBUTION.md](assets/models/ATTRIBUTION.md). El atlas es genérico; no es un escáner del astronauta y no tiene el acabado fotorealista de las referencias. El modelo de IA sigue siendo una demo intercambiable sin validación clínica. No se ha generado vídeo.

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
