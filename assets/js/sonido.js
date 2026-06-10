/*═══════════════════════════════════════════════════════
  SIEMBRA DE ARROZ – UNP Ingeniería Informática 2026-1
  Archivo: assets/js/sonido.js
  Descripción: Gestión de todos los efectos de sonido y
               música de fondo usando la Web Audio API.
  
  INSTRUCCIONES PARA AGREGAR TUS PROPIOS ARCHIVOS DE AUDIO:
  ──────────────────────────────────────────────────────────
  1. Coloca tus archivos .mp3 / .ogg en:  assets/audio/
  2. Nombra los archivos igual que las claves del objeto
     AUDIO_FILES definido abajo (ej. "fondo.mp3").
  3. Si tienes música de Piura (marinera, tonada piurana,
     festejo, etc.) úsala como "fondo.mp3".
  4. El navegador intentará cargar cada archivo; si no
     existe simplemente no suena (no rompe el juego).

  ARCHIVOS RECOMENDADOS:
  ─────────────────────
  assets/audio/fondo.mp3      → Música de fondo (marinera norteña,
                                  tonada de Piura, chicha piurana, etc.)
  assets/audio/agua.mp3       → Sonido de agua fluyendo
  assets/audio/pieza.mp3      → "clic" al colocar una pieza de canal
  assets/audio/quitar.mp3     → Al quitar/devolver una pieza
  assets/audio/roca.mp3       → Al destruir una roca
  assets/audio/balago.mp3     → Al sembrar un bálago (plop vegetal)
  assets/audio/nivel1ok.mp3   → Fanfarria al completar Nivel 1
  assets/audio/ganar.mp3      → Victoria final
  assets/audio/perder.mp3     → Game over / tiempo agotado
═══════════════════════════════════════════════════════*/

const AUDIO_FILES = {
  fondo:    'assets/audio/fondo.mp3',
  agua:     'assets/audio/agua.mp3',
  pieza:    'assets/audio/pieza.mp3',
  quitar:   'assets/audio/quitar.mp3',
  roca:     'assets/audio/roca.mp3',
  balago:   'assets/audio/balago.mp3',
  nivel1ok: 'assets/audio/nivel1ok.mp3',
  ganar:    'assets/audio/ganar.mp3',
  perder:   'assets/audio/perder.mp3',
};

/* Estado global de sonido */
let sonidoActivo = true;
const audioCache = {};
let audioBg = null;

/* ── Precarga todos los archivos de audio ── */
function precargarAudio() {
  for (const [clave, ruta] of Object.entries(AUDIO_FILES)) {
    const a = new Audio();
    a.preload = 'auto';
    // Si el archivo no existe el navegador simplemente ignora
    a.src = ruta;
    if (clave === 'fondo') {
      a.loop = true;
      a.volume = 0.35;
      audioBg = a;
    } else {
      a.volume = 0.65;
    }
    audioCache[clave] = a;
  }
}

/* ── Reproducir efecto de sonido ── */
function playSound(clave) {
  if (!sonidoActivo) return;
  const a = audioCache[clave];
  if (!a) return;
  // Clonar para permitir solapamiento
  const clone = a.cloneNode();
  clone.volume = a.volume;
  clone.play().catch(() => {/* archivo no existe → silencio */});
}

/* ── Iniciar música de fondo ── */
function playBg() {
  if (!sonidoActivo || !audioBg) return;
  audioBg.currentTime = 0;
  audioBg.play().catch(() => {/* autoplay bloqueado o sin archivo */});
}

/* ── Parar música de fondo ── */
function stopBg() {
  if (!audioBg) return;
  audioBg.pause();
  audioBg.currentTime = 0;
}

/* ── Toggle sonido (botón HUD) ── */
function toggleSonido() {
  sonidoActivo = !sonidoActivo;
  const btn = document.getElementById('btnSonido');
  if (sonidoActivo) {
    btn.textContent = '🔊';
    playBg();
  } else {
    btn.textContent = '🔇';
    stopBg();
  }
}

/* Inicializar al cargar */
precargarAudio();
