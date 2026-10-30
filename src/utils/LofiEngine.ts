import * as Tone from "tone";

export type LofiSourceType = "curated" | "local" | "radio" | "youtube";

export interface CuratedTrack {
  id: string;
  name: string;
  genre: string;
  tempo: number;
  description: string;
}

export interface WebRadioStation {
  id: string;
  name: string;
  url: string;
  description: string;
}

export interface YouTubeStream {
  id: string;
  videoId: string;
  name: string;
  channel: string;
  description: string;
}

export interface LofiSourceState {
  type: LofiSourceType;
  curatedId: string;
  localFileName: string;
  localFileSize: string;
  radioUrl: string;
  radioName: string;
  youtubeVideoId: string;
  youtubeTitle: string;
}

export const CURATED_TRACKS: CuratedTrack[] = [
  {
    id: "chill-study",
    name: "Chill Study Hop",
    genre: "Jazzhop / Mellow",
    tempo: 75,
    description: "Relaxed Rhodes electric piano with warm tape saturation and gentle drum bounce.",
  },
  {
    id: "midnight-coffee",
    name: "Midnight Coffee",
    genre: "Late Night Chill",
    tempo: 70,
    description: "Deep jazzy 7th chords, subtle vinyl flutter, and slow ambient bassline.",
  },
  {
    id: "rainy-vibes",
    name: "Rainy Window Hop",
    genre: "Lo-Fi Rain",
    tempo: 68,
    description: "Atmospheric vintage keys filtered through cozy tape modulation.",
  },
  {
    id: "cozy-library",
    name: "Cozy Library",
    genre: "Ambient Lo-Fi",
    tempo: 72,
    description: "Warm acoustic piano progression with soft ambient texture and gentle pulse.",
  },
];

export const CURATED_WEB_RADIOS: WebRadioStation[] = [
  {
    id: "lofi-stream-1",
    name: "Lofi Live Stream",
    url: "https://play.streamafrica.net/lofiradio",
    description: "24/7 non-stop chill lo-fi study beats streaming live.",
  },
  {
    id: "chillhop-radio",
    name: "Chillhop Music Radio",
    url: "https://streams.ilovemusic.de/iloveradio17.mp3",
    description: "Curated jazzy instrumental beats and relaxing lo-fi hip hop.",
  },
  {
    id: "somafm-groove",
    name: "SomaFM Groove Salad",
    url: "https://ice1.somafm.com/groovesalad-128-mp3",
    description: "Award-winning ambient chillout groove station.",
  },
  {
    id: "somafm-lush",
    name: "SomaFM Lush",
    url: "https://ice1.somafm.com/lush-128-mp3",
    description: "Sensuous and mellow electronic beats with warm female vocals.",
  },
];

export const CURATED_YOUTUBE_STREAMS: YouTubeStream[] = [
  {
    id: "lofi-girl",
    videoId: "jfKfPfyJRdk",
    name: "Lofi Girl - Relax / Study",
    channel: "Lofi Girl",
    description: "The classic 24/7 lofi hip hop radio - beats to relax/study to.",
  },
  {
    id: "chillhop-live",
    videoId: "5yx6BWlEVcY",
    name: "Chillhop Radio - Jazzy Beats",
    channel: "Chillhop Music",
    description: "24/7 jazzhop & lofi hip hop beats for study, work & gaming.",
  },
  {
    id: "lofi-sleep",
    videoId: "7NOSDKb0HlU",
    name: "Lofi Sleep & Chillout",
    channel: "Lofi Girl",
    description: "Peaceful, dreamy ambient beats for deep focus and tranquility.",
  },
  {
    id: "coffee-shop",
    videoId: "-5KAN9_CzSA",
    name: "Coffee Shop Lo-Fi",
    channel: "Coffee Shop Vibez",
    description: "Relaxing coffee shop ambiance and cozy lo-fi jazz beats.",
  },
];

// Helper to extract YouTube video ID from various URL formats
export function extractYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch && watchMatch[1]) return watchMatch[1];
  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch && shortMatch[1]) return shortMatch[1];
  const liveMatch = trimmed.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{11})/);
  if (liveMatch && liveMatch[1]) return liveMatch[1];
  const embedMatch = trimmed.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch && embedMatch[1]) return embedMatch[1];
  return null;
}

export class LofiEngine {
  private static instance: LofiEngine;

  private state: LofiSourceState;
  private volume: number = 0.7;
  private isPlaying: boolean = false;

  // Audio elements
  private htmlAudio: HTMLAudioElement | null = null;
  private localAudioUrl: string | null = null;

  // Procedural Tone.js synth for offline Curated Lo-Fi beats
  private proceduralSynth: Tone.PolySynth | null = null;
  private proceduralFilter: Tone.Filter | null = null;
  private proceduralGain: Tone.Gain | null = null;
  private proceduralVibrato: Tone.Vibrato | null = null;
  private proceduralVinyl: Tone.Noise | null = null;
  private proceduralVinylFilter: Tone.Filter | null = null;
  private proceduralVinylGain: Tone.Gain | null = null;
  private proceduralIntervalId: number | null = null;

  // YouTube IFrame bridge
  private ytIframe: HTMLIFrameElement | null = null;

  // Listeners for UI state sync
  private listeners: Set<(state: LofiSourceState) => void> = new Set();
  private playStateListeners: Set<(isPlaying: boolean) => void> = new Set();

  private constructor() {
    this.state = this.loadPersistedState();
  }

  static getInstance(): LofiEngine {
    if (!LofiEngine.instance) {
      LofiEngine.instance = new LofiEngine();
    }
    return LofiEngine.instance;
  }

  private loadPersistedState(): LofiSourceState {
    try {
      const saved = localStorage.getItem("veyro_lofi_state");
      if (saved) {
        return {
          type: "curated",
          curatedId: "chill-study",
          localFileName: "",
          localFileSize: "",
          radioUrl: CURATED_WEB_RADIOS[0]?.url || "",
          radioName: CURATED_WEB_RADIOS[0]?.name || "Lofi Live Stream",
          youtubeVideoId: CURATED_YOUTUBE_STREAMS[0]?.videoId || "jfKfPfyJRdk",
          youtubeTitle: CURATED_YOUTUBE_STREAMS[0]?.name || "Lofi Girl - Relax / Study",
          ...JSON.parse(saved),
        };
      }
    } catch {}

    return {
      type: "curated",
      curatedId: "chill-study",
      localFileName: "",
      localFileSize: "",
      radioUrl: CURATED_WEB_RADIOS[0]?.url || "",
      radioName: CURATED_WEB_RADIOS[0]?.name || "Lofi Live Stream",
      youtubeVideoId: CURATED_YOUTUBE_STREAMS[0]?.videoId || "jfKfPfyJRdk",
      youtubeTitle: CURATED_YOUTUBE_STREAMS[0]?.name || "Lofi Girl - Relax / Study",
    };
  }

  private persistState(): void {
    try {
      localStorage.setItem("veyro_lofi_state", JSON.stringify(this.state));
    } catch {}
  }

  getState(): LofiSourceState {
    return { ...this.state };
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  getVolume(): number {
    return this.volume;
  }

  subscribe(listener: (state: LofiSourceState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribePlayState(listener: (isPlaying: boolean) => void): () => void {
    this.playStateListeners.add(listener);
    return () => this.playStateListeners.delete(listener);
  }

  private notifyStateChange(): void {
    this.persistState();
    this.listeners.forEach((l) => l({ ...this.state }));
  }

  private notifyPlayStateChange(): void {
    this.playStateListeners.forEach((l) => l(this.isPlaying));
  }

  registerYouTubeIframe(iframe: HTMLIFrameElement | null): void {
    this.ytIframe = iframe;
    if (this.ytIframe && this.state.type === "youtube") {
      this.syncYouTubeVolume();
      if (this.isPlaying) {
        this.sendYouTubeCommand("playVideo");
      }
    }
  }

  // Set the current audio source configuration
  setSource(update: Partial<LofiSourceState>): void {
    const wasPlaying = this.isPlaying;
    const typeChanged = update.type && update.type !== this.state.type;
    const trackChanged =
      (update.curatedId && update.curatedId !== this.state.curatedId) ||
      (update.radioUrl && update.radioUrl !== this.state.radioUrl) ||
      (update.youtubeVideoId && update.youtubeVideoId !== this.state.youtubeVideoId);

    if (wasPlaying && (typeChanged || trackChanged)) {
      this.pauseAllEngines();
    }

    this.state = {
      ...this.state,
      ...update,
    };
    this.notifyStateChange();

    if (wasPlaying && (typeChanged || trackChanged)) {
      setTimeout(() => {
        this.play();
      }, 100);
    }
  }

  // Load a user's local audio file
  loadLocalFile(file: File): void {
    if (this.localAudioUrl) {
      URL.revokeObjectURL(this.localAudioUrl);
    }
    this.localAudioUrl = URL.createObjectURL(file);
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);

    this.setSource({
      type: "local",
      localFileName: file.name,
      localFileSize: `${sizeMb} MB`,
    });
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));

    // Update HTML5 audio
    if (this.htmlAudio) {
      this.htmlAudio.volume = this.volume;
    }

    // Update Procedural Synth
    if (this.proceduralGain) {
      this.proceduralGain.gain.rampTo(this.volume * 0.45, 0.1);
    }
    if (this.proceduralVinylGain) {
      this.proceduralVinylGain.gain.rampTo(this.volume * 0.03, 0.1);
    }

    // Update YouTube player
    this.syncYouTubeVolume();
  }

  async play(): Promise<void> {
    this.isPlaying = true;
    this.notifyPlayStateChange();

    if (this.state.type === "youtube") {
      this.pauseHtmlAudio();
      this.stopProceduralSynth();
      this.sendYouTubeCommand("playVideo");
      this.syncYouTubeVolume();
      return;
    }

    if (this.state.type === "radio") {
      this.stopProceduralSynth();
      this.sendYouTubeCommand("pauseVideo");
      this.playHtmlAudio(this.state.radioUrl);
      return;
    }

    if (this.state.type === "local") {
      this.stopProceduralSynth();
      this.sendYouTubeCommand("pauseVideo");
      if (this.localAudioUrl) {
        this.playHtmlAudio(this.localAudioUrl);
      }
      return;
    }

    if (this.state.type === "curated") {
      this.pauseHtmlAudio();
      this.sendYouTubeCommand("pauseVideo");
      await this.startProceduralSynth(this.state.curatedId);
      return;
    }
  }

  pause(): void {
    this.isPlaying = false;
    this.notifyPlayStateChange();
    this.pauseAllEngines();
  }

  private pauseAllEngines(): void {
    this.pauseHtmlAudio();
    this.stopProceduralSynth();
    this.sendYouTubeCommand("pauseVideo");
  }

  // ==================== HTML5 AUDIO ====================
  private playHtmlAudio(url: string): void {
    if (!this.htmlAudio) {
      this.htmlAudio = new Audio();
      this.htmlAudio.loop = true;
      this.htmlAudio.crossOrigin = "anonymous";
      this.htmlAudio.addEventListener("error", (e) => {
        console.warn("[LofiEngine] HTMLAudio error:", e);
      });
    }

    if (this.htmlAudio.src !== url) {
      this.htmlAudio.src = url;
      this.htmlAudio.load();
    }

    this.htmlAudio.volume = this.volume;
    this.htmlAudio.play().catch((err) => {
      console.warn("[LofiEngine] Audio play blocked or failed:", err);
    });
  }

  private pauseHtmlAudio(): void {
    if (this.htmlAudio) {
      try {
        this.htmlAudio.pause();
      } catch {}
    }
  }

  // ==================== PROCEDURAL TONE.JS LO-FI SYNTH ====================
  private async startProceduralSynth(trackId: string): Promise<void> {
    if (this.proceduralIntervalId) {
      window.clearInterval(this.proceduralIntervalId);
      this.proceduralIntervalId = null;
    }

    try {
      if (Tone.context.state !== "running") {
        await Tone.start();
      }

      if (!this.proceduralSynth) {
        this.proceduralSynth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: "triangle8" },
          envelope: {
            attack: 0.15,
            decay: 1.8,
            sustain: 0.4,
            release: 2.2,
          },
        });

        this.proceduralFilter = new Tone.Filter(750, "lowpass", -12);
        this.proceduralFilter.Q.value = 0.5;

        this.proceduralVibrato = new Tone.Vibrato(4, 0.12);

        this.proceduralGain = new Tone.Gain(this.volume * 0.45);

        this.proceduralSynth.chain(
          this.proceduralVibrato,
          this.proceduralFilter,
          this.proceduralGain,
          Tone.getDestination()
        );

        // Ambient vinyl crackle texture
        this.proceduralVinyl = new Tone.Noise("pink").start();
        this.proceduralVinylFilter = new Tone.Filter(1800, "bandpass");
        this.proceduralVinylFilter.Q.value = 2.5;
        this.proceduralVinylGain = new Tone.Gain(this.volume * 0.035);

        this.proceduralVinyl.chain(
          this.proceduralVinylFilter,
          this.proceduralVinylGain,
          Tone.getDestination()
        );
      } else {
        this.proceduralGain?.gain.rampTo(this.volume * 0.45, 0.1);
        this.proceduralVinylGain?.gain.rampTo(this.volume * 0.035, 0.1);
      }

      // Jazz chord progressions tuned for each track style
      const chordProgressions: Record<string, string[][]> = {
        "chill-study": [
          ["D3", "F3", "A3", "C4", "E4"], // Dm9
          ["G2", "F3", "B3", "D4", "E4"], // G13
          ["C3", "E3", "G3", "B3", "D4"], // Cmaj9
          ["A2", "E3", "G3", "C4", "E4"], // Am9
        ],
        "midnight-coffee": [
          ["F3", "A3", "C4", "E4"], // Fmaj7
          ["E3", "G#3", "B3", "D4"], // E7#9
          ["A2", "C3", "E3", "G3", "C4"], // Am7
          ["D3", "F#3", "A3", "C4"], // D7
        ],
        "rainy-vibes": [
          ["Bb2", "F3", "A3", "D4"], // Bbmaj7
          ["A2", "E3", "G3", "C4"], // Am7
          ["G2", "D3", "F3", "Bb3", "D4"], // Gm9
          ["C3", "G3", "Bb3", "E4"], // C7
        ],
        "cozy-library": [
          ["Eb3", "G3", "Bb3", "D4"], // Ebmaj7
          ["C3", "Eb3", "G3", "Bb3"], // Cm7
          ["F2", "C3", "Eb3", "A3"], // F7
          ["Bb2", "F3", "Ab3", "D4"], // Bb7
        ],
      };

      const chords = chordProgressions[trackId] ?? chordProgressions["chill-study"]!;
      let chordIndex = 0;

      // Play first chord immediately
      if (this.proceduralSynth && this.isPlaying) {
        this.proceduralSynth.triggerAttackRelease(chords[chordIndex]!, "2.5n");
      }

      // Progression cycle interval (approx 3.2s per bar)
      this.proceduralIntervalId = window.setInterval(() => {
        if (!this.isPlaying || !this.proceduralSynth) return;
        chordIndex = (chordIndex + 1) % chords.length;
        this.proceduralSynth.triggerAttackRelease(chords[chordIndex]!, "2.8n");
      }, 3400);
    } catch (err) {
      console.warn("[LofiEngine] Procedural synth error:", err);
    }
  }

  private stopProceduralSynth(): void {
    if (this.proceduralIntervalId) {
      window.clearInterval(this.proceduralIntervalId);
      this.proceduralIntervalId = null;
    }
    if (this.proceduralGain) {
      this.proceduralGain.gain.rampTo(0, 0.1);
    }
    if (this.proceduralVinylGain) {
      this.proceduralVinylGain.gain.rampTo(0, 0.1);
    }
  }

  // ==================== YOUTUBE IFRAME BRIDGE ====================
  private sendYouTubeCommand(func: string, args: unknown[] = []): void {
    if (!this.ytIframe || !this.ytIframe.contentWindow) return;
    try {
      this.ytIframe.contentWindow.postMessage(
        JSON.stringify({
          event: "command",
          func,
          args,
        }),
        "*"
      );
    } catch (err) {
      console.warn("[LofiEngine] YouTube postMessage error:", err);
    }
  }

  private syncYouTubeVolume(): void {
    const ytVolume = Math.round(this.volume * 100);
    this.sendYouTubeCommand("setVolume", [ytVolume]);
    if (this.volume === 0) {
      this.sendYouTubeCommand("mute");
    } else {
      this.sendYouTubeCommand("unMute");
    }
  }

  dispose(): void {
    this.pauseAllEngines();
    if (this.htmlAudio) {
      this.htmlAudio.src = "";
      this.htmlAudio = null;
    }
    if (this.localAudioUrl) {
      URL.revokeObjectURL(this.localAudioUrl);
      this.localAudioUrl = null;
    }
    if (this.proceduralSynth) {
      this.proceduralSynth.dispose();
      this.proceduralFilter?.dispose();
      this.proceduralGain?.dispose();
      this.proceduralVibrato?.dispose();
      this.proceduralVinyl?.dispose();
      this.proceduralVinylFilter?.dispose();
      this.proceduralVinylGain?.dispose();
      this.proceduralSynth = null;
    }
  }
}
