# AEGIS · Estado de implementación

Versión local 0.1.0 · Verificación: 14 de noviembre de 2026.

El flujo completo está implementado y probado: selección de astronauta, gemelo interactivo, registro dinámico, importación, SQLite, análisis personal, incertidumbre, hallazgos, comprobaciones y replay. La aplicación se sirve desde http://127.0.0.1:8000. No se ha publicado ni conectado a servicios cloud.

| Fase | Resultado real |
| --- | --- |
| 1. Estructura | React/TypeScript/Vite/Tailwind y FastAPI/Pydantic; carpetas, AGENTS.md, README y scripts de inicio. |
| 2. Entidades | Los diez contratos solicitados, procedencia y calidad explícitas, fechas con zona horaria normalizadas a UTC. SQLite persistente. |
| 3. Registro | 17 variables de ejemplo en JSON, lectura dinámica sin recompilar; siete sistemas y siete regiones visuales. Nuevas variables aparecen tras Actualizar registro. |
| 4. Estadística | Series y medidas aisladas, n, exclusiones, media, desviación muestral, mediana, MAD, pendiente, baseline previo y z. Ausencia, caducidad y calidad insuficiente diferenciadas. IC condicionado a supuestos explícitos, deshabilitado para las series del dashboard. |
| 5. Modelos | ModelAdapter, mock marcado como sintético y cargador de módulos Python locales. Barrera de contrato para probabilidades no calibradas/validadas. El modelo entrenado real aún debe entregarlo el equipo. |
| 6. Guía | Motor independiente, comprobaciones de adquisición y protocolos configurables. Archivo de protocolos revisados vacío: se muestra Pendiente de revisión médica. Síntomas de emergencia activan alerta sin depender del modelo. |
| 7. Interfaz | Dashboard adaptable a móvil, sistema regional seleccionable, gráficos, detalles de estadística/origen, hallazgos, exportación y modal de modelo. |
| 8. Blender | Blender MCP no está conectado. Se implementó la alternativa SVG interactiva y una vista 3D procedural R3F, con selección y rotación. No se generaron archivos GLB ni .blend. Instrucciones de sustitución en assets/models/README.md. |
| 9. Importación | CSV/JSON largo y ancho, previsualización de columnas, asociación, unidades, UTC, identificación de persona, validación de lote, duplicados y persistencia transaccional. Exportación JSON de resultados y CSV de mediciones; respeta la fecha del replay. |
| 10. Demo | Tres personas ficticias: estable, desviaciones/pendientes y emergencia declarada. Datos reproducibles; baselines separados del periodo evaluado. Replay consulta y recalcula el backend en cada paso. |
| 11. Verificación | 39 pruebas pytest, 5 Vitest y 6 Playwright aprobadas; compilación de producción correcta. Playwright MCP usado para inspección y capturas. Se verificó ejecución bloqueando destinos externos, incluida la carga del 3D. |
| 12. Entrega | Guía de instalación y contratos, ejemplos CSV/JSON, versiones de dependencias registradas y commits funcionales. Aplicación local en ejecución durante la entrega. |

## Evidencia

- `python -m pytest -q`: **39 passed**, incluida separación de personas/procedencias, unidades, ausencias, caducidad, valores no finitos, desbordamiento numérico, baseline, estadística, intervalos condicionados, importación atómica, duplicados, plugins y alertas independientes del modelo.
- `npm test`: **5 passed**, agregación de estados y lectura de CSV de previsualización.
- `npm run test:e2e`: **6 passed**, selección SVG y regiones, escenarios, replay, importación y duplicados desde UI, 3D sin destinos externos y ancho móvil. Usa una base SQLite temporal independiente.
- `npm run build`: correcto. Aviso de tamaño de bundles: aproximadamente 650 kB para la consola y 899 kB para la vista 3D diferida, antes de gzip. No bloquea la ejecución local.
- `npm audit --omit=dev`: **0 vulnerabilidades** al verificar. La instalación final también informó 0 vulnerabilidades en el árbol completo.
- Aviso no bloqueante de Starlette TestClient sobre su integración futura con httpx2. Los tests actuales pasan con las versiones de backend/requirements.lock.txt.
- Capturas revisadas: docs/dashboard-desktop.png, docs/dashboard-mobile.png y docs/dashboard-3d.png. Consola del navegador revisada sin errores ni advertencias.

## Límites de validez y trabajo pendiente externo

**Ningún componente tiene validación clínica.** Los tests validan software y cálculos. No hay diagnósticos, tratamientos ni probabilidades clínicas inventadas. |z| ≥ 3 es una heurística de investigación, no un umbral de seguridad. Las variables, frecuencias y distribuciones demo deben revisarse con el equipo científico; los enlaces de NASA son contexto general.

El modelo real, su documentación de entrenamiento/preprocesamiento/calibración y los protocolos médicos revisados siguen pendientes de aportación y revisión por el equipo. El cargador y el contrato están listos; cambiar un modelo no exige rehacer la interfaz. La comprobación de metadata de validación no sustituye una revisión humana de las evidencias.

No se estiman intervalos de predicción con el mock. El dashboard tampoco estima IC de series temporales sin supuestos verificados. Las predicciones del adaptador se muestran separadas del análisis y no modifican automáticamente los estados regionales. No hay ajuste de confusores ni control por comparaciones múltiples.

Los datos reales requieren un baseline real previo compatible (POST /api/baselines). Las personas nuevas se crean mediante la API; la interfaz incluye el selector de las personas registradas. No hay editor visual de baselines, resolución de eventos de emergencia, edición destructiva de mediciones ni constructor gráfico de protocolos. Los eventos permanecen activos hasta que se registre una resolución mediante un futuro flujo aprobado.

SQLite no se cifra y no se implementó autenticación multiusuario. El servidor escucha únicamente en loopback; no se preparó para exponerlo en una red. La prueba offline permite loopback y bloquea destinos externos; el backend debe seguir encendido. No es una PWA. Los datos demo se generan una sola vez y pueden caducar con el tiempo; el replay conserva el acceso al periodo de demostración.

El humanoide es estilizado y no posee precisión anatómica. Blender y un GLB definitivo son opcionales para esta versión; su conexión y sustitución se describen en la guía. No se instalaron conectores globales adicionales.
