import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Clock, Plus, Scissors, ZoomIn, ZoomOut } from 'lucide-react';
import type { SubtitleCue } from '../types/subtitle';
import { formatTimecodeShort } from '../utils/subtitleFormats';
import { ensureGsapRegistered, gsap, prefersReducedMotion } from '../utils/motion';

interface TimelineStripProps {
  durationSec: number;
  currentTime: number;
  cues: SubtitleCue[];
  selectedCueId: string | null;
  onSeek: (timeSec: number) => void;
  onSelectCue: (cueId: string) => void;
  onAddCueAtTime: (timeSec: number) => void;
  onSplitActiveCue: () => void;
  onShiftAllCues: (deltaSec: number) => void;
  canSplitActiveCue: boolean;
}

export function TimelineStrip({
  durationSec,
  currentTime,
  cues,
  selectedCueId,
  onSeek,
  onSelectCue,
  onAddCueAtTime,
  onSplitActiveCue,
  onShiftAllCues,
  canSplitActiveCue,
}: TimelineStripProps) {
  const [zoom, setZoom] = useState(1);
  const [showShiftBar, setShowShiftBar] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const shiftBarRef = useRef<HTMLDivElement>(null);

  const safeDuration = Math.max(1, durationSec || 12);

  useEffect(() => {
    if (!showShiftBar || !shiftBarRef.current) return;
    ensureGsapRegistered();
    if (prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        shiftBarRef.current,
        { opacity: 0, y: -4 },
        { opacity: 1, y: 0, duration: 0.18, ease: 'power2.out', clearProps: 'transform' },
      );
    });
    return () => ctx.revert();
  }, [showShiftBar]);

  const ticks = useMemo(() => {
    const step = safeDuration / zoom > 60 ? 10 : safeDuration / zoom > 20 ? 5 : 2;
    const items: number[] = [];
    for (let t = 0; t <= safeDuration; t += step) {
      items.push(Math.round(t * 10) / 10);
    }
    return items;
  }, [safeDuration, zoom]);

  const handleTrackClick = (e: MouseEvent<HTMLDivElement>) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(ratio * safeDuration);
  };

  const playheadPct = Math.max(0, Math.min(100, (currentTime / safeDuration) * 100));

  return (
    <section
      aria-label="Thanh thời gian phụ đề"
      className="flex-1 md:min-h-[175px] flex flex-col bg-[var(--bg-main)]"
    >
      {/* Timeline Utility Toolbar */}
      <div className="px-3 sm:px-4 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onAddCueAtTime(currentTime)}
            className="inline-flex items-center gap-1.5 px-3 min-h-[44px] md:min-h-[32px] rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-xs font-semibold text-[var(--text-primary)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5 text-[var(--accent)]" strokeWidth={2} aria-hidden="true" />
            <span>Thêm câu tại đây</span>
          </button>

          <button
            type="button"
            onClick={onSplitActiveCue}
            disabled={!canSplitActiveCue}
            title="Cắt câu phụ đề đang phát tại vị trí kim thời gian (S)"
            className="inline-flex items-center gap-1.5 px-3 min-h-[44px] md:min-h-[32px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Scissors className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
            <span>Cắt đôi câu</span>
          </button>

          <button
            type="button"
            onClick={() => setShowShiftBar((v) => !v)}
            aria-expanded={showShiftBar}
            className={`inline-flex items-center gap-1.5 px-3 min-h-[44px] md:min-h-[32px] rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              showShiftBar
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
            <span>Dịch chuyển thời gian</span>
          </button>
        </div>

        {/* Zoom controls (desktop timeline) */}
        <div className="hidden md:flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(1, Math.round((z - 0.5) * 10) / 10))}
            aria-label="Thu nhỏ timeline"
            className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
          </button>
          <span className="text-xs font-mono tabular-nums text-[var(--text-secondary)] w-9 text-center">
            {zoom.toFixed(1)}x
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(4, Math.round((z + 0.5) * 10) / 10))}
            aria-label="Phóng to timeline"
            className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Batch Shift Bar */}
      {showShiftBar && (
        <div
          ref={shiftBarRef}
          className="px-3 sm:px-4 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-wrap items-center gap-2 text-xs"
        >
          <span className="text-[var(--text-secondary)]">Dịch toàn bộ phụ đề:</span>
          {[-0.5, -0.1, 0.1, 0.5].map((delta) => (
            <button
              key={delta}
              type="button"
              onClick={() => onShiftAllCues(delta)}
              className="px-3 min-h-[38px] md:min-h-[28px] rounded-md border border-[var(--border-strong)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] font-mono tabular-nums cursor-pointer whitespace-nowrap"
            >
              {delta > 0 ? `+${delta}s` : `${delta}s`}
            </button>
          ))}
        </div>
      )}

      {/* Mobile Touch Cue Timeline Rail (< md) */}
      <div className="md:hidden px-3 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-main)]">
        {cues.length === 0 ? (
          <div className="text-xs text-[var(--text-muted)] py-2">
            Chưa có câu phụ đề trên dòng thời gian.
          </div>
        ) : (
          <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
            {cues.map((cue, idx) => {
              const isSelected = cue.id === selectedCueId;
              const isActive =
                currentTime >= cue.startSec && currentTime <= cue.endSec;
              return (
                <button
                  key={cue.id}
                  type="button"
                  onClick={() => {
                    onSelectCue(cue.id);
                    onSeek(cue.startSec);
                  }}
                  className={`shrink-0 w-[168px] min-h-[54px] rounded-lg border px-2.5 py-2 text-left transition-colors cursor-pointer ${
                    isActive
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                      : isSelected
                        ? 'border-[var(--border-strong)] bg-[var(--bg-elevated)]'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-[var(--text-muted)]">
                    <span>#{idx + 1}</span>
                    <span>
                      {formatTimecodeShort(cue.startSec)}–{formatTimecodeShort(cue.endSec)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs font-medium text-[var(--text-primary)] truncate">
                    {cue.vi || cue.en || '(Trống)'}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Desktop Precision Timeline Track (>= md) */}
      <div className="hidden md:block flex-1 overflow-x-auto overflow-y-hidden px-4 py-3">
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          data-testid="timeline-track"
          className="relative h-full min-h-[112px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] cursor-crosshair select-none"
          style={{ width: `${zoom * 100}%`, minWidth: '100%' }}
        >
          {/* Time Ruler */}
          <div className="h-6 border-b border-[var(--border-subtle)] relative bg-[var(--bg-surface)] overflow-hidden rounded-t-lg">
            {ticks.map((tick) => {
              const leftPct = (tick / safeDuration) * 100;
              if (leftPct > 94) {
                return null;
              }
              return (
                <div
                  key={tick}
                  className="absolute top-0 bottom-0 flex flex-col justify-between pl-1.5 border-l border-[var(--border-subtle)]"
                  style={{ left: `${leftPct}%` }}
                >
                  <span className="text-[10px] font-mono tabular-nums text-[var(--text-muted)] leading-none pt-1.5 whitespace-nowrap">
                    {formatTimecodeShort(tick)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Cue Track */}
          <div className="relative h-[80px] mt-1">
            {cues.map((cue, idx) => {
              const leftPct = Math.max(0, (cue.startSec / safeDuration) * 100);
              const widthPct = Math.max(
                0.8,
                ((cue.endSec - cue.startSec) / safeDuration) * 100,
              );
              const isSelected = cue.id === selectedCueId;
              const isActive =
                currentTime >= cue.startSec && currentTime <= cue.endSec;

              return (
                <button
                  key={cue.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectCue(cue.id);
                    onSeek(cue.startSec);
                  }}
                  title={`#${idx + 1}: ${cue.en} / ${cue.vi}`}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  className={`absolute top-2 bottom-2 rounded-md border px-2 py-1 text-left overflow-hidden transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--text-primary)]'
                      : isSelected
                        ? 'bg-[var(--bg-elevated)] border-[var(--border-strong)] text-[var(--text-primary)]'
                        : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <div className="text-[11px] font-medium truncate leading-tight text-[var(--text-primary)]">
                    {cue.en || '(Chưa có EN)'}
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)] truncate leading-tight mt-0.5">
                    {cue.vi || '(Chưa có VI)'}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Playhead */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-[var(--accent)] z-10"
            style={{ left: `${playheadPct}%` }}
          >
            <div className="w-2.5 h-2.5 -ml-[4px] -mt-0.5 bg-[var(--accent)] rounded-[2px] rotate-45" />
          </div>
        </div>
      </div>
    </section>
  );
}
