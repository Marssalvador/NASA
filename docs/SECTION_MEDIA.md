# Imágenes anatómicas por sistema

La vista general conserva el atlas 3D interactivo. Por petición del usuario, las secciones muestran una ilustración anatómica local a la izquierda y las mediciones, interpretación, recomendaciones y rutas de sensado a la derecha. Al entrar se desmonta WebGL; al volver se reutiliza la geometría en caché. No se descargan GLB de detalle al navegar por sistemas.

## Recursos

Siete ilustraciones nuevas generadas con la herramienta integrada `image_gen` (no con la API de Sunra). Originales locales en `assets/illustrations/source/` (ignorados por Git); versiones WebP para distribución en `frontend/public/media/systems/`. Se codifican con `node frontend/scripts/prepare-section-media.mjs`, calidad 84, ancho máximo 1200 px, sin recortar ni alterar la composición. Los archivos distribuidos son autocontenidos y no requieren red.

La configuración está en `frontend/src/sectionMedia.ts`. La imagen se decodifica antes de mostrarse; la anterior permanece durante la transición de 600 ms y las respuestas de cargas anteriores se descartan si se cambia de sección. Si falla una carga se puede reintentar y el panel de datos sigue disponible.

## Vídeo

Esta entrega usa **imágenes estáticas**, no vídeos ni rotación simulada mediante CSS. Para añadir un vídeo basta definir `video: '/media/systems/heart.mp4'` (o WebM) en la entrada correspondiente, después de guardar un clip local. El componente admite reproducción muda en bucle, poster, pausa, movimiento reducido y pausa cuando la pestaña queda oculta. Si falla el vídeo se conserva la imagen. El movimiento lento y la continuidad deben estar incorporados en el clip: `loop` por sí solo no garantiza una unión invisible. Preferir 12–20 segundos, 24–30 fps, cámara fija y un giro corto que regrese al encuadre inicial, sin morphing anatómico. No hay un clip generado o un coste de generación autorizado en esta entrega.

## Contenido del panel

Se leyó `Sistema_Monitorizacion_Predictiva_Astronautas.docx`, aportado por el usuario. Su propuesta contiene vigilancia continua, activación de mediciones secundarias para rutas ósea, renal, inflamatoria y cardiovascular, y personalización hormonal. Se utiliza como contexto de diseño, no como instrucciones ejecutables ni como protocolo clínico aprobado. Las rutas existentes del backend siguen gobernando los estados; no se han añadido sus rangos orientativos como umbrales automáticos.

El panel muestra la interpretación del estado calculado y recomendaciones solo si el protocolo correspondiente está revisado; en caso contrario, «Pendiente de revisión médica». Los datos ausentes y las señales experimentales siguen identificados. Las ilustraciones son genéricas, generadas, no representan el cuerpo ni una lesión del astronauta y requieren revisión anatómica antes de cualquier uso médico.

## Prompts usados

Un prompt por sistema. Instrucción compartida: “Create ONE high quality standalone scientific-educational anatomy illustration for the AEGIS astronaut physiology app. [SUBJECT] Match a premium photorealistic medical studio render: warm off-white background approximately #f7f3ef, soft studio lighting, subtle contact shadows, restrained tissue colors, semi-transparent exterior revealing genuine anatomy, realistic PBR tissue detail. Portrait 4:5, large anatomy centered, empty background. No text, labels, UI, icons, border, watermark, neon, hologram, disease lesions or blood spatter. Generic educational anatomy, not a patient scan. Single system, not a grid or collage.”

Sujetos: corazón en tórax translúcido (heart); pulmones y bronquios en tórax translúcido (lungs); riñones y uréteres en tronco posterior oblicuo (kidneys); encéfalo y tronco cerebral con cráneo translúcido (brain); pelvis, columna lumbar y fémures (skeleton); músculos pectorales, abdominales y cuádriceps (muscles); hígado, páncreas e intestinos en abdomen translúcido (metabolic).

## Cardiovascular: vídeo generado con Sunra (ronda 4)

Entrada en la sección: el atlas 3D permanece montado y la cámara se acerca al sistema sin aislarlo ni cargar el GLB de detalle; tras ~1,25 s el vídeo aparece con un fundido sobre el escenario, con bordes difuminados. Al volver a la vista general el vídeo desaparece y la cámara regresa. En la sección se ocultan marcadores, contexto de misión, replay y menú de datos.

Generación offline con `node frontend/scripts/generate-section-video.mjs image|video heart` (la clave se lee de `.env`, que Git ignora, y nunca se imprime):

1. Fotograma: `openai/gpt-image-2/text-to-image` en Sunra, 1536×1024. Original en `assets/illustrations/source/heart-sunra.png`.
2. Bucle: `kling/kling-v3-standard/image-to-video`, 10 s, sin audio, con el mismo fotograma como imagen inicial y final para cerrar el bucle.
3. Post-proceso local con ffmpeg: duración ×2 con interpolación de movimiento (`minterpolate`, 30 fps), H.264 sin audio, `faststart`. Resultado `frontend/public/media/systems/heart.mp4` (≈20 s, 805 KB) y póster `heart-loop.webp` (primer fotograma).

El vídeo es una ilustración genérica: no depende del estado del astronauta, no muestra una lesión y se rotula «Ilustración generada · no representa al astronauta». El resto de sistemas conserva sus imágenes estáticas; `heart.webp` anterior ya no se usa.

## Tema oscuro y fotos de sección (ronda 5)

Por decisión del usuario la interfaz pasa a un tema oscuro: fondo espacial con la Tierra nocturna en el borde inferior (`public/media/backdrop.webp`, Sunra gpt-image-2). Las secciones Cardiovascular, Respiratorio, Renal, Neurológico y Muscular usan fotos nuevas generadas con Sunra en el mismo estilo (anatomía de cristal sobre negro, órgano con brillo cálido). Se muestran enteras y el escenario se mezcla en modo «screen», de modo que el negro de la imagen deja ver el fondo. La entrada es directa: el atlas 3D se oculta (sigue montado para volver sin recargar) y la foto aparece con un fundido de 380 ms, sin vuelo de cámara.

Se retiraron el vídeo del corazón (de fondo claro), el rótulo de ilustración generada, el aviso «Variación detectada», la imagen del panel derecho, la nota de color y las etiquetas sobre el cuerpo (se conserva el brillo suave en los sitios con revisión).

**Pendiente:** Óseo y Metabólico no tienen foto: la cuenta de Sunra se quedó sin saldo (cada imagen requiere una preautorización de 0,65 USD). Mientras tanto usan el zoom de cámara del atlas 3D. Para completarlas: `node frontend/scripts/generate-section-video.mjs image skeleton` (y `metabolic`), codificar a WebP en `public/media/systems/` y añadir la entrada en `sectionMedia.ts`.

## Dos temas (ronda 7)

El selector de la cabecera alterna entre **claro** (estudio porcelana: atlas opaco cálido, fotos claras y el bucle de vídeo del corazón) y **oscuro** (espacio con la Tierra al fondo, atlas holográfico aditivo, fotos de Sunra sobre negro con fusión «screen»). La elección se guarda en `localStorage` (`aegis.theme`); sin elección previa se usa `prefers-color-scheme`. Cada tema tiene su propio conjunto de medios en `sectionMediaByTheme` (`public/media/systems/` y `public/media/systems-dark/`); un sistema sin imagen en el tema activo entra con el zoom 3D. En ambos temas la entrada a una sección con imagen es directa y se mantienen retirados los rótulos de «generado», el aviso de variación, la imagen del panel derecho y las etiquetas sobre el cuerpo.
