# SIVLA · Auditoría de referencia y del entorno

Fecha: 2026-10-24 · Fase 1 (solo documentación).
Regla de este documento: cada afirmación está marcada como **[OBSERVADO]** (visto en datos reales), **[INFERIDO]** (deducción razonable) o **[NO VERIFICADO]**.

## 1. Entorno de trabajo

| Elemento | Hallazgo |
|---|---|
| Directorio de trabajo | `/home/user` con tres carpetas: `sivla`, `dropshiping`, `sivla-3d` |
| `sivla/` | Repositorio git vacío (rama `claude/trusting-feynman-jl066w`, sin commits, remoto `xazainspain-svg/sivla`). Aquí se escribe esta documentación y se construirá la landing |
| `dropshiping/` | Repositorio git vacío. No se toca |
| `sivla-3d/` | Proyecto previo **Vite + React 19 + TypeScript + Three.js 0.186**: motor con ciclo de vida de escenas, entrada de ratón/tacto/scroll, calidad adaptativa, shaders GLSL (superficie líquida, partículas), 8 pruebas que pasan. No se modifica; se usa como cantera de módulos |
| Herramientas | Node 22.22, npm 10.9, Python 3.13, ffmpeg, Chromium con Playwright |
| GPU | **Ninguna.** WebGL solo por software (SwiftShader, 20–34 fps en la demo previa). Sirve para comprobar que renderiza y se ve bien, no para medir rendimiento real |
| Red | El registro npm responde. El navegador de pruebas **no** alcanza sitios externos (ni fuentes, ni CDN, ni lusion.co) |
| Proyecto existente que sobrescribir | Ninguno en `sivla/`. No se borra ni reemplaza nada |

## 2. ¿Se puede inspeccionar Lusion?

| Vía | Resultado |
|---|---|
| Navegador con WebGL (Playwright) hacia `lusion.co` y `labs.lusion.co` | **Falla** (`ERR_TUNNEL_CONNECTION_FAILED`). No se puede ver ninguna escena, animación, transición ni comportamiento responsive |
| Extracción de HTML público (Firecrawl) de `lusion.co` y `lusion.co/about` | **Funciona.** Devuelve texto, enlaces y metadatos |
| Extracción de `labs.lusion.co` | Devuelve solo "Twitter Widget Iframe" y metadatos. El contenido es WebGL: **no hay nada auditable** |

Conclusión: la auditoría cubre **estructura, copy, navegación, estilo declarado y tecnologías visibles en metadatos**. No cubre movimiento, escenas 3D, shaders, transiciones ni móvil. Todo lo dicho sobre esos puntos es [NO VERIFICADO] o [INFERIDO].

## 3. Lo observado en lusion.co (contenido público)

### Estructura de la portada [OBSERVADO]
1. Titular largo con palabras muy separadas, "scroll to explore" y un cargador con el texto "refing something…".
2. Bloque "Bold Ideas, Brought to Life": un párrafo de ~30 px y un botón "Our Approach".
3. Enlace a un reel en Vimeo (película de 1:47) con controles PLAY/MUTE.
4. "Featured Work": descripción corta y **12 proyectos**; cada uno con una línea de disciplinas ("concept • web • design • development • 3d • animation") y el título repetido letra a letra (indica una animación por letras) [INFERIDO].
5. Botón "See all projects".
6. "Where Creative Ideas Become Immersive Experiences": titular apilado palabra por palabra y dos párrafos, seguido de "Step into a new world and let your imagination run wild".
7. Cierre: "Is Your Big Idea Ready to Go Wild?", "Let's work together!" y "CONTINUE TO SCROLL".
8. Pie: dirección (Bristol), X/Instagram/LinkedIn, dos correos (general y nuevos negocios), suscripción a newsletter, ©2026, enlace a laboratorio de I+D.
9. Final de página: "Keep Scrolling to Learn More → About Us → Next Page" (la página se encadena con la siguiente).

### Navegación [OBSERVADO]
Enlaces: `/about`, `/projects`, 12 fichas `/projects/<nombre>`, `labs.lusion.co`, redes y correos. La portada declara `user-scalable=no` en una de sus metaetiquetas de viewport.

### Página About [OBSERVADO]
"SCROLL TO EXPLORE", titular a cuatro líneas, un índice "[[ 001 ]]" junto a un perfil de cofundador, "Swipe to change" (carrusel), "Brands we work with" (cinta de logos en bucle), cifras de premios (58 en Awwwards, etc.), artículos, charlas y cuatro áreas de especialidad con listas. Cierra igual que la portada.

### Estilo declarado [OBSERVADO en metadatos]
Fondo blanco; tipografía **Aeonik**; titular 48 px, texto de sección 28,8 px, cuerpo 16,8 px; botón primario `#2B2E3A` con radio de píldora (105 px); botón secundario blanco con sombra suave; campos `#F0F1FA` con radio 18 px; radio base 15 px; acentos `#00FFFF` y `#FF0000`.

### Lo que se infiere, sin poder comprobarlo [INFERIDO]
- Hay una escena 3D continua y reactiva (el estudio se define como estudio WebGL y 3D).
- Hay audio con interruptor (controles PLAY/MUTE).
- El cargador es una pantalla con contador.
- El desplazamiento está suavizado.
- Las transiciones entre páginas son por scroll continuo.

## 4. Qué lenguaje se toma como referencia (principios, no recursos)
| Principio observable | Aplicación propia en SIVLA |
|---|---|
| Copy mínimo, titulares enormes y aireados | Titulares cortos en español, mucho espacio negativo |
| Portafolio como lista tipográfica con disciplinas | Créditos reales de Muso con roles (`producer • mixing`) |
| Botones píldora sobrios, campos suaves | Mismo vocabulario de componentes, con paleta propia |
| Cierre con una gran llamada a la acción | "¿Tu gran idea está lista para sonar?" |
| La página se encadena con la siguiente | Cierre que devuelve al inicio o a un siguiente capítulo |
| Interruptor de sonido | Sonido opcional con consentimiento explícito |

## 5. Lo que NO se copia
Marca, nombre, textos, proyectos, logos de clientes, tipografía propietaria (Aeonik tiene licencia comercial), modelos, shaders y cualquier recurso de lusion.co. La identidad de SIVLA es original.

## 6. Cómo completar la auditoría
Para auditar movimiento, escenas y responsive hace falta un navegador con WebGL y acceso a internet: grabar pantalla en escritorio (1440 px), tableta (820 px) y móvil (390 px), con el panel de red abierto y capturas de cada sección. Con ese material se amplía este documento.
