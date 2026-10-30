import {
  Cloud,
  CloudRain,
  Headphones,
  Music,
  Pause,
  Play,
  SlidersHorizontal,
  Waves,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

import BaseModal from "@/modals/BaseModal";
import LofiOptionsModal from "@/modals/LofiOptionsModal";
import ReactSlider from "react-slider";
import { motion } from "framer-motion";
import { useNoise } from "@/utils/NoiseContext";
import { LofiEngine, LofiSourceState } from "@/utils/LofiEngine";

// -------------------------
// SoundControl component
// -------------------------

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
}

type IconComponent = React.ComponentType<IconProps>;

interface SoundControlProps {
  soundKey: string;
  label: string;
  icon: IconComponent;
  volume: number;
  setVolume: (vol: number) => void;
  isPlaying: boolean;
  start: () => void;
  stop: () => void;
  max: number;
  index: number;
  sublabel?: string;
  onOpenOptions?: () => void;
}

const SOUND_THEMES = {
  brown: {
    iconBg: "bg-amber-500/10",
    iconText: "text-amber-600 dark:text-amber-400",
    gradient: "bg-gradient-to-r from-amber-400 to-amber-600",
    activeBorder: "border-amber-500/40",
    activeRing: "ring-amber-500/30",
    badge: "bg-amber-500/10",
    badgeText: "text-amber-600 dark:text-amber-400",
    thumb: "bg-amber-500 focus:ring-amber-500/40",
    buttonHover:
      "hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400",
  },
  rain: {
    iconBg: "bg-blue-500/10",
    iconText: "text-blue-600 dark:text-blue-400",
    gradient: "bg-gradient-to-r from-blue-400 to-blue-600",
    activeBorder: "border-blue-500/40",
    activeRing: "ring-blue-500/30",
    badge: "bg-blue-500/10",
    badgeText: "text-blue-600 dark:text-blue-400",
    thumb: "bg-blue-500 focus:ring-blue-500/40",
    buttonHover:
      "hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400",
  },
  ocean: {
    iconBg: "bg-cyan-500/10",
    iconText: "text-cyan-600 dark:text-cyan-400",
    gradient: "bg-gradient-to-r from-cyan-400 to-cyan-600",
    activeBorder: "border-cyan-500/40",
    activeRing: "ring-cyan-500/30",
    badge: "bg-cyan-500/10",
    badgeText: "text-cyan-600 dark:text-cyan-400",
    thumb: "bg-cyan-500 focus:ring-cyan-500/40",
    buttonHover:
      "hover:bg-cyan-500/10 hover:text-cyan-600 dark:hover:text-cyan-400",
  },
  lofi: {
    iconBg: "bg-purple-500/10",
    iconText: "text-purple-600 dark:text-purple-400",
    gradient: "bg-gradient-to-r from-purple-400 to-indigo-600",
    activeBorder: "border-purple-500/40",
    activeRing: "ring-purple-500/30",
    badge: "bg-purple-500/10",
    badgeText: "text-purple-600 dark:text-purple-400",
    thumb: "bg-purple-500 focus:ring-purple-500/40",
    buttonHover:
      "hover:bg-purple-500/10 hover:text-purple-600 dark:hover:text-purple-400",
  },
};

type SoundTheme = (typeof SOUND_THEMES)[keyof typeof SOUND_THEMES];

function getSoundTheme(key: string): SoundTheme {
  return SOUND_THEMES[key as keyof typeof SOUND_THEMES] ?? SOUND_THEMES.brown;
}

function SoundControl({
  soundKey,
  label,
  icon: Icon,
  volume,
  setVolume,
  isPlaying,
  start,
  stop,
  max,
  index,
  sublabel,
  onOpenOptions,
}: SoundControlProps) {
  const theme = getSoundTheme(soundKey);
  const percentage = Math.round((volume / max) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1 }}
      className={`relative rounded-xl border bg-[var(--bg-primary)] p-2.5 sm:p-3 transition-all duration-200 hover:shadow-md ${
        isPlaying
          ? `${theme.activeBorder} shadow-sm ring-1 ${theme.activeRing}`
          : "border-[var(--border-primary)]"
      }`}
    >
      <div className="flex items-center gap-3 sm:gap-3.5">
        <motion.div
          animate={isPlaying ? { scale: [1, 1.05, 1] } : { scale: 1 }}
          transition={{
            repeat: Infinity,
            duration: 3,
            ease: "easeInOut",
            delay: index * 0.15,
          }}
          className={`relative flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl ${theme.iconBg}`}
        >
          <Icon size={19} className={theme.iconText} />
          {isPlaying && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: [0.35, 0], scale: [1, 1.4] }}
              transition={{
                repeat: Infinity,
                duration: 3,
                ease: "easeInOut",
                delay: index * 0.15,
              }}
              className={`absolute inset-0 rounded-xl ${theme.activeRing}`}
            />
          )}
        </motion.div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-semibold text-xs sm:text-sm text-[var(--text-primary)] truncate">
                {label}
              </span>
              {onOpenOptions && (
                <button
                  type="button"
                  onClick={onOpenOptions}
                  aria-label="Lo-Fi options"
                  title="Configure Lo-Fi audio sources"
                  className="p-1 rounded-md text-[var(--text-secondary)] hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-500/10 transition-colors shrink-0"
                >
                  <SlidersHorizontal size={13} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {sublabel && (
                <span className="text-[11px] text-[var(--text-secondary)] hidden md:inline truncate max-w-[120px]">
                  {sublabel}
                </span>
              )}
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${theme.badge} ${theme.badgeText}`}
              >
                {percentage}%
              </span>
            </div>
          </div>

          <ReactSlider
            className="h-2 w-full bg-[var(--border-primary)] rounded-full cursor-pointer"
            thumbClassName={`h-4.5 w-4.5 rounded-full ${theme.thumb} border-2 border-[var(--bg-primary)] shadow-sm cursor-pointer -translate-y-1.25 transition-transform hover:scale-115 focus:outline-none focus:ring-2`}
            trackClassName="h-2 rounded-full"
            renderTrack={(
              props: { key?: React.Key } & React.HTMLProps<HTMLDivElement>
            ) => {
              const { key, ...rest } = props;
              return (
                <div
                  key={key}
                  {...rest}
                  className={`h-2 rounded-full ${theme.gradient}`}
                />
              );
            }}
            min={0}
            max={max}
            step={0.01}
            value={volume}
            onChange={(v) => setVolume(Array.isArray(v) ? v[0] ?? 0 : v)}
            renderThumb={(props) => {
              const { key, ...rest } = props;
              return <div key={key} {...rest} />;
            }}
          />
        </div>

        <button
          type="button"
          onClick={isPlaying ? stop : start}
          aria-label={isPlaying ? `Stop ${label}` : `Play ${label}`}
          className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-200 hover:scale-105 ${
            isPlaying
              ? `${theme.iconBg} ${theme.iconText}`
              : `bg-[var(--bg-secondary)] text-[var(--text-secondary)] ${theme.buttonHover}`
          }`}
        >
          {isPlaying ? (
            <Pause size={18} />
          ) : (
            <Play size={18} className="ml-0.5" />
          )}
        </button>
      </div>
    </motion.div>
  );
}

// -------------------------
// NoiseSettingsModal
// -------------------------
function NoiseSettingsModal({
  isOpen,
  onClose,
  sounds,
  setMaxVolume,
  onOpenLofiModal,
  lofiState,
}: {
  isOpen: boolean;
  onClose: () => void;
  sounds: ReturnType<typeof useNoise>["sounds"];
  setMaxVolume: (index: number, maxVolume: number) => void;
  onOpenLofiModal: () => void;
  lofiState: LofiSourceState;
}) {
  const [selectedPresets, setSelectedPresets] = useState<number[]>([0, 0, 0, 0]);

  // Tipos para los presets
  type BrownPreset = {
    label: string;
    filterFreq: number;
  };

  type RainPreset = {
    label: string;
    highpass: number;
    lowpass: number;
    reverbWet: number;
  };

  type OceanPreset = {
    label: string;
    pinkHigh: number;
    pinkLow: number;
    reverbWet: number;
    waveLfoFreq?: number;
  };

  type Preset = BrownPreset | RainPreset | OceanPreset;

  type PresetsMap = {
    brown: BrownPreset[];
    rain: RainPreset[];
    ocean: OceanPreset[];
  };

  const presetsMap: PresetsMap = {
    brown: [
      { label: "Default", filterFreq: 200 },
      { label: "Deep", filterFreq: 60 },
      { label: "Balanced", filterFreq: 200 },
      { label: "Bright", filterFreq: 400 },
    ],
    rain: [
      { label: "Default", highpass: 200, lowpass: 1500, reverbWet: 0.2 },
      { label: "Soft", highpass: 100, lowpass: 1000, reverbWet: 0.1 },
      { label: "Medium", highpass: 200, lowpass: 1500, reverbWet: 0.2 },
      { label: "Heavy", highpass: 300, lowpass: 2000, reverbWet: 0.4 },
    ],
    ocean: [
      {
        label: "Default",
        pinkHigh: 200,
        pinkLow: 1200,
        reverbWet: 0.4,
        waveLfoFreq: 0.1,
      },
      {
        label: "Calm",
        pinkHigh: 100,
        pinkLow: 800,
        reverbWet: 0.2,
        waveLfoFreq: 0.04,
      },
      {
        label: "Waves",
        pinkHigh: 200,
        pinkLow: 1200,
        reverbWet: 0.4,
        waveLfoFreq: 0.1,
      },
      {
        label: "Storm",
        pinkHigh: 400,
        pinkLow: 1800,
        reverbWet: 0.7,
        waveLfoFreq: 0.2,
      },
    ],
  };

  // Tipo para el soundRef basado en la clave del sonido
  type SoundRef = {
    filter?: { frequency: { value: number } };
    highpass?: { frequency: { value: number } };
    lowpass?: { frequency: { value: number } };
    reverb?: { wet: { value: number } };
    pinkHighpass?: { frequency: { value: number } };
    pinkLowpass?: { frequency: { value: number } };
    waveLFO?: { frequency: { value: number } };
  };

  const applyPreset = useCallback(
    (soundKey: keyof PresetsMap, soundRef: SoundRef | null | undefined, preset: Preset) => {
      if (!soundRef) return;
      
      if (soundKey === 'brown' && 'filterFreq' in preset) {
        if (soundRef.filter) {
          soundRef.filter.frequency.value = preset.filterFreq;
        }
      } else if (soundKey === 'rain' && 'highpass' in preset && 'lowpass' in preset) {
        if (soundRef.highpass) {
          soundRef.highpass.frequency.value = preset.highpass;
        }
        if (soundRef.lowpass) {
          soundRef.lowpass.frequency.value = preset.lowpass;
        }
        if (soundRef.reverb && 'reverbWet' in preset) {
          soundRef.reverb.wet.value = preset.reverbWet;
        }
      } else if (soundKey === 'ocean' && 'pinkHigh' in preset && 'pinkLow' in preset) {
        if (soundRef.pinkHighpass) {
          soundRef.pinkHighpass.frequency.value = preset.pinkHigh;
        }
        if (soundRef.pinkLowpass) {
          soundRef.pinkLowpass.frequency.value = preset.pinkLow;
        }
        if (soundRef.reverb) {
          soundRef.reverb.wet.value = preset.reverbWet;
        }
        if (soundRef.waveLFO && 'waveLfoFreq' in preset && preset.waveLfoFreq !== undefined) {
          soundRef.waveLFO.frequency.value = preset.waveLfoFreq;
        }
      }
    },
    []
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Noise Settings"
      maxWidth="max-w-lg"
    >
      <div className="space-y-4">
        {sounds.map((sound, idx) => {
          const theme = getSoundTheme(sound.key);
          const Icon =
            sound.icon === "Cloud"
              ? Cloud
              : sound.icon === "CloudRain"
              ? CloudRain
              : sound.icon === "Waves"
              ? Waves
              : Music;

          return (
            <div
              key={sound.key}
              className={`rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3.5 transition-all ${
                sound.isPlaying ? `ring-1 ${theme.activeRing}` : ""
              }`}
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${theme.iconBg}`}
                  >
                    <Icon size={16} className={theme.iconText} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-sm text-[var(--text-primary)] truncate">
                      {sound.label}
                    </h4>
                    <p className="text-[11px] text-[var(--text-secondary)] truncate">
                      {sound.key === "lofi"
                        ? "Streaming & local audio channels"
                        : "Max volume and acoustics presets"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <label className="text-xs text-[var(--text-secondary)]">
                    Max:
                  </label>
                  <input
                    type="number"
                    min={0.1}
                    max={5}
                    step={0.1}
                    value={sound.max}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value)) setMaxVolume(idx, value);
                    }}
                    className="w-16 px-2 py-1 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>

              {sound.key === "lofi" ? (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-secondary)]/60 border border-[var(--border-primary)] text-xs">
                  <div className="min-w-0">
                    <span className="font-medium text-[var(--text-primary)]">
                      {lofiState.type === "curated" && "Curated Lo-Fi Beats"}
                      {lofiState.type === "local" &&
                        (lofiState.localFileName
                          ? `Local: ${lofiState.localFileName}`
                          : "Local Audio File")}
                      {lofiState.type === "radio" && `Radio: ${lofiState.radioName}`}
                      {lofiState.type === "youtube" &&
                        `YouTube: ${lofiState.youtubeTitle}`}
                    </span>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 truncate">
                      Offline beats, local files, web radio, or YouTube
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenLofiModal();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 transition shrink-0 ml-2 shadow-sm text-xs"
                  >
                    Lo-Fi Sources
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {presetsMap[sound.key as keyof PresetsMap]?.map(
                    (preset: Preset, pIdx: number) => (
                      <button
                        key={preset.label}
                        type="button"
                        className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                          selectedPresets[idx] === pIdx
                            ? `${theme.iconBg} ${theme.iconText} ring-1 ${theme.activeRing}`
                            : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--border-primary)]"
                        }`}
                        onClick={() => {
                          applyPreset(
                            sound.key as keyof PresetsMap,
                            sound.soundRef,
                            preset
                          );
                          setSelectedPresets((sel) =>
                            sel.map((v, i) => (i === idx ? pIdx : v))
                          );
                        }}
                      >
                        {preset.label}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </BaseModal>
  );
}

// -------------------------
// NoiseGenerator main
// -------------------------
export default function NoiseGenerator() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLofiModalOpen, setIsLofiModalOpen] = useState(false);

  const {
    sounds,
    startSound,
    stopSound,
    setVolume,
    setMaxVolume,
    isInitialized,
    initializeAudio,
  } = useNoise();

  const [lofiState, setLofiState] = useState<LofiSourceState>(() =>
    LofiEngine.getInstance().getState()
  );

  const ytIframeRef = useRef<HTMLIFrameElement | null>(null);

  // Sync state with LofiEngine
  useEffect(() => {
    const engine = LofiEngine.getInstance();
    return engine.subscribe(setLofiState);
  }, []);

  // Register YouTube IFrame when source is youtube
  useEffect(() => {
    const engine = LofiEngine.getInstance();
    engine.registerYouTubeIframe(ytIframeRef.current);
  }, [lofiState.youtubeVideoId, lofiState.type]);

  // Check if any sound is playing
  const anySoundPlaying = sounds.some((sound) => sound.isPlaying);

  // Play/Pause all sounds
  const handlePlayPauseAll = useCallback(async () => {
    if (!isInitialized) await initializeAudio();

    if (anySoundPlaying) {
      // Pause all playing sounds
      sounds.forEach((_sound, idx) => {
        if (_sound.isPlaying) {
          stopSound(idx);
        }
      });
    } else {
      // Stagger starts so audio graphs aren't all built on the same frame
      sounds.forEach((_sound, idx) => {
        if (!_sound.isPlaying) {
          setTimeout(() => void startSound(idx).catch(console.error), idx * 120);
        }
      });
    }
  }, [anySoundPlaying, sounds, startSound, stopSound, isInitialized, initializeAudio]);

  const handleStart = useCallback(
    async (index: number) => {
      if (!isInitialized) await initializeAudio();
      startSound(index);
    },
    [isInitialized, initializeAudio, startSound]
  );

  // Animation variants
  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };
  const item = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
  };

  const lofiSound = sounds.find((s) => s.key === "lofi");
  const lofiIndex = sounds.findIndex((s) => s.key === "lofi");

  return (
    <div className="w-full h-full flex flex-col justify-between">
      {/* Hidden YouTube IFrame controller when YouTube source is selected */}
      {lofiState.type === "youtube" && lofiState.youtubeVideoId && (
        <div className="sr-only pointer-events-none" aria-hidden="true">
          <iframe
            ref={ytIframeRef}
            id="lofi-yt-background-player"
            title="YouTube Lo-Fi Background Audio"
            src={`https://www.youtube.com/embed/${lofiState.youtubeVideoId}?enablejsapi=1&origin=${typeof window !== "undefined" ? window.location.origin : ""}&autoplay=0`}
            allow="autoplay"
            tabIndex={-1}
            width="1"
            height="1"
          />
        </div>
      )}

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between pb-2"
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[var(--accent-primary)]/10">
            <Headphones size={17} className="text-[var(--accent-primary)]" />
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)] leading-tight">
            Noise Generator
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePlayPauseAll}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              anySoundPlaying
                ? "border-2 border-[var(--accent-primary)] text-[var(--accent-primary)] bg-transparent hover:bg-[var(--accent-primary)]/10 shadow-sm"
                : "bg-[var(--bg-secondary)] border-2 border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)]/50"
            }`}
            aria-label={anySoundPlaying ? "Pause all sounds" : "Play all sounds"}
          >
            {anySoundPlaying ? <Pause size={15} /> : <Play size={15} />}
            <span className="hidden sm:inline">
              {anySoundPlaying ? "Pause all" : "Play all"}
            </span>
          </button>

          <button
            className="p-1.5 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Noise generator settings"
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>
      </motion.div>

      {/* Sound controls (compact 4-row layout without stretching) */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex-1 flex flex-col gap-2 sm:gap-2.5 py-1"
      >
        {sounds.map((sound, idx) => {
          const isLofi = sound.key === "lofi";
          const lofiSublabel = isLofi
            ? lofiState.type === "local"
              ? lofiState.localFileName
                ? `Local · ${lofiState.localFileName}`
                : "Local File"
              : lofiState.type === "radio"
              ? `Radio · ${lofiState.radioName}`
              : lofiState.type === "youtube"
              ? `YouTube · ${lofiState.youtubeTitle}`
              : "Curated Beats"
            : undefined;

          const Icon =
            sound.icon === "Cloud"
              ? Cloud
              : sound.icon === "CloudRain"
              ? CloudRain
              : sound.icon === "Waves"
              ? Waves
              : Music;

          return (
            <motion.div key={sound.key} variants={item}>
              <SoundControl
                index={idx}
                soundKey={sound.key}
                label={sound.label}
                icon={Icon}
                volume={sound.volume}
                setVolume={(vol) => setVolume(idx, vol)}
                isPlaying={sound.isPlaying}
                start={() => handleStart(idx)}
                stop={() => stopSound(idx)}
                max={sound.max}
                sublabel={lofiSublabel}
                onOpenOptions={
                  isLofi ? () => setIsLofiModalOpen(true) : undefined
                }
              />
            </motion.div>
          );
        })}
      </motion.div>

      {/* Noise Settings Modal */}
      <NoiseSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        sounds={sounds}
        setMaxVolume={setMaxVolume}
        onOpenLofiModal={() => setIsLofiModalOpen(true)}
        lofiState={lofiState}
      />

      {/* Dedicated Lo-Fi Options Popup Modal */}
      <LofiOptionsModal
        isOpen={isLofiModalOpen}
        onClose={() => setIsLofiModalOpen(false)}
        isPlaying={Boolean(lofiSound?.isPlaying)}
        onTogglePlay={() => {
          if (lofiIndex !== -1) {
            if (lofiSound?.isPlaying) {
              stopSound(lofiIndex);
            } else {
              handleStart(lofiIndex);
            }
          }
        }}
        volume={lofiSound?.volume ?? 0.7}
        onVolumeChange={(vol) => {
          if (lofiIndex !== -1) {
            setVolume(lofiIndex, vol);
          }
        }}
      />
    </div>
  );
}
