// Diwali songs through YouTube's official embedded player.
// YouTube requires the player to stay visible while it plays (at least 200px tall), so it lives in a
// docked mini-player rather than playing hidden in the background. Nothing is downloaded.

// Checked with YouTube's oEmbed endpoint: each exists and allows embedding.
export const TRACKS = [
  { id: "lc54LDZjon8", title: "Ram Aayenge · Vishal Mishra, Payal Dev", by: "T-Series" },
  { id: "q5PmN7SuUkY", title: "Mere Ghar Ram Aaye Hain · Jubin Nautiyal", by: "T-Series" },
  { id: "xaciGzadGTo", title: "Ram Siya Ram · Sachet-Parampara (Adipurush)", by: "T-Series" },
  { id: "iVMDw_CvE84", title: "Aaj Aai Deepawali", by: "T-Series Bhakti Sagar" },
  { id: "LsOaDMJznY4", title: "Shubh Diwali · Kapil Vyas, Uma Sharma", by: "T-Series Bhakti Sagar" },
  { id: "b5LdSRLdSc0", title: "Shubh Deepawali · Pratik Jain, Shivani Joshi", by: "JollyGul" },
  { id: "ltg4RUxZA2A", title: "Diwali Special Shehnai · Ustad Bismillah Khan", by: "Saregama Hindustani Classical" },
  { id: "KWlcoLVz89g", title: "Om Jai Lakshmi Mata · Tripti Shakya", by: "T-Series Bhakti Sagar", aarti: true },
  { id: "SyqgAt-T0iQ", title: "Lakshmi Aarti · Anuradha Paudwal", by: "T-Series Bhakti Sagar" },
  { id: "dqRnZWrHhEI", title: "Festive Shehnai · Ustad Bismillah Khan", by: "Ishtar Music" },
];

// Accepts a video link, a youtu.be link, a playlist link or a bare 11-character id.
export function parseYouTube(text) {
  const s = String(text || "").trim();
  if (!s) return null;
  if (/^[\w-]{11}$/.test(s)) return { id: s };
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)youtube-nocookie\.com$/.test(u.hostname)) return null;
    const list = u.searchParams.get("list");
    let id = u.searchParams.get("v");
    if (!id && u.hostname.endsWith("youtu.be")) id = u.pathname.slice(1, 12);
    if (!id) { const m = u.pathname.match(/\/(?:embed|shorts|live)\/([\w-]{11})/); if (m) id = m[1]; }
    if (id && !/^[\w-]{11}$/.test(id)) id = null;
    if (list && /^[\w-]+$/.test(list)) return { list, id };
    return id ? { id } : null;
  } catch (_) {
    return null;
  }
}

let apiPromise = null;
function loadApi() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev && prev(); resolve(window.YT); };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => reject(new Error("YouTube player could not load"));
    document.head.appendChild(s);
  });
  return apiPromise;
}

export class Music {
  constructor(mountId, { onState } = {}) {
    this.mountId = mountId;
    this.onState = onState;
    this.player = null;
    this.ready = null;
    this.index = 0;
    this.volume = 70;
    this.ducked = false;
    this.playing = false;
    this.custom = null; // a pasted video or playlist
  }

  preload() { loadApi().catch(() => {}); }

  init() {
    if (this.ready) return this.ready;
    this.ready = loadApi().then((YT) => new Promise((resolve) => {
      this.player = new YT.Player(this.mountId, {
        host: "https://www.youtube-nocookie.com",
        width: "100%",
        height: "100%",
        videoId: TRACKS[this.index].id,
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => { this.player.setVolume(this.volume); resolve(this.player); },
          onStateChange: (e) => {
            this.playing = e.data === YT.PlayerState.PLAYING;
            // single videos advance through our list; a pasted playlist runs on its own
            if (e.data === YT.PlayerState.ENDED && !this.custom?.list) this.next();
            this.onState?.(this);
          },
          onError: () => { if (!this.custom) this.next(); else this.onState?.(this, "This video can't be played here"); },
        },
      });
    }));
    return this.ready;
  }

  async play(i = this.index) {
    await this.init();
    this.custom = null;
    this.index = (i + TRACKS.length) % TRACKS.length;
    this.player.loadVideoById(TRACKS[this.index].id);
    this.onState?.(this);
  }

  async playLink(text) {
    const p = parseYouTube(text);
    if (!p) return false;
    await this.init();
    this.custom = p;
    if (p.list) this.player.loadPlaylist({ list: p.list, listType: "playlist", index: 0 });
    else this.player.loadVideoById(p.id);
    this.onState?.(this);
    return true;
  }

  async toggle() {
    await this.init();
    if (this.playing) this.player.pauseVideo();
    else if (this.player.getPlayerState?.() === -1 || this.player.getPlayerState?.() === 5) this.play(this.index);
    else this.player.playVideo();
  }

  next() { return this.play(this.index + 1); }
  prev() { return this.play(this.index - 1); }

  setVolume(v) {
    this.volume = v;
    if (this.player?.setVolume) this.player.setVolume(this.ducked ? v * 0.25 : v);
  }

  // dip under the village's own bells and singing, then come back up
  duck(on) {
    if (this.ducked === on) return;
    this.ducked = on;
    if (this.player?.setVolume) this.player.setVolume(on ? this.volume * 0.25 : this.volume);
  }

  title() {
    if (this.custom) return this.custom.list ? "Your playlist" : "Your song";
    return TRACKS[this.index].title;
  }
}
