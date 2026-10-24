# SIVLA · Hoja de ruta de implementación

## 1. Stack propuesto y por qué

| Tecnología | Decisión | Razón |
|---|---|---|
| **TypeScript** | Sí | Contratos claros entre motor, escenas y audio; menos errores en refactors |
| **Vite** | Sí | Arranque instantáneo, compilación pequeña, ya usado en `sivla-3d` |
| **Three.js** | Sí | Estándar de WebGL; instancing, PMREM y materiales listos |
| **Shaders GLSL propios** | Sí | El disco, el cromo y los anillos son shaders; no hay modelos |
| **WebGL 2** | Sí | Soporte actual en Chrome, Edge, Firefox y Safari; con alternativa estática |
| **React** | **No** en la landing | La página es mayormente contenido estático + un canvas; React sumaría peso sin ventaja clara. Se reevalúa solo si aparecen estados de interfaz complejos (carrito, panel de cliente) |
| **GSAP / ScrollTrigger** | **Aplazado** | El bucle propio con amortiguación y una clase `Timeline` cubren hero y transiciones. Se adopta en la Fase 4 solo si hay secciones pineadas con líneas de tiempo largas (y se verifica entonces su licencia) |
| **Web Audio API** | Sí | `AnalyserNode` para las bandas; imprescindible para sincronía real |
| **Houdini / Blender** | No ahora | La geometría es procedural. Solo si se aprueba un objeto escultórico complejo |
| **Postprocesado** | Opcional | Bloom suave únicamente si hay margen de rendimiento |

Código a reutilizar de `sivla-3d` (copiado, no enlazado): `Engine`, `Input`, `QualityController`, `dispose`, la función de ruido GLSL y el shader de superficie cromada con película fina.

## 2. Fases

### Fase 2 · Hero 3D real
**Entrega:** proyecto Vite + TS en `sivla/`, wordmark SIVLA, disco líquido con la secuencia de entrada, respuesta a cursor y táctil, calidad adaptativa, plan B estático.
**Aceptación:**
- Capturas a 390/820/1440 px y en 3 instantes, sin errores en consola.
- Paquete < 600 KB gzip; hero < 150 KB propios.
- `prefers-reduced-motion` y sin WebGL funcionan.
- Sin audio todavía; el pulso de reposo está etiquetado como procedural.

### Fase 3 · Audio y sincronía — **hecha (con beat de demostración)**
**Entrega:** `AudioEngine`, `Bands`, detección de bombo, botón "Escuchar", volumen, y la franja de bandas del Hero.
**Requiere del propietario:** 1–3 audios autorizados de 30–60 s.
**Estado:** `AudioEngine`, `bands.ts`, detector de bombo, botón, volumen y barras implementados; verificado con un beat sintético original. Pendiente: probar con los temas reales cuando haya audio autorizado.
**Aceptación:** las bandas siguen el audio de prueba; sin audio, el botón desaparece o muestra un mensaje honesto; el audio nunca arranca solo.

### Fase 4 · Secciones Sound y Selected Works
**Entrega:** transición de cámara por el agujero del disco, descomposición en barras, lista de 7 créditos con portada flotante/miniatura táctil, enlaces a Muso.
**Requiere:** portadas originales (WebP); hasta entonces, marcadores de posición con el título.

### Fase 5 · About, Contact y navegación
**Entrega:** foto real, cifras verificadas, tarifas, formulario, sección invertida, menú móvil, indicador de sección.
**Requiere:** decidir el canal real de envío del formulario (correo, formulario externo o Instagram). Mientras tanto, mensaje honesto de "demostración".

### Fase 6 · Pulido y verificación
**Entrega:** accesibilidad, rendimiento real en dispositivos, SEO básico (títulos, descripción, Open Graph), pruebas visuales, README de despliegue y publicación.

## 3. Riesgos y limitaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| **No se puede ver la referencia en movimiento** (navegador sin acceso a Lusion) | Alto | Auditoría limitada a texto/estructura; pedir grabaciones o capturas de pantalla para ajustar movimiento y transiciones |
| **Sin GPU en el entorno de desarrollo** | Alto | Las capturas validan aspecto, no rendimiento; reservar una prueba en dispositivo real antes de cerrar cada fase |
| **Audio no autorizado o inexistente** | Alto | Sin audio no se afirma sincronía; fallback procedural etiquetado |
| **Derechos de portadas y de la foto** | Medio | Confirmar autorización; usar marcadores de posición hasta recibirlas |
| **Rendimiento en móviles de gama baja** | Medio | Calidad adaptativa, menos anillos, DPR limitado, plan B estático |
| **Política de audio de los navegadores (iOS, Safari)** | Medio | Solo tras gesto del usuario; `AudioContext.resume()` en el clic |
| **Sobrecarga visual** (otra vez "recargada") | Medio | Regla: un movimiento principal por pantalla; revisar cada fase contra la lista de exclusiones |
| **Tipografía** | Bajo | Fuente libre (Hanken Grotesk); no se usa Aeonik |
| **Formulario sin destino real** | Bajo | Decidirlo en la Fase 5 |
| **Dos puntos de verdad** (`sivla-3d` y `sivla`) | Bajo | `sivla-3d` queda congelado como cantera; el código vivo está en `sivla/` |

## 4. Verificación visual por fase
1. `npm run build` y `npm test` sin fallos.
2. Capturas Playwright (3 anchos × 3 instantes por sección).
3. Revisión humana de las capturas contra la lista de exclusiones y el sistema visual.
4. Prueba en un dispositivo real (escritorio y móvil) con medición de fotogramas.

## 5. Qué necesito del propietario antes de la Fase 2
1. Confirmar la dirección recomendada (B + disciplina editorial de C).
2. Confirmar wordmark **SIVLA** y la paleta propuesta.
3. Aprobar la creación del proyecto Vite + TS en `sivla/` y la instalación de `three`, `typescript` y `vite`.
4. (Para la Fase 3) Audios autorizados; (para la Fase 4) portadas originales.
5. Opcional pero muy útil: grabación de pantalla o capturas de lusion.co en escritorio y móvil.
