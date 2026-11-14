# AEGIS — referencia visual y metodología Cutaway

Solicitud actual: interfaz clara e inmersiva centrada en anatomía real; no estética robótica. No se ha solicitado vídeo ni banda sonora. Se adapta la organización por piezas, materiales, cámara y comparación de Cutaway. No se ejecutan sus ejemplos ni se copia su código. Las imágenes de referencia nunca se usan como geometría ni como fondo del visor.

## Medidas iniciales de las referencias (1672 × 941 px)

- Vista general: cuerpo aproximadamente x=505–890, y=30–900; alto 870 px (92 % del lienzo). Cabeza ≈ 0,12 del alto del cuerpo, ancho de hombros ≈ 0,32; separación completa de manos y piernas.
- Distribución: navegación izquierda ≈ 18 %, escenario central ≈ 45 %, información derecha ≈ 34 %. El cuerpo puede sobrepasar la altura del torso en detalle.
- Vista cardiovascular: eje del torso en x≈515; plano del panel a x≈1060. El corazón es visible en la mitad superior del torso, del lado anatómico izquierdo.
- Paleta: blanco cálido y gris topo; rojo de interfaz exclusivamente para revisión/emergencia, sin emisión ni neón. Los tejidos conservan colores anatómicos naturales.

## Lista de revisión (antes de implementar)

1. Cuerpo humano con proporciones reconocibles, geometría anatómica de un atlas con procedencia y licencia documentadas. Nunca formar órganos o músculos a partir de esferas/cilindros.
2. Modelo completo protagonista, frontal, con cabeza y pies dentro del encuadre general y anatomía posterior accesible mediante rotación.
3. Fondo blanco cálido, luz suave, sombra de contacto discreta; sin rejillas, hologramas, luces cian ni suelo de laboratorio futurista.
4. Marca AEGIS y selector de astronauta arriba. Navegación de sistemas a la izquierda, métricas del sistema seleccionado a la derecha.
5. Piezas identificadas por sistema y órganos, con materiales independientes y registro local de nombres y centros.
6. Músculos reconocibles, estructura ósea, órganos viscerales y vasos; capas exteriores atenuables que permiten inspeccionar el interior.
7. Corazón anatómico, situado y ampliado por cámara; panel cardiovascular con frecuencia cardíaca y HRV reales del backend, sin valores copiados de la imagen.
8. Selección desde botones y malla, rotación con ratón, volver al cuerpo completo; transiciones de 600 ms con easing suave.
9. Tipografía sobria, divisores finos y espacio libre; evitar tarjetas decorativas. Mantener importación, origen, estadísticas y protocolos accesibles.
10. Las alertas rojas proceden del análisis. No copiar interpretación ni recomendaciones clínicas inventadas que aparezcan en la referencia.
11. Revisar captura general y cardiovascular a 1672 × 941 y en móvil. Registrar sí / parcial / no y las diferencias reales después de dos rondas visuales.
12. Medir ocupación y densidad sobre el cuerpo, además de la valoración visual. No declarar equivalencia fotorealista si las mallas sin texturas no la alcanzan.

## Correcciones heredadas de la petición

- Sustituir el anterior cuerpo esquemático de primitivas por mallas anatómicas reales.
- Sin colores luminosos para marcar una selección sin alertas.
- No usar las imágenes como texturas sobre un plano ni como sustituto del modelo interactivo.
- Todos los modelos, decodificadores y recursos de ejecución deben quedar locales.
