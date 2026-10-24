# SIVLA · Arquitectura de la landing

## 1. Concepto del hero: "El disco líquido"

### El objeto
Un **disco-membrana**: un vinilo del que solo se ve la cara superior, formado por **anillos concéntricos** (≈ 64 en escritorio, 32 en móvil) en cromo líquido iridiscente. Es una forma abstracta original, no un modelo importado.

**Justificación frente a la identidad musical**
- Los surcos concéntricos de un vinilo y las ondas de una señal de sonido son la misma geometría vista de frente: el objeto *es* la música.
- Cada anillo responde a una banda de frecuencia (graves en el centro, agudos en el borde): una lectura directa de un ecualizador.
- El cromo líquido representa el pulido de mezcla y mastering.
- Es 100 % procedural: geometría generada por código y un único shader; sin modelos ni vídeo.

Alternativas descartadas: una escultura figurativa (requiere modelado y arriesga el aspecto de videojuego), una esfera genérica (no dice nada de la música), partículas sueltas (se ven como cualquier fondo).

### Composición de la primera pantalla (escritorio 1440×900)
- Wordmark **SIVLA** a ~26 vw, tipografía ligera, anclado abajo a la izquierda; el disco queda **parcialmente detrás** de las letras para dar profundidad.
- Disco inclinado ~60°, a la derecha, ocupando ≈ 55 % del alto.
- Arriba a la izquierda, una sola frase (≈ 48 px): "Productor musical internacional. Beats, mezcla y mastering desde Valencia."
- Abajo a la derecha, un botón píldora "Escuchar" (activa el audio) y, debajo, una línea mono "scroll para explorar".
- Móvil (390×844): wordmark en dos líneas, disco centrado y más pequeño, frase debajo, botón fijo en la parte inferior.

### Evolución temporal de la escena
| t | Qué ocurre |
|---|---|
| 0 – 1,2 s | Cargador con contador. El disco no existe todavía |
| 1,2 – 2,6 s | Los anillos nacen desde el centro hacia fuera con 40 ms de desfase; cada uno "se enfoca" desde el desenfoque. El wordmark se revela por letras con máscara |
| 2,6 – 3,6 s | La frase aparece palabra a palabra; la cámara hace un travelling corto hacia delante y se detiene |
| Reposo | El disco respira (amplitud ±3 %, 0,06 Hz) y gira muy despacio. Los reflejos se desplazan |
| Con el cursor | El disco se inclina hasta ±12° (parallax) y los anillos cercanos al cursor se hunden como una gota |
| Con "Escuchar" | Las bandas del análisis de audio modulan la amplitud por anillo; el bombo produce una onda que viaja de dentro a fuera |
| Con scroll | La cámara entra por el **agujero central** del disco y desemboca en la sección Sound |

### Cámara, luz y materiales
- **Cámara:** perspectiva 32°, a 14 unidades; travelling de entrada de 14 → 11 unidades en 2 s con `easeOutExpo`; dolly por scroll hacia el centro.
- **Iluminación:** entorno de estudio generado por código (PMREM) con tres cajas de luz: ámbar a la derecha, cobalto a la izquierda y una blanca superior grande. Sin luces dinámicas.
- **Material:** shader propio de cromo con película fina iridiscente (fresnel + paleta coseno); rugosidad aparente baja. Un segundo material, mate índigo, para el anillo exterior.
- **Sin** postproceso en la primera versión; bloom solo si hay presupuesto de rendimiento.

### Qué no depende de vídeo
Todo se calcula en la GPU en tiempo real. El peso estimado del hero es < 150 KB de código + fuentes.

### Plan B sin WebGL o con "reducir movimiento"
Imagen estática (SVG del disco con degradados), mismo texto, mismo botón. La página sigue completa y legible.

## 2. Estructura narrativa

| # | Sección | Función | Contenido | Transición visual |
|---|---|---|---|---|
| 1 | **HERO** | Identidad y primer impacto | Wordmark, frase, botón "Escuchar" | Entrada por anillos; salida: la cámara cruza el agujero del disco |
| 2 | **SOUND** | Presentar el universo sonoro | 3 frases cortas sobre su manera de producir (a redactar con el propietario) y una franja con las 8 bandas del audio como visualización. Si no hay audio autorizado, se omite la visualización y queda el texto | El disco se descompone en anillos que se alinean como barras del ecualizador |
| 3 | **SELECTED WORKS** | Mostrar y vender el trabajo | Lista de 7 créditos reales: título, artistas, roles (`producer • mixing`), año, enlace a Muso. Portada en grande al pasar el cursor (táctil: miniatura fija) | Cada fila se enciende al llegar a la altura central; la portada entra con la inclinación 3D |
| 4 | **ABOUT** | Presentación artística breve | Una foto real de SIVLA (grande, una sola vez), 4 cifras verificadas (145 créditos, 256 colaboradores, 129 producciones, Valencia) y un párrafo corto | La foto emerge desde el cromo con una máscara circular |
| 5 | **CONTACT** | Colaboraciones y contratación | Servicios y tarifas en tres filas, formulario con el servicio preseleccionado, Instagram, TikTok y Muso. Fondo invertido a índigo | El disco reaparece pequeño, "listo", y el cierre invita a volver al inicio |

### Navegación
- Barra superior fija: logo SIV-LA a la izquierda; a la derecha "Sound · Works · About · Contact" y un interruptor de sonido.
- Móvil: botón "Menú" que abre una hoja a pantalla completa con las mismas cuatro entradas, tamaño táctil ≥ 48 px.
- Indicador de sección activa y anclas con URL (`#works`), accesibles por teclado.
- El experimento visual nunca sustituye a la navegación.

## 3. Arquitectura técnica (componentes)

```
src/
  main.ts                 arranque, detección de capacidades
  app/
    App.ts                orquestador: carga, secciones, escenas
    Sections/             Hero, Sound, Works, About, Contact (HTML + comportamiento)
    Nav/                  barra, menú móvil, indicador de sección
  engine/                 (módulos reutilizados de sivla-3d)
    Engine.ts             renderer, bucle, ciclo de vida de escenas
    Input.ts              ratón, tacto, scroll suavizado
    Quality.ts            calidad adaptativa con histéresis
    Dispose.ts
  scenes/
    DiscScene.ts          el disco líquido (hero y reapariciones)
    SoundScene.ts         descomposición en barras
  shaders/                chrome.vert/frag, rings.vert, noise.glsl
  audio/
    AudioEngine.ts        AudioContext, carga de previews, AnalyserNode
    Bands.ts              FFT → 8 bandas suavizadas
  animation/
    Timeline.ts           secuencias por tiempo
    Damp.ts               amortiguación exponencial
    ScrollDirector.ts     mapea scroll → cámara/escena
  assets/                 fuentes, WebP de portadas, MP3 de previews
  styles/                 tokens, tipografía, componentes
```

### Escena 3D
- Un solo `Scene` persistente para hero → sound; el `ScrollDirector` mueve cámara y parámetros de uniforms. Contact crea una segunda escena pequeña (disco reducido) bajo demanda.
- Anillos: `InstancedMesh` de un anillo (`RingGeometry`), 1 draw call; el shader calcula posición y amplitud por instancia.
- El disco completo cabe en < 100 k vértices en el nivel alto.

### Sistema de animación
- Bucle propio con `damp(actual, objetivo, k, dt)`; es independiente de los fps.
- Secuencias de entrada con una pequeña clase `Timeline` (promesas + easing); GSAP solo si más adelante hacen falta líneas de tiempo pineadas complejas (decisión en la Fase 3).
- Scroll suave propio (inercia) con respeto a "reducir movimiento" y al scroll nativo en táctil.

### Sistema de audio (cómo se obtiene la señal)
1. **Fuente:** archivos MP3/OGG **del propio proyecto**, de 30–60 s por tema, **aportados y autorizados por el propietario**. Spotify, YouTube o Muso no entregan audio analizable; sus reproductores incrustados no se pueden conectar a un analizador.
2. **Reproducción:** `<audio>` con `crossOrigin` no necesario (mismo origen) → `MediaElementAudioSourceNode` → `AnalyserNode` (`fftSize 1024`, `smoothingTimeConstant 0,8`).
3. **Procesado:** `getByteFrequencyData` por fotograma → 8 bandas (sub, bajo, medio-bajo, medio, medio-alto, presencia, brillo, aire) → suavizado con ataque rápido y caída lenta → uniforms del shader.
4. **Detección de golpe de bombo:** umbral adaptativo sobre la banda 0–1 con tiempo refractario de 120 ms.
5. **Reglas:** nunca se reproduce solo; solo tras el botón "Escuchar" o el interruptor; volumen inicial moderado; interruptor siempre visible.
6. **Sin audio disponible:** el disco usa un pulso procedural de reposo y **no se afirma** que esté sincronizado con ninguna canción.

### Gestión de recursos
- Fuentes: 1 familia variable con `font-display: swap`, subconjunto latino.
- Portadas: WebP 640 px (≈ 40–60 KB), carga perezosa; la primera, `preload`.
- Audio: carga bajo demanda tras el primer gesto.
- Three.js con importaciones por módulo para reducir el paquete (< 600 KB gzip objetivo).
- Texturas procedurales (canvas) generadas una vez; `dispose()` al abandonar una escena.

### Responsive
- Breakpoints: 480, 768, 1200, 1600.
- Móvil: la cantidad de anillos baja a 32, DPR máx. 1,5, sin sombras ni reflejos adicionales, hero con wordmark en dos líneas.
- Orientación horizontal en móvil: se trata como pantalla baja (hero de altura mínima 100 svh).
- Táctil: arrastre del dedo equivale al cursor; sin hover, las portadas se ven como miniaturas fijas.

### Optimización
Calidad adaptativa por milisegundos de fotograma; pausa total del render cuando la pestaña está oculta o la sección no es visible; un único renderer; sin postproceso en nivel bajo; presupuestos: 60 fps objetivo en GPU de gama media, 30 fps mínimo aceptable en móvil de gama baja.

### Accesibilidad
- Todo el contenido existe en HTML real (SEO y lectores de pantalla); el canvas es `aria-hidden`.
- `prefers-reduced-motion`: sin scroll suave, sin cargador animado, disco estático.
- Contraste ≥ 4,5:1 en texto; foco visible; navegación completa por teclado.
- El audio no se inicia solo; botón con `aria-pressed` y etiqueta clara; la visualización no es el único canal de información.
- Sin parpadeos de alto contraste mayores de 3 por segundo.

### Verificación visual
- Playwright con Chromium y SwiftShader: capturas del hero a 3 anchos (390, 820, 1440) y 3 instantes (t = 0,5 s, 3 s, 8 s).
- Capturas de cada sección tras desplazarse.
- Medición de fotogramas (solo comparativa relativa: SwiftShader no equivale a una GPU real).
- Lista de comprobación manual en un dispositivo real antes de dar una fase por cerrada.
