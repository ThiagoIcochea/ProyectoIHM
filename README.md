# Escucha — MVP de acompañamiento emocional (IHM · UTP)

Escucha es una app anónima para adolescentes y jóvenes (12–21 años) que necesitan calmarse o pedir ayuda a tiempo. Este MVP lleva el prototipo de Figma (AP3) a código funcional y lo extiende a **las 7 modalidades de interacción** pedidas, con **navegación por voz** en toda la app.

**Demo:** https://thiagoicochea.github.io/ProyectoIHM/

## Las 7 experiencias

| # | Modalidad | Qué hace | Cómo probarla |
|---|-----------|----------|---------------|
| 1 | Reloj inteligente | Esfera con hora y pulso, respiración, registro de emoción en un toque y SOS manteniendo 2 s, con vibración | Laptop: rueda del mouse o flechas = corona. Móvil: deslizar. Reloj Wear OS: abrir la URL y “Pantalla completa” |
| 2 | Móvil y plegable | Chat en una mitad, respiración o diario en la otra | Plegable real con Chrome (Viewport Segments API); en móvil normal, pestañas o “Simular plegable” |
| 3 | Voz | Conversación manos libres con la IA, respuestas habladas | Chrome/Edge/Safari; en Firefox o Quest transcribe con Whisper (Groq) |
| 4 | IoT | Pulsera (simulada o real por Web Bluetooth), lámpara, parlante con sonido real y difusor. Automatización: pulso > 100 lpm por 5 s → escena calma + sugerencia de respirar | Subir “Simular estrés”, o conectar una banda con perfil Heart Rate BLE |
| 5 | RV / RA | Santuario 3D con 6 mundos (bosque, playa, noche con fogata y aurora, montaña, espacio, jardín zen) con esfera de respiración, paneles clicables con mouse o controles | Meta Quest Browser → “Entrar al visor”. Android → botón AR. iPhone → “RA con cámara” |
| 6 | Mapa 3D | Centros de salud reales (OpenStreetMap/Overpass) a 3 km, edificios 3D, cómo llegar | Permitir ubicación; por defecto Lima centro |
| 7 | Interfaces emergentes | Gestos con la cámara (MediaPipe): mano abierta = inhala, puño = exhala, pulgar = “me siento mejor”, índice 2 s = ayuda | Activar cámara; sin cámara, teclas P F T H |

## Cuenta, dispositivos y datos
- **Crear cuenta / iniciar sesión** (`/cuenta`): usuario + contraseña (PBKDF2 con Web Crypto), sin correo ni nombre real. Código de recuperación al registrarse. También se puede usar sin cuenta.
- Las cuentas viven en el navegador (no hay servidor): sirven para separar los datos de quienes comparten un dispositivo, no para sincronizar entre dispositivos.
- **Eliminar cuenta** (Perfil → Cuenta y datos): advertencia, alternativa de desactivar, motivo, confirmación con ELIMINAR + contraseña, 30 días de gracia y comprobante descargable.
- **Mis dispositivos** (`/dispositivos`): vincula relojes o pulseras por Web Bluetooth y lee los servicios GATT estándar (frecuencia cardiaca, SpO₂, temperatura, presión, batería) y envía alertas o notificaciones si el equipo lo permite. Para relojes que no comparten esos servicios, Escucha envía notificaciones del sistema que el reloj emparejado refleja.

## Navegación por voz
- Botón de micrófono flotante o tecla **V**; **Manos libres** escucha siempre (opcional: palabra de activación “Escucha…”).
- Órdenes globales: “abre respiración”, “ir al chat”, “llévame al mapa”, “atrás”, “lee la pantalla”, “modo oscuro”, “aumenta el texto”, “necesito ayuda”, “qué puedo decir”.
- Cada pantalla añade sus órdenes (p. ej. “empezar”, “pon olas”, “el más cercano”, “dictar”, “guardar”).
- Si la frase no es una orden conocida y hay clave de Groq, un modelo pequeño clasifica la intención; las frases personales van al chat.
- Si se detectan señales de riesgo, se muestra de inmediato la Línea 113 opción 5 (MINSA, gratuita, 24 h).

## IA (Groq)
Tres formas de activarla: (1) pegar la clave en **Perfil → Inteligencia artificial**; (2) definir el secreto `GROQ_API_KEY` en *Settings → Secrets and variables → Actions* para que la demo publicada ya tenga IA (la clave queda visible en el código de la página); (3) publicar el proxy de `proxy/worker.js` en Cloudflare Workers y poner su URL en Perfil o en la variable `GROQ_PROXY` (la clave queda en el servidor).
La clave **no está en el repositorio**. Pégala en la app: **Perfil → Inteligencia artificial** (se guarda solo en tu navegador), o crea un `.env` local con `VITE_GROQ_API_KEY=` para desarrollo. Sin clave, el chat funciona con respuestas básicas.
Modelos: `openai/gpt-oss-120b` (con respaldo `llama-3.3-70b-versatile` y `llama-3.1-8b-instant`), `whisper-large-v3-turbo` para voz.

## Ejecutar
```bash
npm install
npm run dev      # http://localhost:5173 (también en tu red local para probar en el móvil)
npm run build
```
Micrófono, cámara, Bluetooth y WebXR requieren **HTTPS** (GitHub Pages) o `localhost`.

## Stack
React 19 + Vite, React Router, A-Frame 1.7 (WebXR), MapLibre GL + OpenFreeMap, MediaPipe Tasks Vision, Web Speech API, Web Audio, Web Bluetooth. Accesibilidad: texto 100–200 %, alto contraste 7:1, tema oscuro, reducir movimiento, lectura en voz alta y subtítulos.

Escucha no reemplaza la atención profesional.
