// Recorded voices: Dadi's guide in Hindi and English, and short lines for the villagers, children,
// shopkeepers and the pujari (made by tools/make-voices.py). They load quietly in the background;
// if they are missing, the guide falls back to the browser's own speech and villagers just show text.

let VO = null;
export const voicesReady = import("./voicelines.js").then((m) => (VO = m)).catch(() => null);

const BASE = "assets/voice/";
export const lineOf = (key) => VO?.VOICE_LINES?.[key] || null;
export const guideClip = (lang, key) => {
  const f = VO?.GUIDE_AUDIO?.[lang]?.[key];
  return f ? BASE + f : null;
};

// one voice at a time for the villagers, so lines never talk over each other
const chatter = new Audio();
chatter.preload = "none";
let chatterEnd = null;
export function say(key, { volume = 1, onstart, onend } = {}) {
  const l = lineOf(key);
  if (!l || !l.file) return null;
  chatter.pause();
  chatterEnd?.();
  chatter.src = BASE + l.file;
  chatter.volume = Math.max(0, Math.min(1, volume));
  chatterEnd = onend || null;
  chatter.onended = () => { chatterEnd?.(); chatterEnd = null; };
  chatter.play().then(() => onstart?.()).catch(() => { chatterEnd?.(); chatterEnd = null; });
  return l;
}
export const pickLine = (prefix) => {
  const keys = Object.keys(VO?.VOICE_LINES || {}).filter((k) => k.startsWith(prefix));
  return keys.length ? keys[(Math.random() * keys.length) | 0] : null;
};
