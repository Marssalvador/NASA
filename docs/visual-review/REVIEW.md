# AEGIS — revisión visual contra las referencias

Dos rondas formales a 1672 × 941 px, con correcciones funcionales de encuadre, profundidad, escala del órgano aislado y render bajo demanda. Las capturas round2 son de la versión final compilada. No existe una imagen aprobada previa y no se generó vídeo.

## Comparaciones

- [General: referencia y aplicación](comparison-home.png) · [hoja de 900 px](comparison-home-900.png)
- [Cardiovascular: referencia y aplicación](comparison-cardiovascular.png) · [hoja de 900 px](comparison-cardiovascular-900.png)
- [Vista posterior de musculatura](anatomy-posterior.png)
- [Móvil, 390 px de ancho](anatomy-mobile.png)

## Correcciones de la primera revisión

La altura de la navegación agrandaba el contenedor y cortaba los pies. El visor pasó a encuadrarse en el viewport y la navegación dispone de su propio espacio. Se redujo la luz y se corrigió la escritura de profundidad de materiales sólidos; antes el corazón parecía abierto por superposición de caras. La clasificación de tejidos y los bounds del órgano aislado se corrigieron para excluir vasos distantes. Los controles se colocaron fuera del eje de las piernas. El render dejó de ejecutarse continuamente en reposo.

## Checklist de la segunda revisión

| # | Criterio | Resultado | Evidencia / límite |
| --- | --- | --- | --- |
| 1 | Anatomía real y procedencia verificable | Sí | GLB de Z-Anatomy/BodyParts3D, 2.218 estructuras agrupadas en 74 piezas. Créditos y exclusiones registrados. |
| 2 | Cuerpo completo y proporciones de referencia | Parcial | Cabeza y pies encuadrados. Ocupación vertical 91,1 % frente a 92,5 % en la referencia; el atlas tiene distinta anchura y morfología. |
| 3 | Fondo cálido, luz de estudio y ausencia de neón | Sí | Fondo claro, iluminación local, materiales sin emisión, sombra de contacto. |
| 4 | Marca / astronauta / sistemas / métricas | Sí | Composición de tres zonas según la referencia, con selector real de la API. |
| 5 | Piezas identificables y control independiente | Sí | Región, tejido, zona, manifest de nombres originales; controles de capas y selección por sistema. |
| 6 | Musculatura, huesos, órganos y exterior transparente | Parcial | Mallas reales y capas presentes. Sin texturas de fibras, microrelieve ni acabado fotográfico de tejido. |
| 7 | Corazón ampliado y panel cardiovascular | Parcial | Órgano real e independiente, cámara de torso, frecuencia y HRV del backend. Su forma, vasos seccionados y posición anatómica difieren de la ilustración generada. |
| 8 | Selección, rotación, cámara 400–700 ms, volver | Sí | Easing cúbico de 600 ms, OrbitControls, vista posterior y retorno; movimiento reducido respetado. Prueba de arrastre real en navegador. |
| 9 | Tipografía y espacio sin tarjetas decorativas | Sí | DM Sans local, divisores y panel regional. Se conservaron acceso a datos, importación y detalle. |
| 10 | Alertas y comprobaciones justificadas | Sí | Estados proceden del análisis. No se copiaron las recomendaciones o interpretaciones clínicas ficticias de la imagen. |
| 11 | Capturas general / cardiovascular / móvil | Sí | Capturas enlazadas, sin desbordamiento horizontal en móvil. Dos rondas revisadas. |
| 12 | Densidad y equivalencia con el render de referencia | No | El atlas tiene materiales más uniformes y menor contraste interno. No se alcanza el umbral de densidad de Cutaway ni se declara fotorealismo. |

## Medidas

Calculadas por scripts/compare_anatomy.py sobre cajas del cuerpo revisadas manualmente. Son medidas del render, no métricas de anatomía o validez médica. Incluyen el fondo dentro de cada caja; el resultado depende de los límites escogidos y no sustituye la revisión visual.

| Medida | Referencia | Aplicación |
| --- | ---: | ---: |
| Alto del cuerpo / alto del lienzo | 0,9245 | 0,9107 |
| Caja en píxeles | x505–890, y30–900 | x520–860, y30–887 |
| Fracción de píxeles con luminancia < 80 en la caja | 0,02281 | 0,00131 |
| Densidad relativa | 1,0 | 0,0575 |

La regla numérica heredada de Cutaway plantea 0,8 de la densidad de la referencia. El resultado actual es inferior: la diferencia principal sigue siendo el acabado material y el sombreado interno, además de la morfología del atlas. El objetivo de fidelidad fotorealista está **pendiente**. La aplicación funcional, el modelo anatómico real y sus interacciones sí están implementados.

## Verificación funcional

39 pytest + 9 Vitest + 8 Playwright aprobadas; build correcto. Chrome con GPU ANGLE/D3D11; el atlas no fue reemplazado por un mock en las pruebas. Prueba offline bloquea todos los destinos externos y permite loopback. Las pruebas de importación utilizan SQLite temporal.

Los frames se entregan para revisión. No se ha asumido aprobación del usuario ni creado una grabación o banda sonora.
