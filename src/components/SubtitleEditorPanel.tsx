import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  AlertTriangle,
  ArrowDownUp,
  AudioLines,
  Languages,
  Merge,
  Plus,
  Search,
  Trash2,
  Upload,
  Wrench,
} from 'lucide-react';
import type { CueIssue, SubtitleCue, TranslationTone } from '../types/subtitle';
import {
  clampSeconds,
  formatTimecodeShort,
  parseTimecodeToSec,
} from '../utils/subtitleFormats';

interface SubtitleEditorPanelProps {
  cues: SubtitleCue[];
  issues: CueIssue[];
  selectedCueId: string | null;
  currentTime: number;
  hasAudio: boolean;
  tone: TranslationTone;
  contextHint: string;
  isTranscribing: boolean;
  isTranslating: boolean;
  aiError: string | null;
  onToneChange: (tone: TranslationTone) => void;
  onContextHintChange: (hint: string) => void;
  onRunAiTranscribe: () => void;
  onRunAiRetranslate: (direction: 'en-to-vi' | 'vi-to-en' | 'polish-both') => void;
  onImportSubtitleFile: (file: File) => void;
  onSelectCue: (cueId: string) => void;
  onSeek: (timeSec: number) => void;
  onUpdateCue: (cueId: string, patch: Partial<SubtitleCue>) => void;
  onDeleteCue: (cueId: string) => void;
  onMergeWithNext: (cueId: string) => void;
  onAddCue: () => void;
  onFixOverlaps: () => void;
}

export function SubtitleEditorPanel({
  cues,
  issues,
  selectedCueId,
  currentTime,
  hasAudio,
  tone,
  contextHint,
  isTranscribing,
  isTranslating,
  aiError,
  onToneChange,
  onContextHintChange,
  onRunAiTranscribe,
  onRunAiRetranslate,
  onImportSubtitleFile,
  onSelectCue,
  onSeek,
  onUpdateCue,
  onDeleteCue,
  onMergeWithNext,
  onAddCue,
  onFixOverlaps,
}: SubtitleEditorPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'issues'>('all');
  const [editingTime, setEditingTime] = useState<{
    cueId: string;
    field: 'startSec' | 'endSec';
    value: string;
  } | null>(null);
  const subInputRef = useRef<HTMLInputElement>(null);

  const issuesByCue = useMemo(() => {
    const map = new Map<string, CueIssue[]>();
    for (const issue of issues) {
      const existing = map.get(issue.cueId) || [];
      existing.push(issue);
      map.set(issue.cueId, existing);
    }
    return map;
  }, [issues]);

  const hasOverlapIssues = issues.some((i) => i.type === 'overlap');

  const filteredCues = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return cues.filter((cue) => {
      if (filterMode === 'issues' && !issuesByCue.has(cue.id)) {
        return false;
      }
      if (!q) return true;
      return (
        cue.en.toLowerCase().includes(q) ||
        cue.vi.toLowerCase().includes(q) ||
        (cue.speaker || '').toLowerCase().includes(q)
      );
    });
  }, [cues, filterMode, issuesByCue, searchQuery]);

  const handleImportChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportSubtitleFile(file);
    }
    e.target.value = '';
  };

  const commitTimeEdit = (cue: SubtitleCue, field: 'startSec' | 'endSec', raw: string) => {
    setEditingTime(null);
    const parsed = parseTimecodeToSec(raw);
    if (parsed === null) return;
    if (field === 'startSec') {
      const nextStart = clampSeconds(Math.min(parsed, Math.max(0, cue.endSec - 0.2)));
      onUpdateCue(cue.id, { startSec: nextStart });
    } else {
      const nextEnd = clampSeconds(Math.max(parsed, cue.startSec + 0.2));
      onUpdateCue(cue.id, { endSec: nextEnd });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Transcription & Translation Toolbar */}
      <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-[var(--text-primary)]">
            Bóc băng & Dịch phụ đề
          </h2>
          <button
            type="button"
            onClick={() => subInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-2.5 min-h-[36px] md:min-h-[30px] rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] transition-colors cursor-pointer whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
            <span>Nhập SRT/VTT</span>
          </button>
          <input
            ref={subInputRef}
            type="file"
            accept=".srt,.vtt"
            className="hidden"
            onChange={handleImportChange}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label
              htmlFor="tone-select"
              className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1"
            >
              Văn phong bản dịch
            </label>
            <select
              id="tone-select"
              value={tone}
              onChange={(e) => onToneChange(e.target.value as TranslationTone)}
              className="w-full min-h-[38px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <option value="natural">Tự nhiên · Giao tiếp</option>
              <option value="cinematic">Điện ảnh · Giàu cảm xúc</option>
              <option value="educational">Học thuật · Tài liệu</option>
              <option value="business">Công nghệ · Kinh doanh</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="context-hint"
              className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1"
            >
              Ngữ cảnh / Thuật ngữ riêng
            </label>
            <input
              id="context-hint"
              type="text"
              value={contextHint}
              onChange={(e) => onContextHintChange(e.target.value)}
              placeholder="Ví dụ: tên riêng, chuyên ngành..."
              className="w-full min-h-[38px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRunAiTranscribe}
            disabled={isTranscribing || isTranslating || !hasAudio}
            title={
              hasAudio
                ? 'Tự động nghe âm thanh video và tạo phụ đề song ngữ EN–VI'
                : 'Video không có âm thanh để bóc băng'
            }
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 min-h-[42px] md:min-h-[36px] rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-xs font-bold text-[var(--accent-fg)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
          >
            <AudioLines className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
            <span>
              {isTranscribing ? 'Đang bóc băng & dịch...' : 'Tạo phụ đề tự động'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onRunAiRetranslate('polish-both')}
            disabled={isTranscribing || isTranslating || cues.length === 0}
            className="inline-flex items-center justify-center gap-1.5 px-3 min-h-[42px] md:min-h-[36px] rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-xs font-semibold text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
          >
            <Languages className="w-3.5 h-3.5 text-[var(--accent)]" strokeWidth={1.75} aria-hidden="true" />
            <span>{isTranslating ? 'Đang dịch lại...' : 'Dịch lại cho mượt'}</span>
          </button>
        </div>

        {aiError && (
          <div
            role="alert"
            className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger)]"
          >
            {aiError}
          </div>
        )}
      </div>

      {/* Filter & QA Bar */}
      <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <input
              type="text"
              aria-label="Tìm kiếm câu phụ đề"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm lời thoại Anh hoặc Việt..."
              className="w-full min-h-[38px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            />
          </div>

          <button
            type="button"
            onClick={onAddCue}
            className="inline-flex items-center gap-1 px-3 min-h-[38px] rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-xs font-semibold text-[var(--text-primary)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
            <span>Thêm câu</span>
          </button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1 p-0.5 bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-lg">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                filterMode === 'all'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Tất cả ({cues.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('issues')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                filterMode === 'issues'
                  ? 'bg-[var(--warning-soft)] text-[var(--warning)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Cần kiểm tra ({issuesByCue.size})
            </button>
          </div>

          {hasOverlapIssues && (
            <button
              type="button"
              onClick={onFixOverlaps}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[var(--warning-soft)] border border-[var(--warning)]/40 text-xs font-semibold text-[var(--warning)] hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap"
            >
              <Wrench className="w-3 h-3" strokeWidth={1.75} aria-hidden="true" />
              <span>Sửa chồng lấn</span>
            </button>
          )}
        </div>
      </div>

      {/* Cue List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-subtle)] bg-[var(--bg-main)]">
        {filteredCues.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {cues.length === 0
                ? 'Chưa có câu phụ đề nào'
                : 'Không tìm thấy câu phù hợp bộ lọc'}
            </p>
            <p className="mt-1.5 text-xs text-[var(--text-secondary)] max-w-xs mx-auto leading-relaxed">
              {cues.length === 0
                ? 'Nhấn "Tạo phụ đề tự động", nhập tệp SRT/VTT hoặc thêm câu thủ công.'
                : 'Hãy xóa từ khóa tìm kiếm hoặc chuyển về chế độ Tất cả.'}
            </p>
          </div>
        ) : (
          filteredCues.map((cue, visibleIdx) => {
            const globalIdx = cues.findIndex((c) => c.id === cue.id);
            const isSelected = cue.id === selectedCueId;
            const isPlayingNow =
              currentTime >= cue.startSec && currentTime <= cue.endSec;
            const cueIssues = issuesByCue.get(cue.id) || [];
            const missingTranslation = !cue.vi.trim() || !cue.en.trim();

            const startValue =
              editingTime?.cueId === cue.id && editingTime.field === 'startSec'
                ? editingTime.value
                : formatTimecodeShort(cue.startSec);

            const endValue =
              editingTime?.cueId === cue.id && editingTime.field === 'endSec'
                ? editingTime.value
                : formatTimecodeShort(cue.endSec);

            return (
              <div
                key={cue.id}
                data-testid={`cue-row-${globalIdx + 1}`}
                onClick={() => onSelectCue(cue.id)}
                className={`p-3.5 transition-colors ${
                  isPlayingNow
                    ? 'bg-[var(--accent-soft)]'
                    : isSelected
                      ? 'bg-[var(--bg-elevated)]'
                      : 'bg-[var(--bg-main)] hover:bg-[var(--bg-secondary)]'
                }`}
              >
                {/* Row Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCue(cue.id);
                        onSeek(cue.startSec);
                      }}
                      title={`Phát từ câu #${globalIdx + 1}`}
                      className={`text-xs font-mono tabular-nums font-bold px-2 min-h-[28px] rounded cursor-pointer transition-colors ${
                        isPlayingNow
                          ? 'bg-[var(--accent)] text-[var(--accent-fg)]'
                          : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--border-strong)]'
                      }`}
                    >
                      #{globalIdx + 1}
                    </button>

                    <input
                      type="text"
                      aria-label={`Thời điểm bắt đầu câu #${globalIdx + 1}`}
                      value={startValue}
                      onFocus={() =>
                        setEditingTime({
                          cueId: cue.id,
                          field: 'startSec',
                          value: formatTimecodeShort(cue.startSec),
                        })
                      }
                      onChange={(e) =>
                        setEditingTime({
                          cueId: cue.id,
                          field: 'startSec',
                          value: e.target.value,
                        })
                      }
                      onBlur={(e) => commitTimeEdit(cue, 'startSec', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                        }
                      }}
                      className="w-[70px] rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1.5 py-1 text-xs font-mono tabular-nums text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
                    />
                    <span className="text-[var(--text-muted)] text-xs" aria-hidden="true">
                      →
                    </span>
                    <input
                      type="text"
                      aria-label={`Thời điểm kết thúc câu #${globalIdx + 1}`}
                      value={endValue}
                      onFocus={() =>
                        setEditingTime({
                          cueId: cue.id,
                          field: 'endSec',
                          value: formatTimecodeShort(cue.endSec),
                        })
                      }
                      onChange={(e) =>
                        setEditingTime({
                          cueId: cue.id,
                          field: 'endSec',
                          value: e.target.value,
                        })
                      }
                      onBlur={(e) => commitTimeEdit(cue, 'endSec', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                        }
                      }}
                      className="w-[70px] rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1.5 py-1 text-xs font-mono tabular-nums text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
                    />

                    <input
                      type="text"
                      aria-label={`Người nói câu #${globalIdx + 1}`}
                      value={cue.speaker || ''}
                      onChange={(e) =>
                        onUpdateCue(cue.id, { speaker: e.target.value })
                      }
                      placeholder="Người nói"
                      className="w-[78px] rounded border border-transparent hover:border-[var(--border-subtle)] focus:border-[var(--border-strong)] bg-transparent px-1.5 py-1 text-xs text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus-visible:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateCue(cue.id, {
                          en: cue.vi,
                          vi: cue.en,
                        });
                      }}
                      aria-label={`Đảo nội dung Anh và Việt của câu #${globalIdx + 1}`}
                      title="Đảo EN ↔ VI"
                      className="min-w-[36px] min-h-[36px] md:min-w-[30px] md:min-h-[30px] inline-flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
                    >
                      <ArrowDownUp className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                    </button>

                    {globalIdx < cues.length - 1 && visibleIdx >= 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMergeWithNext(cue.id);
                        }}
                        aria-label={`Gộp câu #${globalIdx + 1} với câu #${globalIdx + 2}`}
                        title="Gộp với câu kế tiếp"
                        className="min-w-[36px] min-h-[36px] md:min-w-[30px] md:min-h-[30px] inline-flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
                      >
                        <Merge className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteCue(cue.id);
                      }}
                      aria-label={`Xóa câu #${globalIdx + 1}`}
                      title="Xóa câu phụ đề"
                      className="min-w-[36px] min-h-[36px] md:min-w-[30px] md:min-h-[30px] inline-flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)] transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Bilingual Text Inputs */}
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2">
                    <span className="mt-2 w-6 shrink-0 text-[11px] font-mono font-semibold text-[var(--text-muted)]">
                      EN
                    </span>
                    <textarea
                      rows={2}
                      aria-label={`Phụ đề Tiếng Anh câu #${globalIdx + 1}`}
                      value={cue.en}
                      onChange={(e) => onUpdateCue(cue.id, { en: e.target.value })}
                      placeholder="Nhập lời thoại Tiếng Anh..."
                      className={`w-full resize-none rounded-md border bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] ${
                        !cue.en.trim()
                          ? 'border-[var(--warning)]/60'
                          : 'border-[var(--border-subtle)]'
                      }`}
                    />
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="mt-2 w-6 shrink-0 text-[11px] font-mono font-semibold text-[var(--accent)]">
                      VI
                    </span>
                    <textarea
                      rows={2}
                      aria-label={`Phụ đề Tiếng Việt câu #${globalIdx + 1}`}
                      value={cue.vi}
                      onChange={(e) => onUpdateCue(cue.id, { vi: e.target.value })}
                      placeholder="Nhập bản dịch Tiếng Việt..."
                      className={`w-full resize-none rounded-md border bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] ${
                        !cue.vi.trim()
                          ? 'border-[var(--warning)]/60'
                          : 'border-[var(--border-subtle)]'
                      }`}
                    />
                  </div>
                </div>

                {(cueIssues.length > 0 || missingTranslation) && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--warning)]">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    <span>{cueIssues.map((i) => i.message).join(' · ')}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
