# ORBITA · Salud muscular en misión

Prototipo de interfaz para explorar cómo un panel de salud de tripulación podría vincular evolución muscular, función física, ingesta nutricional y recuperación. La demo se ejecuta sin instalación: abre `index.html` en un navegador moderno.

## Interfaz implementada

- Resumen de estado, glucosa, recuperación y tendencias de ecografía con valores sintéticos claramente identificados.
- Mapa corporal SVG seleccionable, con vistas frontal y posterior, y detalle por región. Es un esquema interactivo, no una imagen médica ni un modelo 3D anatómico.
- Seguimiento conceptual de proteína, energía y vitamina D junto a notas de asociación nutrición-recuperación.
- Plan de ejercicio de ejemplo para tren inferior; no prescribe carga ni sustituye al protocolo de ejercicio de misión.
- Contexto personal opcional para ciclo menstrual y variación hormonal. No predice fases ni altera umbrales clínicos.
- Diseño adaptable para escritorio y móvil, controles accesibles por teclado y sin dependencias JavaScript de terceros.

## Datos y siguiente etapa

La interfaz prepara una ficha de medición que debería guardar valor, unidad, hora, lugar/plataforma, sensor, calidad de señal, contexto de ejercicio, ingesta reciente y consentimiento. Fuentes previstas:

- Ecografía muscular seriada para espesor/arquitectura, con operador, sitio anatómico y protocolo estandarizados.
- Fuerza y función (dinamometría o pruebas del equipo de ejercicio); EMG como señal complementaria de activación/fatiga, no como medida directa de masa muscular.
- Ingesta, masa corporal y biomarcadores de sangre/orina del flujo de evaluación nutricional de NASA. Glucosa requiere método y contexto documentados; vitaminas y otros analitos dependen de laboratorio.
- Sensores portátiles o mediciones manuales validados para cada misión; Oxford Nanopore podría explorarse para investigación ómica, pero no se representa como sensor rutinario ni diagnóstico inmediato.

La siguiente fase puede sustituir los datos sintéticos por ingestión verificable del NASA Open Science Data Repository / Life Sciences Data Archive y recursos públicos de otras agencias, manteniendo procedencia, población, límites y licencias visibles. Los modelos personalizados necesitan cohortes longitudinales suficientes; el ciclo menstrual u otras variables hormonales solo se incorporarán con consentimiento, y nunca como un umbral universal.

## Referencias conceptuales

- NASA, [Nutritional Biochemistry](https://www.nasa.gov/directorates/esdmd/hhp/nutritional-biochemistry/): evaluación de ingesta, masa corporal y estado bioquímico, y relación de la nutrición con sistemas como músculo y hueso.
- NASA, [Food & Nutrition](https://www.nasa.gov/reference/jsc-food-nutrition/): análisis de sangre y orina para marcadores fisiológicos y evaluación detallada de ingesta.
- El reto de NASA Space Apps 2026 y AstroBone se consultaron como contexto de problema y ejemplo de alcance. Esta interfaz usa estructura, textos y visuales propios.

## Archivos

- `index.html` — interfaz y estructura del panel.
- `style.css` — sistema visual adaptable.
- `script.js` — interacción del mapa, selector de vista y opciones de contexto.
