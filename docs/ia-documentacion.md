# Documentación de la IA del proyecto ORBITA

## 1. Objetivo del sistema

Este proyecto no pretende ser un diagnóstico médico ni una herramienta clínica. Su objetivo es demostrar un concepto de "gemelo digital" para salud muscular y rendimiento físico en entorno espacial, con una interfaz interactiva que combine:

- análisis de datos antropométricos
- evolución muscular
- recuperación
- nutrición
- visualización 3D del cuerpo
- recomendaciones de entrenamiento y seguimiento

La idea central es que la IA ayude a convertir datos del usuario en un modelo personalizable, visual y comprensible.

---

## 2. Qué es nuestra IA en este proyecto

Nuestra IA es una combinación de:

1. IA generativa visual
   - adapta la representación del cuerpo a un perfil concreto
   - genera una imagen 3D estilizada conforme al peso y al sexo

2. IA analítica
   - interpreta la evolución de índices musculares, recuperación y metabolismo
   - compara métricas con una línea base personal

3. IA de apoyo a decisión
   - recomienda acciones y avisos según tendencias del rendimiento
   - ayuda a priorizar qué zonas del cuerpo requieren más atención

En otras palabras, estamos construyendo una IA de personalización y soporte de salud corporal, no un sistema médico autónomo.

---

## 3. Qué tenemos implementado hoy

### 3.1 Personalización visual
El archivo `script.js` incluye la lógica para:

- detectar el sexo seleccionado
- leer el valor de peso del slider
- cambiar la forma visual del cuerpo según esos parámetros

Esto convierte la interfaz de un cuerpo fijo en un cuerpo dinámico y adaptable.

### 3.2 Módulo de entrenamiento fisiológico
Se ha añadido un módulo de aprendizaje en `body_ai_module.py` que recibe datos fisiológicos del usuario (sexo, edad, estatura, peso, cintura, cadera, pecho, masa muscular, grasa corporal) y los transforma en un perfil visual del cuerpo. El flujo usa una capa de datos realista en `data/body_profile_dataset.csv`, con un esquema listo para cargar mediciones antropométricas y fisiológicas.

Cuando el dataset está disponible, el modelo entrena con esas filas reales; si no existe, usa un fallback sintético para mantener la demo operativa. Esto convierte el proyecto en una base más seria para alimentación con datasets públicos o de laboratorio.

### 3.3 Interacción por zonas musculares
Cada región del cuerpo (brazos, cuádriceps, pantorrillas, core, etc.) puede clicarse para mostrar una tarjeta informativa. Esta interacción simula un mapa corporal inteligente que responde a la zona seleccionada.

### 3.4 Dashboard de análisis
La pantalla organiza información en categorías:

- estado muscular
- glucosa y metabolismo
- recuperación
- nutrición
- plan recomendado

La IA, en este prototipo, se materializa como una capa "inteligente" que transforma datos en contexto visual y sugerencias de acción.

---

## 4. Cómo funciona el flujo actual

### Entrada
Los datos de entrada pueden ser:

- sexo
- peso
- métricas musculares sintéticas
- recuperación
- consumo nutricional
- tendencia de evolución

### Procesamiento
El sistema realiza dos tipos de procesamiento:

- cálculo de proporciones del cuerpo
- interpretación de tendencias y rangos

Esto se hace en frontend con JavaScript, de forma local y sin backend real.

### Salida
La salida visible es:

- un cuerpo 3D estilizado adaptado al usuario
- valores de estado y salud en la interfaz
- recomendaciones y avisos que pueden guiar una próxima decisión

---

## 5. Arquitectura del prototipo

### Frontend
- `index.html`: estructura de la vista
- `style.css`: diseño visual del dashboard y del cuerpo
- `script.js`: lógica interactiva, render del cuerpo, personalización, popovers

### Generación visual
Existe un script llamado `generate_3d_body.py` pensado para generar una imagen 3D del cuerpo humano a partir de prompts o mediante un fallback visual en caso de que no estén instalados los paquetes del modelo generativo.

### Estructura funcional

- capa de presentación: dashboard y panel médico visual
- capa de interacción: clics, selección de vistas, hover, popovers
- capa de personalización: ajustes por peso y sexo
- capa de análisis: métricas, rangos, recomendaciones

---

## 6. Qué no es todavía esta IA

Actualmente no es una IA totalmente entrenada con datos reales por varias razones:

- no hay base de datos real de personas con medidas corporales
- no hay entrenamiento con imágenes 3D anatómicas verdaderas
- no existe un backend con modelos ML desplegados
- no hay autenticación ni persistencia de usuarios reales
- las métricas actuales son sintéticas y de demostración

Es un prototipo orientado a producto y concepto.

---

## 7. Qué necesitamos para convertirlo en una IA real

Para hacer que sea un sistema serio y viable, haría falta:

### Datos reales
- sexo
- edad
- altura
- peso
- composición corporal
- fuerza funcional
- ecografías musculares
- historial longitudinal
- nutrición y recuperación

### Modelos
- modelos de visión para análisis corporal
- modelos de predicción de composición o rendimiento
- generación 3D o render paramétrico
- analítica de series temporales

### Infraestructura
- backend con API
- base de datos
- entrenamiento o inferencia con modelos orientados a salud
- autenticación de usuarios
- logging y trazabilidad

---

## 8. Dirección futura del proyecto

La ruta probable del proyecto es:

1. mantener la interfaz actual como base visual
2. integrar datos reales del usuario
3. conectar un modelo de análisis corporal
4. alimentar una generación 3D más realista
5. crear un "gemelo digital" del cuerpo para seguimiento longitudinal
6. añadir recomendaciones personalizadas con mayor precisión

---

## 9. Resumen corto

Nuestra IA en este proyecto funciona como un sistema inteligente de personalización y análisis corporal. Su misión es transformar datos del usuario en una visual del cuerpo y en recomendaciones útiles para salud muscular y rendimiento. Hoy es un prototipo, pero tiene la estructura adecuada para evolucionar hacia un gemelo digital real.

---

## 10. Registro de cambios

### Versión actual: 1.0
- documentado el concepto general de IA del proyecto
- descrita la relación entre interfaz, personalización y análisis
- identificado el alcance real del prototipo y sus limitaciones
- definido el roadmap hacia una IA más real y médica

### Próximo cambio esperado
- conectar la lógica del peso y sexo con un modelo más robusto de generación 3D
- documentar el flujo de datos entre frontend y backend
- incluir una arquitectura de ML y un diagrama de datos
