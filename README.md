# SIVLA · Landing

Landing de SIVLA, productor musical. **Estado: Fases 2, 3 y 4: hero 3D "El disco líquido", audio reactivo y secciones Sound y Selected Works.** About y Contact son marcadores (Fase 5).
Especificación en `docs/` (dirección creativa, arquitectura, auditoría de referencia y hoja de ruta).

## Qué hay ahora
- Wordmark SIVLA y titular; botón y navegación.
- Disco de ~60 anillos concéntricos en cromo iridiscente, calculado en un shader GLSL propio (una malla, una llamada de dibujo).
- Secuencia de entrada: cargador con contador → los anillos nacen del centro con un destello ámbar → letras y palabras aparecen → travelling de cámara.
- Interacción: el cursor o el dedo inclinan el disco y lo hunden como una gota; el scroll lo desplaza y lo acerca.
- Calidad adaptativa (3 niveles) según los milisegundos por fotograma; el render se pausa fuera de pantalla y con la pestaña oculta; recuperación de contexto WebGL.
- Plan B: sin WebGL o con "reducir movimiento" se muestra una pose fija (o una imagen vectorial) y todo el contenido sigue disponible.
- **Audio (Fase 3):** el botón "Escuchar" (nunca arranca solo) reproduce un tema autorizado o, si no hay ninguno, un **beat sintético original de demostración**, y lo analiza con `AnalyserNode` (FFT 1024). Salen 8 bandas (graves en el centro del disco, agudos en el borde) y un detector de bombo que lanza una onda de dentro hacia fuera. Con volumen y estado visibles.
- El pulso del disco en reposo (sin audio) es **procedural**; no está sincronizado con ninguna canción.

### Cómo añadir audios reales
1. Copia los previews autorizados (30–60 s, MP3/OGG, ≤ 1,5 MB) a `public/audio/`.
2. Añádelos en `src/audio/tracks.ts`. Con la lista vacía se usa el beat de demostración y la interfaz lo dice.
Spotify, YouTube y Muso no entregan audio analizable; hacen falta archivos propios.

## Sound y Selected Works (Fase 4)
- **Sound:** al hacer scroll, el disco viaja al centro, se pone de frente y la cámara **cruza su agujero**; al otro lado el disco se descompone en 48 barras cromadas que siguen el audio (o un pulso de reposo procedural si no suena nada). Tres frases aparecen una a una; el texto es un borrador a aprobar por el propietario.
- **Selected Works:** los 7 créditos reales de Muso con roles, artistas y año, cada uno enlazado a su canción. Al pasar el cursor aparece una portada que lo sigue (en táctil, miniatura fija).
- **Portadas:** son **provisionales y originales** (anillos con el título y la leyenda "portada pendiente"). Se sustituirán por las portadas oficiales cuando se aporten los archivos.
- Con "reducir movimiento" o sin WebGL, Sound se muestra como una sección normal con las tres frases visibles.

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
src/audio/        AudioEngine, análisis de bandas, detector de bombo, lista de temas
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
