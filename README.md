# SIVLA · Landing

Landing de SIVLA, productor musical. **Estado: Fase 2, hero 3D "El disco líquido".** El resto de secciones son marcadores (Fases 4 y 5).
Especificación en `docs/` (dirección creativa, arquitectura, auditoría de referencia y hoja de ruta).

## Qué hay ahora
- Wordmark SIVLA y titular; botón y navegación.
- Disco de ~60 anillos concéntricos en cromo iridiscente, calculado en un shader GLSL propio (una malla, una llamada de dibujo).
- Secuencia de entrada: cargador con contador → los anillos nacen del centro con un destello ámbar → letras y palabras aparecen → travelling de cámara.
- Interacción: el cursor o el dedo inclinan el disco y lo hunden como una gota; el scroll lo desplaza y lo acerca.
- Calidad adaptativa (3 niveles) según los milisegundos por fotograma; el render se pausa fuera de pantalla y con la pestaña oculta; recuperación de contexto WebGL.
- Plan B: sin WebGL o con "reducir movimiento" se muestra una pose fija (o una imagen vectorial) y todo el contenido sigue disponible.
- El pulso del disco en reposo es **procedural**; no está sincronizado con ninguna canción (el audio es la Fase 3).

## Ejecutar (Windows 11, macOS o Linux)
Requisitos: Node.js 20 o superior y un navegador con WebGL 2.
```powershell
npm install
npm run dev        # http://localhost:5173
```
Otros comandos:
```powershell
npm run typecheck  # comprobación de tipos
npm test           # pruebas del motor y de la estructura
npm run build      # compilación de producción en dist/
npm run preview    # sirve dist/
npm run inline     # dist/sivla.single.html (un único archivo)
```

## Estructura
```
src/engine/       motor, entrada (ratón/tacto/scroll), calidad adaptativa, liberación de recursos
src/scenes/       DiscScene: el disco líquido
src/shaders/      GLSL: ruido y shader del disco
src/animation/    utilidades de secuencia
src/app/          detección de capacidades
src/styles/       estilos
docs/             especificación de la Fase 1
tests/            pruebas
```

## Verificación visual
Las capturas se hacen con Playwright y Chromium a 390, 820 y 1440 px de ancho y en tres instantes (0,5 s, 3,5 s, 8 s). El entorno de desarrollo no tiene GPU (WebGL por software), así que **valida el aspecto, no el rendimiento**: antes de dar la fase por cerrada hay que probarla en un dispositivo real.

## Licencias
Código propio. Dependencia: three (MIT). Tipografía Hanken Grotesk e IBM Plex Mono (SIL OFL), cargadas desde Google Fonts.
