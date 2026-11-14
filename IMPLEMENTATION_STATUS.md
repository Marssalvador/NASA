# AEGIS · Estado de implementación

Versión local 0.1.0 · Actualización anatómica y verificación: 14 de noviembre de 2026.

El flujo completo está implementado y probado: selección de astronauta, gemelo interactivo, registro dinámico, importación, SQLite, análisis personal, incertidumbre, hallazgos, comprobaciones y replay. La aplicación se sirve desde http://127.0.0.1:8000. No se ha publicado ni conectado a servicios cloud.

| Fase | Resultado real |
| --- | --- |
| 1. Estructura | React/TypeScript/Vite/Tailwind y FastAPI/Pydantic; carpetas, AGENTS.md, README y scripts de inicio. |
| 2. Entidades | Los diez contratos solicitados, procedencia y calidad explícitas, fechas con zona horaria normalizadas a UTC. SQLite persistente. |
| 3. Registro | 18 variables de ejemplo en JSON, cada una con capa de sensado (1 continua / 2 bajo demanda), madurez del sensor y sitio anatómico del marcador, lectura dinámica sin recompilar; siete sistemas y siete regiones visuales. Nuevas variables aparecen tras Actualizar registro. |
| 4. Estadística | Series y medidas aisladas, n, exclusiones, media, desviación muestral, mediana, MAD, pendiente, baseline previo y z. Ausencia, caducidad y calidad insuficiente diferenciadas. IC condicionado a supuestos explícitos, deshabilitado para las series del dashboard. |
| 5. Modelos | ModelAdapter, mock marcado como sintético y cargador de módulos Python locales. Barrera de contrato para probabilidades no calibradas/validadas. El modelo entrenado real aún debe entregarlo el equipo. |
| 6. Guía | Sensado jerárquico en backend/aegis/sensing.py con cuatro rutas configurables en data/risk_pathways.json (resorción ósea —ruta demostrativa—, cálculos renales, inflamación/sobreentrenamiento y cardiovascular/ortostática): una desviación de capa 1 solicita mediciones de capa 2; una capa 2 no solicitada ni tomada no cuenta como dato ausente. Motor de guía independiente, comprobaciones de adquisición y protocolos configurables. Archivo de protocolos revisados vacío: se muestra Pendiente de revisión médica. Síntomas de emergencia activan alerta sin depender del modelo. |
| 7. Interfaz | Composición según las referencias: marca y astronauta arriba, sistemas a la izquierda, anatomía protagonista y panel regional a la derecha. Marcadores tipo lámina anatómica con línea guía sobre el sitio de cada desviación y de cada medición de capa 2 solicitada; métricas agrupadas por capa con procedencia Medido/Simulado; escalera Capa 1 → anomalía → Capa 2 → interpretación → recomendación por ruta. Importación, exportaciones y registro reunidos en un único menú «Datos de la misión». |
| 8. Anatomía 3D | GLB real de Z-Anatomy y BodyParts3D 4.0: 2.218 estructuras conservadas, 74 piezas agrupadas por región/tejido/zona, 2.443.130 triángulos y 11.833.832 bytes. Materiales PBR con entorno de estudio procedural local (PMREM, sin HDR ni red), término Fresnel por tejido (piel translúcida con borde luminoso) y brillo localizado en el sitio con revisión; capas piel/músculo/hueso/órganos (se retiró la capa vacía de vasos periféricos), vista posterior, rotación y cámara de 600 ms. Se eliminaron SVG y primitivas anteriores. Sin Blender MCP ni .blend. |
| 9. Importación | CSV/JSON largo y ancho, previsualización de columnas, asociación, unidades, UTC, identificación de persona, validación de lote, duplicados y persistencia transaccional. Exportación JSON de resultados y CSV de mediciones; respeta la fecha del replay. |
| 10. Demo | Tres personas ficticias: estable, desviaciones/pendientes y emergencia declarada. Datos reproducibles; baselines separados del periodo evaluado. Replay consulta y recalcula el backend en cada paso. |
| 11. Verificación | 48 pruebas pytest, 17 Vitest y 13 Playwright aprobadas; compilación de producción correcta. Pruebas sobre el GLB real, selección, cámara, rotación, capas y flujos de datos. Destinos externos bloqueados durante la prueba offline. |
| 12. Entrega | Guía de instalación y contratos, ejemplos CSV/JSON, versiones de dependencias registradas y commits funcionales. Aplicación local en ejecución durante la entrega. |

## Evidencia

- `python -m pytest -q`: **48 passed**, incluidas las rutas de sensado (activación, confirmación, capa 2 latente, validación del archivo de rutas), separación de personas/procedencias, unidades, ausencias, caducidad, valores no finitos, desbordamiento numérico, baseline, estadística, intervalos condicionados, importación atómica, duplicados, plugins y alertas independientes del modelo.
- `npm test`: **17 passed**, marcadores corporales, capa 2 latente, anclas de todos los sitios del registro, lógica de presentación/CSV y contrato de las mallas: regiones reales, anclas, bounds del corazón, sustitución de riñones, exclusión de oído y GLB autocontenido sin texturas remotas.
- `npm run test:e2e`: **13 passed**, marcadores y escalera de sensado, atlas real, acercamiento y retorno, rotación con ratón, estados, incertidumbre/procedencia, replay, importación/duplicados, capas, licencias, aislamiento de red y ancho móvil. Usa SQLite temporal independiente.
- `npm run build`: correcto. Aviso no bloqueante: bundles de aproximadamente 642 kB para la interfaz y 981 kB para el visor diferido, antes de gzip. El atlas comprimido ocupa 11,8 MB y se sirve localmente.
- `npm audit --omit=dev`: **0 vulnerabilidades** al verificar. La instalación final también informó 0 vulnerabilidades en el árbol completo.
- Aviso no bloqueante de Starlette TestClient sobre su integración futura con httpx2. Los tests actuales pasan con las versiones de backend/requirements.lock.txt.
- Capturas actuales: docs/visual-review/round3-home.png, round3-skeleton.png, round3-cardiovascular.png, round3-posterior.png y round3-mobile.png (generadas con frontend/scripts/capture-review.mjs). Anteriores: round2-cardiovascular.png, anatomy-posterior.png y anatomy-mobile.png. Checklist, medidas y diferencias reales en docs/visual-review/REVIEW.md.

## Revisión visual y licencias

Las cuatro imágenes del usuario se guardaron como references/home.png, cardiovascular.png, anatomy-front.png y anatomy-back.png. Cutaway se aplicó mediante un brief medido y dos rondas de revisión. No se grabó vídeo ni sonido. El nuevo visor no utiliza imágenes pegadas sobre planos ni geometrías anatómicas de primitivas.

Las mallas del atlas se acreditan y distribuyen bajo CC BY-SA 4.0. Se detectaron excepciones de licencia en Z-Anatomy: se excluyeron sus riñones y estructuras de oído. Piel y riñones se obtuvieron del archivo original BodyParts3D 4.0 con licencia oficial CC BY 4.0 y se alinearon al atlas mediante una transformación rígida verificada. Fuente, revisión, hashes, créditos y cambios en assets/models/ATTRIBUTION.md y source-manifest.json. Tipografía DM Sans servida localmente con su licencia OFL.

El render es bajo demanda y se activa al interactuar, cambiar datos/capas o animar la cámara. Se respeta movimiento reducido. Chrome con ANGLE/D3D11 permite probar el atlas real en esta máquina; el headless shell con render por software se mostró demasiado lento y se sustituyó en la configuración de pruebas. El modelo no se sustituyó por un mock para aprobar las pruebas.

## Límites de validez y trabajo pendiente externo

**Ningún componente tiene validación clínica.** Los tests validan software y cálculos. No hay diagnósticos, tratamientos ni probabilidades clínicas inventadas. |z| ≥ 3 es una heurística de investigación, no un umbral de seguridad. Las variables, frecuencias y distribuciones demo deben revisarse con el equipo científico; los enlaces de NASA son contexto general.

El modelo real, su documentación de entrenamiento/preprocesamiento/calibración y los protocolos médicos revisados siguen pendientes de aportación y revisión por el equipo. El cargador y el contrato están listos; cambiar un modelo no exige rehacer la interfaz. La comprobación de metadata de validación no sustituye una revisión humana de las evidencias.

No se estiman intervalos de predicción con el mock. El dashboard tampoco estima IC de series temporales sin supuestos verificados. Las predicciones del adaptador se muestran separadas del análisis y no modifican automáticamente los estados regionales. No hay ajuste de confusores ni control por comparaciones múltiples.

Los datos reales requieren un baseline real previo compatible (POST /api/baselines). Las personas nuevas se crean mediante la API; la interfaz incluye el selector de las personas registradas. No hay editor visual de baselines, resolución de eventos de emergencia, edición destructiva de mediciones ni constructor gráfico de protocolos. Los eventos permanecen activos hasta que se registre una resolución mediante un futuro flujo aprobado.

SQLite no se cifra y no se implementó autenticación multiusuario. El servidor escucha únicamente en loopback; no se preparó para exponerlo en una red. La prueba offline permite loopback y bloquea destinos externos; el backend debe seguir encendido. No es una PWA. Los datos demo se generan una sola vez y pueden caducar con el tiempo; el replay conserva el acceso al periodo de demostración.

El humanoide procede de un atlas anatómico genérico masculino, no de un escáner del astronauta. Las mallas tienen detalle anatómico, pero no incorporan texturas fotográficas ni alcanzan el acabado fotorealista de las ilustraciones generadas. No se distorsionan proporciones ni se infiere daño de un órgano a partir de una medición. No se garantiza una tasa fija de FPS en todas las GPUs. El visor requiere WebGL; si falla, informa del error conservando los datos accesibles. No se instalaron conectores globales adicionales ni se usó Sunra.

### Sensado jerárquico y presentación (ronda 3)

Las rutas de riesgo son hipótesis de diseño, no reglas clínicas: usar la fuerza de prensión como disparador óseo, CTX-I como disparador renal o la combinación temperatura/HRV/sueño/cortisol para inflamación está pendiente de validación científica. Lactato, electrolitos en sudor y cortisol continuo figuran solo como señales propuestas (sensor experimental) y no tienen datos. Las hormonas sexuales no se registraron: requieren umbrales por sexo y fase con respaldo científico antes de usarse. La SQLite local creada antes de esta versión no contiene presión arterial; aparece como «No solicitada» o «Solicitada» según la ruta.

El brillo rojo y los marcadores indican un estado de evaluación de datos situado en un sitio anatómico aproximado; no representan lesión ni el punto de medición. Las coordenadas de los sitios se muestrearon sobre la malla general. Benchmark local (docs/performance/round3.json, Chrome ANGLE D3D11, 3 ejecuciones): interacción a ~60 fps sin tareas largas; tiempo hasta visor listo ≈1,8 s de mediana frente a ≈1,2 s en after.json, por la compilación del shader, el entorno PMREM y un dashboard mayor. La piel del modelo general pasó de 8.540 a 36.608 triángulos (total 271.963, 2,28 MB).



### Secciones con im?genes locales (petici?n del usuario, 14 noviembre 2026)

La vista general conserva el GLB real y la rotaci?n horizontal. Las siete secciones sustituyen el visor por ilustraciones anat?micas generadas con image_gen, servidas localmente como WebP. No hay WebGL ni solicitudes de mallas de detalle en las secciones; tambi?n se sustituy? el segundo canvas de previsualizaci?n por una imagen. El selector permite cambiar entre sistemas sin volver al cuerpo completo. Se decodifica antes de mostrar, se conserva la imagen anterior durante la transici?n de 600 ms y se descartan cargas de secciones anteriores. Los errores de imagen permiten reintentar sin perder la informaci?n.

Se ley? el Word t?cnico aportado: se conserva la l?gica de sensado existente y se a?ade contexto descriptivo por sistema, interpretaci?n del estado real calculado y recomendaci?n sujeta a revisi?n m?dica. No se convirtieron sus rangos orientativos en umbrales cl?nicos ni se muestran diagn?sticos inventados. La personalizaci?n hormonal propuesta sigue pendiente.

Esta entrega usa im?genes est?ticas. SystemMedia admite v?deos locales en bucle, poster, pausa, movimiento reducido y suspensi?n en pesta?a oculta; no se ha generado v?deo ni gastado el saldo de Sunra. Una uni?n invisible exige un clip preparado y revisado, no basta el atributo loop. Recursos, prompts y l?mites en docs/SECTION_MEDIA.md.

### Secciones con zoom y vídeo (ronda 4)

El atlas usa una paleta porcelana más opaca, con la piel de la cabeza casi opaca para que la cara se lea como cara. Al entrar en un sistema, la cámara se acerca sobre el mismo modelo (sin cambiar a mallas de detalle) y después aparece el medio de la sección. Solo Cardiovascular tiene vídeo: generado offline con Sunra (gpt-image-2 + Kling v3) y ralentizado localmente; ver docs/SECTION_MEDIA.md. Es una ilustración genérica generada por IA, sin revisión anatómica profesional, que no refleja datos ni lesiones del astronauta. Las capturas round4-home, round4-zoom y round4-section están en docs/visual-review/.

