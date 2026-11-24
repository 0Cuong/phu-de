import { useMemo, useState } from 'react';
import { Check, Copy, Download, Video } from 'lucide-react';
import type {
  LanguageOrder,
  SubtitleCue,
  SubtitleStyle,
  VideoInfo,
  VideoResolutionPreset,
} from '../types/subtitle';
import { generateASS, generateSRT, generateVTT } from '../utils/subtitleFormats';

interface ExportPanelProps {
  videoInfo: VideoInfo;
  cues: SubtitleCue[];
  style: SubtitleStyle;
  isExportingMp4: boolean;
  exportError: string | null;
  exportedMp4Url: string | null;
  exportedMp4Name: string | null;
  onExportMp4: (resolution: VideoResolutionPreset) => void;
}

function downloadTextFile(content: string, filename: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportPanel({
  videoInfo,
  cues,
  style,
  isExportingMp4,
  exportError,
  exportedMp4Url,
  exportedMp4Name,
  onExportMp4,
}: ExportPanelProps) {
  const [resolutionPreset, setResolutionPreset] =
    useState<VideoResolutionPreset>('original');
  const [previewFormat, setPreviewFormat] = useState<'srt' | 'ass'>('srt');
  const [copied, setCopied] = useState(false);

  const baseName = useMemo(() => {
    const raw = videoInfo.fileName.replace(/\.[^/.]+$/, '');
    return raw.replace(/[^a-zA-Z0-9_-]+/g, '_') || 'video';
  }, [videoInfo.fileName]);

  const previewText = useMemo(() => {
    if (previewFormat === 'ass') {
      return generateASS(cues, style, videoInfo.width, videoInfo.height);
    }
    return generateSRT(cues, style.languageOrder, style.showSpeaker);
  }, [cues, previewFormat, style, videoInfo.height, videoInfo.width]);

  const handleDownloadSubtitle = (
    ext: 'srt' | 'vtt' | 'ass',
    orderOverride?: LanguageOrder,
  ) => {
    const order = orderOverride || style.languageOrder;
    if (ext === 'srt') {
      const suffix =
        order === 'en-only' ? 'en' : order === 'vi-only' ? 'vi' : 'phude';
      downloadTextFile(
        generateSRT(cues, order, style.showSpeaker),
        `${baseName}_${suffix}.srt`,
      );
      return;
    }
    if (ext === 'vtt') {
      downloadTextFile(
        generateVTT(cues, order, style.showSpeaker),
        `${baseName}_phude.vtt`,
        'text/vtt;charset=utf-8',
      );
      return;
    }
    downloadTextFile(
      generateASS(cues, style, videoInfo.width, videoInfo.height),
      `${baseName}_phude.ass`,
    );
  };

  const handleCopyPreview = async () => {
    try {
      await navigator.clipboard.writeText(previewText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard denial
    }
  };

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full bg-[var(--bg-main)]">
      {/* Hard-subbed MP4 render section */}
      <section aria-labelledby="mp4-export-heading" className="space-y-3">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-[var(--accent)]" strokeWidth={1.75} aria-hidden="true" />
          <h2 id="mp4-export-heading" className="text-sm font-bold text-[var(--text-primary)]">
            Gắn cứng phụ đề vào Video (.MP4)
          </h2>
        </div>

        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          Render trực tiếp phụ đề song ngữ theo đúng màu sắc, cỡ chữ và hộp nền bạn đã
          chọn vào video MP4 qua FFmpeg (libass · Noto Sans).
        </p>

        <div>
          <label
            htmlFor="resolution-preset"
            className="block text-xs text-[var(--text-secondary)] mb-1"
          >
            Độ phân giải đầu ra
          </label>
          <select
            id="resolution-preset"
            value={resolutionPreset}
            onChange={(e) =>
              setResolutionPreset(e.target.value as VideoResolutionPreset)
            }
            className="w-full min-h-[40px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)]"
          >
            <option value="original">
              Giữ nguyên độ phân giải gốc ({videoInfo.width}×{videoInfo.height})
            </option>
            <option value="720p">Tối ưu 720p (nhanh hơn, nhẹ dung lượng)</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => onExportMp4(resolutionPreset)}
          disabled={isExportingMp4 || cues.length === 0}
          className="w-full inline-flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-xs font-bold text-[var(--accent-fg)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
          <span>
            {isExportingMp4
              ? 'Đang render video MP4 bằng FFmpeg...'
              : 'Render & Tải Video Phụ Đề (.MP4)'}
          </span>
        </button>

        {exportError && (
          <div
            role="alert"
            className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger)]"
          >
            {exportError}
          </div>
        )}

        {exportedMp4Url && exportedMp4Name && (
          <div className="rounded-lg border border-[var(--success)]/45 bg-[var(--success-soft)] p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-bold text-[var(--success)]">
                Đã render xong video phụ đề
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5 font-mono">
                {exportedMp4Name}
              </div>
            </div>
            <a
              href={exportedMp4Url}
              download={exportedMp4Name}
              className="px-3 min-h-[36px] inline-flex items-center rounded-md bg-[var(--success)] text-white text-xs font-semibold whitespace-nowrap shrink-0 hover:opacity-90"
            >
              Tải lại MP4
            </a>
          </div>
        )}
      </section>

      {/* Subtitle Files */}
      <section
        aria-labelledby="sub-files-heading"
        className="pt-5 border-t border-[var(--border-subtle)] space-y-3"
      >
        <h2 id="sub-files-heading" className="text-sm font-bold text-[var(--text-primary)]">
          Xuất tệp phụ đề rời (.SRT / .VTT / .ASS)
        </h2>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleDownloadSubtitle('srt')}
            disabled={cues.length === 0}
            className="inline-flex items-center justify-center gap-1.5 px-3 min-h-[40px] rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-xs font-semibold text-[var(--text-primary)] disabled:opacity-40 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
            <span>.SRT Song ngữ</span>
          </button>

          <button
            type="button"
            onClick={() => handleDownloadSubtitle('ass')}
            disabled={cues.length === 0}
            className="inline-flex items-center justify-center gap-1.5 px-3 min-h-[40px] rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-xs font-semibold text-[var(--text-primary)] disabled:opacity-40 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
            <span>.ASS (Có Style)</span>
          </button>

          <button
            type="button"
            onClick={() => handleDownloadSubtitle('srt', 'en-only')}
            disabled={cues.length === 0}
            className="inline-flex items-center justify-center gap-1.5 px-3 min-h-[40px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
            <span>.SRT Chỉ EN</span>
          </button>

          <button
            type="button"
            onClick={() => handleDownloadSubtitle('srt', 'vi-only')}
            disabled={cues.length === 0}
            className="inline-flex items-center justify-center gap-1.5 px-3 min-h-[40px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
            <span>.SRT Chỉ VI</span>
          </button>

          <button
            type="button"
            onClick={() => handleDownloadSubtitle('vtt')}
            disabled={cues.length === 0}
            className="col-span-2 inline-flex items-center justify-center gap-1.5 px-3 min-h-[40px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
            <span>.VTT WebVTT Song ngữ</span>
          </button>
        </div>
      </section>

      {/* Code Preview */}
      <section
        aria-labelledby="sub-preview-heading"
        className="pt-5 border-t border-[var(--border-subtle)] space-y-2.5"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => setPreviewFormat('srt')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                previewFormat === 'srt'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Xem trước SRT
            </button>
            <button
              type="button"
              onClick={() => setPreviewFormat('ass')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                previewFormat === 'ass'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Xem trước ASS
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyPreview}
            className="inline-flex items-center gap-1 px-2.5 min-h-[32px] rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[var(--success)]" strokeWidth={2} aria-hidden="true" />
                <span>Đã chép</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                <span>Sao chép</span>
              </>
            )}
          </button>
        </div>

        <pre className="max-h-56 overflow-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3 text-[11px] font-mono text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap break-words">
          {previewText || '(Chưa có nội dung phụ đề)'}
        </pre>
      </section>
    </div>
  );
}
