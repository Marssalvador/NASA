# Modelo visual

Se incluye humanoid.glb: geometría real de Z-Anatomy y BodyParts3D 4.0 preparada localmente. Blender MCP no está conectado; no se generó un archivo .blend.

El visor usa mallas separadas por región, tejido y zona. Las piezas proceden de un atlas, no de primitivas. La copia de frontend/public/models/humanoid.glb se sincroniza durante el build. Créditos y excepciones de licencia filtradas: ATTRIBUTION.md. Manifest con estructuras y bounds: frontend/public/models/anatomy-manifest.json. Fuentes originales de preparación en source/ (ignoradas por Git).

Al sustituir el modelo desde Blender, conservar nombres con prefijos region_heart, region_lungs, region_kidneys, region_muscles, region_skeleton, region_brain y region_metabolic y extras region/tissue/zone. Guardar el original .blend y exportar humanoid.glb en esta carpeta. Mantener sistemas separados, documentar licencia/unidades y evitar texturas externas. Ver docs/ARCHITECTURE.md y preservar el selector accesible de sistemas.
