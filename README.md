# NASA Human Health Monitor

Prototype de interfaz para monitorizar la salud del astronauta en misión, con enfoque en masa muscular, nutrición y recuperación fisiológica.

## Objetivo del proyecto

Desarrollar una herramienta que ayude a interpretar indicadores de salud en entornos espaciales, especialmente:

- pérdida de masa muscular
- glucosa y azúcar en sangre
- estado proteico y nutricional
- recuperación muscular
- deterioro funcional en piernas, brazos y core
- decisiones de ejercicio, suplementación y dieta

La interfaz está pensada para una primera versión visual y analítica, con un gemelo digital del astronauta y un mapa corporal interactivo.

## Estructura del proyecto

- `index.html` — dashboard principal y vista del gemelo digital
- `style.css` — diseño, visualización médica y responsive
- `script.js` — interactividad del avatar y carga de datos por zona corporal

## Cómo ejecutar

```bash
python -m http.server 8000
```

Luego abre: http://localhost:8000

## Fase actual

- interfaz inicial lista
- panel de datos biomédicos y nutricionales
- avatar corporal con selección por músculo/zona
- recomendaciones de ejercicio y suplementos

## Siguiente fase

- integrar IA para predicción individualizada
- conectar biomarkers de NASA y recursos públicos
- añadir análisis de mujeres y variaciones hormonales
- incorporar ecografías, biomarcadores y ML de personalización
