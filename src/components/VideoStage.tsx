import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Layers,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { SubtitleCue, SubtitleStyle, VideoInfo } from '../types/subtitle';
import { formatTimecodeShort } from '../utils/subtitleFormats';

interface VideoStageProps {
  videoInfo: VideoInfo;
  videoRef: RefObject<HTMLVideoElement | null>;
  cues: SubtitleCue[];
  style: SubtitleStyle;
  currentTime: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeek: (timeSec: number) => void;
  onChangeVideoClick: () => void;
  onLoadedMetadata: (durationSec: number, width: number, height: number) => void;
  onSelectCue?: (cueId: string) => void;
}

function hexToRgba(hex: string, opacityPct: number): string {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  const a = Math.max(0, Math.min(1, opacityPct / 100));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function VideoStage({
  videoInfo,
  videoRef,
  cues,
  style,
  currentTime,
  isPlaying,
  onTogglePlay,
  onSeek,
  onChangeVideoClick,
  onLoadedMetadata,
  onSelectCue,
}: VideoStageProps) {
  const stageBoxRef = useRef<HTMLDivElement>(null);
  const [stageHeight, setStageHeight] = useState(400);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSafeZone, setShowSafeZone] = useState(false);

  useEffect(() => {
    const el = stageBoxRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.height > 0) {
          setStageHeight(entry.contentRect.height);
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const activeCueIndex = useMemo(
    () =>
      cues.findIndex(
        (cue) => currentTime >= cue.startSec && currentTime <= cue.endSec,
      ),
    [cues, currentTime],
  );

  const activeCue = activeCueIndex >= 0 ? cues[activeCueIndex] : null;

  const prevCue = useMemo(() => {
    if (cues.length === 0) return null;
    if (activeCueIndex > 0) return cues[activeCueIndex - 1];
    const earlier = cues.filter((c) => c.startSec < currentTime - 0.15);
    return earlier.length > 0 ? earlier[earlier.length - 1] : cues[0];
  }, [activeCueIndex, cues, currentTime]);

  const nextCue = useMemo(() => {
    if (cues.length === 0) return null;
    if (activeCueIndex >= 0 && activeCueIndex < cues.length - 1) {
      return cues[activeCueIndex + 1];
    }
    const later = cues.find((c) => c.startSec > currentTime + 0.15);
    return later || cues[cues.length - 1];
  }, [activeCueIndex, cues, currentTime]);

  // Match 1080p baseline proportions accurately inside the preview monitor
  const scale = stageHeight / 1080;
  const enPx = Math.max(10, Math.round(style.enSize * scale * 10) / 10);
  const viPx = Math.max(10, Math.round(style.viSize * scale * 10) / 10);
  const gapPx = Math.max(1, Math.round(style.lineGap * scale * 10) / 10);
  const textShadowCss = style.bgEnabled
    ? 'none'
    : [
        style.outlineWidth > 0
          ? `0 0 ${Math.max(1, style.outlineWidth * scale * 1.4)}px rgba(0,0,0,0.95), 0 1px ${Math.max(1, style.outlineWidth * scale * 1.6)}px rgba(0,0,0,0.95)`
          : '',
        style.shadowDepth > 0
          ? `0 ${Math.max(1, style.shadowDepth * scale * 1.5)}px ${Math.max(2, style.shadowDepth * scale * 2.5)}px rgba(0,0,0,0.85)`
          : '',
      ]
        .filter(Boolean)
        .join(', ');

  const handleToggleMute = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = !vid.muted;
    setIsMuted(vid.muted);
  };

  const handleRateChange = (nextRate: number) => {
    setPlaybackRate(nextRate);
    if (videoRef.current) {
      videoRef.current.playbackRate = nextRate;
    }
  };

  const speakerPrefix =
    style.showSpeaker && activeCue?.speaker ? `[${activeCue.speaker}] ` : '';

  const renderOverlayLines = () => {
    if (!activeCue) return null;
    const enLine = activeCue.en.trim();
    const viLine = activeCue.vi.trim();

    if (style.languageOrder === 'en-only') {
      if (!enLine) return null;
      return (
        <div
          style={{
            fontSize: `${enPx}px`,
            color: style.enColor,
            fontWeight: style.enBold ? 700 : 500,
            textShadow: textShadowCss,
            lineHeight: 1.32,
          }}
        >
          {speakerPrefix}
          {enLine}
        </div>
      );
    }

    if (style.languageOrder === 'vi-only') {
      if (!viLine) return null;
      return (
        <div
          style={{
            fontSize: `${viPx}px`,
            color: style.viColor,
            fontWeight: style.viBold ? 700 : 500,
            textShadow: textShadowCss,
            lineHeight: 1.32,
          }}
        >
          {speakerPrefix}
          {viLine}
        </div>
      );
    }

    const enNode = enLine ? (
      <div
        key="en"
        style={{
          fontSize: `${enPx}px`,
          color: style.enColor,
          fontWeight: style.enBold ? 700 : 500,
          textShadow: textShadowCss,
          lineHeight: 1.32,
        }}
      >
        {style.languageOrder === 'en-top' ? speakerPrefix : ''}
        {enLine}
      </div>
    ) : null;

    const viNode = viLine ? (
      <div
        key="vi"
        style={{
          fontSize: `${viPx}px`,
          color: style.viColor,
          fontWeight: style.viBold ? 700 : 500,
          textShadow: textShadowCss,
          lineHeight: 1.32,
        }}
      >
        {style.languageOrder === 'vi-top' ? speakerPrefix : ''}
        {viLine}
      </div>
    ) : null;

    const items =
      style.languageOrder === 'vi-top' ? [viNode, enNode] : [enNode, viNode];

    return (
      <div className="flex flex-col items-center" style={{ gap: `${gapPx}px` }}>
        {items}
      </div>
    );
  };

  const duration = Math.max(0.1, videoInfo.durationSec || 1);

  return (
    <section
      aria-label="Trình phát video và xem trước phụ đề"
      className="flex flex-col border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]"
    >
      {/* File Metadata & Monitor Controls */}
      <div className="px-3 sm:px-4 py-2 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] min-w-0 max-w-full">
          <span className="font-semibold text-[var(--text-primary)] truncate max-w-[150px] sm:max-w-[240px]">
            {videoInfo.fileName}
          </span>
          <span className="hidden sm:inline text-[var(--text-muted)]" aria-hidden="true">
            ·
          </span>
          <span className="hidden sm:inline font-mono tabular-nums whitespace-nowrap">
            {videoInfo.width}×{videoInfo.height}
          </span>
          <span className="text-[var(--text-muted)]" aria-hidden="true">
            ·
          </span>
          <span className="font-mono tabular-nums whitespace-nowrap">
            {formatTimecodeShort(videoInfo.durationSec)}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowSafeZone((v) => !v)}
            aria-pressed={showSafeZone}
            className={`inline-flex items-center gap-1.5 px-2.5 min-h-[36px] md:min-h-[30px] rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer border ${
              showSafeZone
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
            <span>Khung an toàn</span>
          </button>

          <button
            type="button"
            onClick={onChangeVideoClick}
            className="inline-flex items-center gap-1.5 px-2.5 min-h-[36px] md:min-h-[30px] rounded-md text-xs font-medium border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
            <span>Đổi video</span>
          </button>
        </div>
      </div>

      {/* Independent Dark Video Monitor (Always dark regardless of UI theme) */}
      <div className="relative flex items-center justify-center bg-[#08090B] px-3 sm:px-4 py-3 min-h-[210px] sm:min-h-[280px] lg:min-h-[350px]">
        <div
          ref={stageBoxRef}
          className="relative max-h-[38vh] sm:max-h-[44vh] w-auto max-w-full flex items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black"
          style={{
            aspectRatio: `${videoInfo.width || 16} / ${videoInfo.height || 9}`,
          }}
        >
          <video
            ref={videoRef}
            src={videoInfo.objectUrl}
            playsInline
            preload="metadata"
            onClick={onTogglePlay}
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              if (currentTime > 0 && Math.abs(v.currentTime - currentTime) > 0.05) {
                v.currentTime = currentTime;
              }
              onLoadedMetadata(
                v.duration || videoInfo.durationSec,
                v.videoWidth || videoInfo.width,
                v.videoHeight || videoInfo.height,
              );
            }}
            className="w-full h-full object-contain cursor-pointer"
          />

          {/* Safe zone overlay */}
          {showSafeZone && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-[5%] border border-dashed border-[#A9E34B]/55 rounded-sm"
            >
              <div className="absolute inset-x-0 bottom-[10%] border-t border-dotted border-white/40" />
            </div>
          )}

          {/* Live Bilingual Subtitle Overlay (Theme-independent WYSIWYG) */}
          {activeCue && (
            <div
              data-testid="live-subtitle-overlay"
              className="pointer-events-none absolute inset-x-[4%] flex justify-center text-center"
              style={
                style.alignment === 'top'
                  ? { top: `${style.marginBottomPct}%` }
                  : { bottom: `${style.marginBottomPct}%` }
              }
            >
              <div
                className="max-w-full px-3 py-1.5 rounded-md"
                style={{
                  fontFamily: `"Noto Sans", "Manrope", sans-serif`,
                  backgroundColor: style.bgEnabled
                    ? hexToRgba(style.bgColor, style.bgOpacity)
                    : 'transparent',
                }}
              >
                {renderOverlayLines()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transport Bar */}
      <div className="px-3 sm:px-4 py-2 bg-[var(--bg-secondary)] border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSeek(Math.max(0, currentTime - 0.1))}
            aria-label="Lùi 0.1 giây"
            title="Lùi 0.1 giây"
            className="min-w-[44px] min-h-[44px] md:min-w-[34px] md:min-h-[34px] inline-flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
          >
            <SkipBack className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Tạm dừng' : 'Phát video'}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 min-h-[44px] md:min-h-[34px] rounded-lg bg-[var(--text-primary)] text-[var(--bg-main)] hover:opacity-90 text-xs font-bold transition-opacity cursor-pointer whitespace-nowrap shrink-0"
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
            ) : (
              <Play className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
            )}
            <span>{isPlaying ? 'Tạm dừng' : 'Phát'}</span>
          </button>

          <button
            type="button"
            onClick={() => onSeek(Math.min(duration, currentTime + 0.1))}
            aria-label="Tiến 0.1 giây"
            title="Tiến 0.1 giây"
            className="min-w-[44px] min-h-[44px] md:min-w-[34px] md:min-h-[34px] inline-flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
          >
            <SkipForward className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
          </button>

          <div className="ml-1.5 text-xs font-mono tabular-nums text-[var(--text-primary)] whitespace-nowrap">
            <span>{formatTimecodeShort(currentTime)}</span>
            <span className="text-[var(--text-muted)] mx-1">/</span>
            <span className="text-[var(--text-secondary)]">{formatTimecodeShort(duration)}</span>
          </div>
        </div>

        {/* Scrubber */}
        <div className="order-3 md:order-2 w-full md:w-auto md:flex-1 md:max-w-md flex items-center py-1 md:py-0">
          <input
            type="range"
            aria-label="Thanh tua video"
            min={0}
            max={duration}
            step={0.05}
            value={Math.min(currentTime, duration)}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="w-full accent-[var(--accent)] cursor-pointer h-2 md:h-1.5 bg-[var(--border-subtle)] rounded-lg"
          />
        </div>

        <div className="order-2 md:order-3 flex items-center gap-1.5">
          <select
            aria-label="Tốc độ phát"
            value={playbackRate}
            onChange={(e) => handleRateChange(Number(e.target.value))}
            className="min-h-[40px] md:min-h-[32px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg px-2 py-1 text-xs font-mono tabular-nums text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] cursor-pointer"
          >
            <option value={0.5}>0.5x</option>
            <option value={0.75}>0.75x</option>
            <option value={1}>1.0x</option>
            <option value={1.25}>1.25x</option>
            <option value={1.5}>1.5x</option>
          </select>

          <button
            type="button"
            onClick={handleToggleMute}
            aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            className="min-w-[44px] min-h-[44px] md:min-w-[34px] md:min-h-[34px] inline-flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Volume2 className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Active Cue Quick-Step Strip */}
      {cues.length > 0 && (
        <div className="md:hidden px-3 py-2 border-t border-[var(--border-subtle)] bg-[var(--bg-main)] flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={!prevCue}
            onClick={() => {
              if (!prevCue) return;
              onSeek(prevCue.startSec);
              onSelectCue?.(prevCue.id);
            }}
            aria-label="Nhảy tới câu trước"
            className="min-h-[44px] px-3 inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-medium text-[var(--text-primary)] disabled:opacity-40 cursor-pointer whitespace-nowrap"
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
            <span>Câu trước</span>
          </button>

          <div className="min-w-0 flex-1 text-center px-1">
            <div className="text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
              {activeCueIndex >= 0
                ? `Câu #${activeCueIndex + 1} / ${cues.length}`
                : `${cues.length} câu phụ đề`}
            </div>
            <div className="text-xs font-medium text-[var(--text-primary)] truncate">
              {activeCue ? activeCue.vi || activeCue.en : 'Chưa có câu tại mốc này'}
            </div>
          </div>

          <button
            type="button"
            disabled={!nextCue}
            onClick={() => {
              if (!nextCue) return;
              onSeek(nextCue.startSec);
              onSelectCue?.(nextCue.id);
            }}
            aria-label="Nhảy tới câu sau"
            className="min-h-[44px] px-3 inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-medium text-[var(--text-primary)] disabled:opacity-40 cursor-pointer whitespace-nowrap"
          >
            <span>Câu sau</span>
            <ChevronRight className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}
