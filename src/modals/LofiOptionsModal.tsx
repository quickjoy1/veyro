import {
  Check,
  Disc3,
  FileAudio,
  FolderUp,
  Globe,
  Headphones,
  Music,
  Pause,
  Play,
  Radio,
  Tv,
  Volume2,
  Youtube,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import BaseModal from "@/modals/BaseModal";
import {
  CURATED_TRACKS,
  CURATED_WEB_RADIOS,
  CURATED_YOUTUBE_STREAMS,
  LofiEngine,
  LofiSourceState,
  LofiSourceType,
  extractYouTubeVideoId,
} from "@/utils/LofiEngine";

interface LofiOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  volume: number;
  onVolumeChange: (vol: number) => void;
}

export default function LofiOptionsModal({
  isOpen,
  onClose,
  isPlaying,
  onTogglePlay,
  volume,
  onVolumeChange,
}: LofiOptionsModalProps) {
  const engine = LofiEngine.getInstance();
  const [sourceState, setSourceState] = useState<LofiSourceState>(() =>
    engine.getState()
  );
  const [activeTab, setActiveTab] = useState<LofiSourceType>(
    sourceState.type || "curated"
  );

  // Custom inputs
  const [customRadioUrl, setCustomRadioUrl] = useState(sourceState.radioUrl);
  const [customRadioName, setCustomRadioName] = useState(sourceState.radioName);
  const [customYtInput, setCustomYtInput] = useState(
    sourceState.youtubeVideoId
  );
  const [showYtPreview, setShowYtPreview] = useState(false);
  const [ytError, setYtError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync state changes from engine
  useEffect(() => {
    return engine.subscribe((newState) => {
      setSourceState(newState);
      setActiveTab(newState.type);
    });
  }, [engine]);

  // Handle local file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      engine.loadLocalFile(file);
      if (!isPlaying) {
        onTogglePlay();
      }
    }
  };

  // Select a curated track
  const handleSelectCuratedTrack = (trackId: string) => {
    engine.setSource({
      type: "curated",
      curatedId: trackId,
    });
    if (!isPlaying) {
      onTogglePlay();
    }
  };

  // Select a curated radio station
  const handleSelectRadio = (url: string, name: string) => {
    setCustomRadioUrl(url);
    setCustomRadioName(name);
    engine.setSource({
      type: "radio",
      radioUrl: url,
      radioName: name,
    });
    if (!isPlaying) {
      onTogglePlay();
    }
  };

  // Apply custom radio URL
  const handleApplyCustomRadio = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customRadioUrl.trim()) return;
    const name = customRadioName.trim() || "Custom Web Stream";
    engine.setSource({
      type: "radio",
      radioUrl: customRadioUrl.trim(),
      radioName: name,
    });
    if (!isPlaying) {
      onTogglePlay();
    }
  };

  // Select a curated YouTube stream
  const handleSelectYouTube = (videoId: string, title: string) => {
    setCustomYtInput(videoId);
    setYtError("");
    engine.setSource({
      type: "youtube",
      youtubeVideoId: videoId,
      youtubeTitle: title,
    });
    if (!isPlaying) {
      onTogglePlay();
    }
  };

  // Apply custom YouTube URL/ID
  const handleApplyCustomYouTube = (e: React.FormEvent) => {
    e.preventDefault();
    const id = extractYouTubeVideoId(customYtInput);
    if (!id) {
      setYtError("Invalid YouTube URL or Video ID");
      return;
    }
    setYtError("");
    engine.setSource({
      type: "youtube",
      youtubeVideoId: id,
      youtubeTitle: `YouTube Stream (${id})`,
    });
    if (!isPlaying) {
      onTogglePlay();
    }
  };

  // Tab definitions
  const tabs = [
    { id: "curated" as const, label: "Curated Beats", icon: Headphones },
    { id: "local" as const, label: "Local File", icon: FileAudio },
    { id: "radio" as const, label: "Web Radio", icon: Radio },
    { id: "youtube" as const, label: "YouTube Live", icon: Youtube },
  ];

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Lo-Fi Music Options"
      maxWidth="max-w-2xl"
    >
      <div className="flex flex-col gap-4">
        {/* Source Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)] overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isTabActive = activeTab === tab.id;
            const isSourceActive = sourceState.type === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap shrink-0 ${
                  isTabActive
                    ? "bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                {isSourceActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab 1: Curated Lo-Fi Tracks */}
        {activeTab === "curated" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span>Offline-ready procedural jazzhop and lo-fi chord cycles</span>
              <span>{CURATED_TRACKS.length} styles available</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {CURATED_TRACKS.map((track) => {
                const isSelected =
                  sourceState.type === "curated" &&
                  sourceState.curatedId === track.id;

                return (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => handleSelectCuratedTrack(track.id)}
                    className={`flex flex-col text-left p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? "border-purple-500/50 bg-purple-500/10 ring-1 ring-purple-500/30"
                        : "border-[var(--border-primary)] bg-[var(--bg-secondary)]/40 hover:bg-[var(--bg-secondary)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <Disc3
                          size={16}
                          className={
                            isSelected
                              ? "text-purple-500 animate-spin"
                              : "text-[var(--text-secondary)]"
                          }
                          style={{
                            animationDuration: "4s",
                          }}
                        />
                        <span className="font-semibold text-sm text-[var(--text-primary)]">
                          {track.name}
                        </span>
                      </div>
                      {isSelected && (
                        <span className="flex items-center justify-center h-5 w-5 rounded-full bg-purple-500 text-white text-xs">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                      {track.description}
                    </p>
                    <div className="mt-2 text-[11px] text-[var(--text-secondary)] flex items-center gap-2">
                      <span>{track.genre}</span>
                      <span aria-hidden="true">·</span>
                      <span>{track.tempo} BPM</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Local Audio File Upload */}
        {activeTab === "local" && (
          <div className="flex flex-col gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac"
              onChange={handleFileChange}
              className="hidden"
            />

            {sourceState.localFileName ? (
              <div className="p-4 rounded-xl border border-purple-500/40 bg-purple-500/10 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20 text-purple-600 dark:text-purple-400">
                      <FileAudio size={20} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-[var(--text-primary)] truncate max-w-[280px] sm:max-w-md">
                        {sourceState.localFileName}
                      </h4>
                      <div className="text-xs text-[var(--text-secondary)] flex items-center gap-2">
                        <span>Local Audio File</span>
                        {sourceState.localFileSize && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{sourceState.localFileSize}</span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="text-purple-600 dark:text-purple-400 font-medium">
                          Active Source
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-purple-500/20">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] hover:border-purple-500/40 transition-colors"
                  >
                    Select Different File
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2.5 p-8 rounded-2xl border-2 border-dashed border-[var(--border-primary)] hover:border-purple-500/50 bg-[var(--bg-secondary)]/30 hover:bg-purple-500/5 transition-all text-center group cursor-pointer"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                  <FolderUp size={24} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-[var(--text-primary)]">
                    Choose local audio file from device
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Supports MP3, WAV, FLAC, M4A, AAC, and OGG
                  </p>
                </div>
              </button>
            )}

            <p className="text-xs text-[var(--text-secondary)]">
              Your audio remains private on your local device and loops seamlessly during study sessions.
            </p>
          </div>
        )}

        {/* Tab 3: Web Radio Live Streams */}
        {activeTab === "radio" && (
          <div className="flex flex-col gap-3">
            <div className="text-xs text-[var(--text-secondary)]">
              24/7 online ambient & lo-fi internet radio stations
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {CURATED_WEB_RADIOS.map((station) => {
                const isSelected =
                  sourceState.type === "radio" &&
                  sourceState.radioUrl === station.url;

                return (
                  <button
                    key={station.id}
                    type="button"
                    onClick={() => handleSelectRadio(station.url, station.name)}
                    className={`flex flex-col text-left p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? "border-purple-500/50 bg-purple-500/10 ring-1 ring-purple-500/30"
                        : "border-[var(--border-primary)] bg-[var(--bg-secondary)]/40 hover:bg-[var(--bg-secondary)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <Radio
                          size={16}
                          className={
                            isSelected
                              ? "text-purple-500"
                              : "text-[var(--text-secondary)]"
                          }
                        />
                        <span className="font-semibold text-sm text-[var(--text-primary)]">
                          {station.name}
                        </span>
                      </div>
                      {isSelected && (
                        <span className="flex items-center justify-center h-5 w-5 rounded-full bg-purple-500 text-white text-xs">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {station.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Custom Stream URL Input */}
            <form
              onSubmit={handleApplyCustomRadio}
              className="mt-1 p-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]/30 flex flex-col gap-2.5"
            >
              <div className="flex items-center gap-2">
                <Globe size={15} className="text-[var(--text-secondary)]" />
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  Custom Audio Stream URL
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Station Name (optional)"
                  value={customRadioName}
                  onChange={(e) => setCustomRadioName(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
                <input
                  type="url"
                  placeholder="https://example.com/stream.mp3"
                  value={customRadioUrl}
                  onChange={(e) => setCustomRadioUrl(e.target.value)}
                  className="sm:col-span-2 px-3 py-1.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                >
                  Set Custom Radio
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 4: YouTube Live Streams */}
        {activeTab === "youtube" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span>Popular 24/7 Lo-Fi study live streams</span>
              <button
                type="button"
                onClick={() => setShowYtPreview((v) => !v)}
                className="text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 font-medium"
              >
                <Tv size={14} />
                <span>{showYtPreview ? "Hide Preview" : "Show Video Preview"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {CURATED_YOUTUBE_STREAMS.map((stream) => {
                const isSelected =
                  sourceState.type === "youtube" &&
                  sourceState.youtubeVideoId === stream.videoId;

                return (
                  <button
                    key={stream.id}
                    type="button"
                    onClick={() =>
                      handleSelectYouTube(stream.videoId, stream.name)
                    }
                    className={`flex flex-col text-left p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? "border-purple-500/50 bg-purple-500/10 ring-1 ring-purple-500/30"
                        : "border-[var(--border-primary)] bg-[var(--bg-secondary)]/40 hover:bg-[var(--bg-secondary)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <Youtube
                          size={16}
                          className={
                            isSelected
                              ? "text-red-500"
                              : "text-[var(--text-secondary)]"
                          }
                        />
                        <span className="font-semibold text-sm text-[var(--text-primary)]">
                          {stream.name}
                        </span>
                      </div>
                      {isSelected && (
                        <span className="flex items-center justify-center h-5 w-5 rounded-full bg-purple-500 text-white text-xs">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {stream.description}
                    </p>
                    <div className="mt-2 text-[11px] text-[var(--text-secondary)]">
                      <span>{stream.channel}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom YouTube Stream URL/ID */}
            <form
              onSubmit={handleApplyCustomYouTube}
              className="mt-1 p-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]/30 flex flex-col gap-2.5"
            >
              <div className="flex items-center gap-2">
                <Youtube size={15} className="text-red-500" />
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  Custom YouTube Stream URL or Video ID
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. https://www.youtube.com/watch?v=... or Video ID"
                  value={customYtInput}
                  onChange={(e) => setCustomYtInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors whitespace-nowrap"
                >
                  Set Video ID
                </button>
              </div>
              {ytError && <p className="text-xs text-red-500">{ytError}</p>}
            </form>

            {/* Video preview iframe */}
            {showYtPreview && sourceState.youtubeVideoId && (
              <div className="aspect-video w-full rounded-xl overflow-hidden border border-[var(--border-primary)] bg-black shadow-md mt-1">
                <iframe
                  title="YouTube Lo-Fi Live Preview"
                  src={`https://www.youtube.com/embed/${sourceState.youtubeVideoId}?enablejsapi=1&autoplay=0`}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
          </div>
        )}

        {/* Modal Footer: Current Source Status + Playback Controls */}
        <div className="flex items-center justify-between pt-3 border-t border-[var(--border-primary)]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
              <Music size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                {sourceState.type === "curated" &&
                  `Curated: ${CURATED_TRACKS.find((t) => t.id === sourceState.curatedId)?.name || "Chill Study Hop"}`}
                {sourceState.type === "local" &&
                  (sourceState.localFileName
                    ? `Local File: ${sourceState.localFileName}`
                    : "Local File (Not Selected)")}
                {sourceState.type === "radio" &&
                  `Radio: ${sourceState.radioName}`}
                {sourceState.type === "youtube" &&
                  `YouTube: ${sourceState.youtubeTitle}`}
              </p>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {isPlaying ? "Currently Playing" : "Paused"} · Volume:{" "}
                {Math.round(volume * 100)}%
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-2">
              <Volume2 size={16} className="text-[var(--text-secondary)]" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="w-20 accent-purple-500 h-1.5 cursor-pointer"
                aria-label="Lo-Fi Volume"
              />
            </div>

            <button
              type="button"
              onClick={onTogglePlay}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                isPlaying
                  ? "bg-purple-600 text-white shadow-md hover:bg-purple-700"
                  : "bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] hover:border-purple-500/40"
              }`}
            >
              {isPlaying ? <Pause size={15} /> : <Play size={15} />}
              <span>{isPlaying ? "Pause" : "Play"}</span>
            </button>
          </div>
        </div>
      </div>
    </BaseModal>
  );
}
