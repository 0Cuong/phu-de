import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Captions, Play, Upload, Video } from 'lucide-react';
import { ensureGsapRegistered, gsap, prefersReducedMotion } from '../utils/motion';

interface UploadStageProps {
  onSelectVideoFile: (file: File) => void;
  onLoadSampleVideo: () => void;
  onImportSubtitleFile: (file: File) => void;
  isLoadingSample: boolean;
  isProbingVideo: boolean;
  errorMessage: string | null;
}

export function UploadStage({
  onSelectVideoFile,
  onLoadSampleVideo,
  onImportSubtitleFile,
  isLoadingSample,
  isProbingVideo,
  errorMessage,
}: UploadStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const subInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    ensureGsapRegistered();
    const ctx = gsap.context(() => {
      if (prefersReducedMotion()) return;
      const targets = el.querySelectorAll('[data-upload-stagger]');
      gsap.fromTo(
        targets,
        { opacity: 0, y: 12 },
        {
          opacity: 1,
          y: 0,
          duration: 0.48,
          stagger: 0.06,
          ease: 'power3.out',
          clearProps: 'transform',
        },
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  const handleVideoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSelectVideoFile(file);
    }
    e.target.value = '';
  };

  const handleSubChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportSubtitleFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.srt') || lower.endsWith('.vtt')) {
      onImportSubtitleFile(file);
    } else {
      onSelectVideoFile(file);
    }
  };

  const isBusy = isProbingVideo || isLoadingSample;

  return (
    <main
      ref={containerRef}
      className="flex-1 flex flex-col justify-between p-4 sm:p-6 lg:p-10"
    >
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-4xl">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`rounded-xl border transition-colors p-6 sm:p-10 lg:p-12 bg-[var(--bg-surface)] ${
              isDragging
                ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                : 'border-[var(--border-subtle)]'
            }`}
          >
            <div className="max-w-2xl mx-auto text-center">
              <div
                data-upload-stagger
                className="inline-flex items-center justify-center w-11 h-11 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] mb-5"
              >
                <Video
                  className="w-5 h-5 text-[var(--accent)]"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </div>

              <p
                data-upload-stagger
                className="text-xs font-bold tracking-[0.12em] text-[var(--text-muted)] mb-2"
              >
                PHỤ ĐỀ STUDIO
              </p>

              <h1
                data-upload-stagger
                className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] [text-wrap:balance]"
              >
                Phụ đề song ngữ Anh – Việt cho video
              </h1>

              <p
                data-upload-stagger
                className="mt-3 text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed max-w-xl mx-auto"
              >
                Bóc băng giọng nói, dịch Việt ngữ tự nhiên theo ngữ cảnh, tinh chỉnh mốc
                thời gian chính xác và xuất video MP4 gắn cứng phụ đề sắc nét.
              </p>

              {errorMessage && (
                <div
                  role="alert"
                  className="mt-5 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]"
                >
                  {errorMessage}
                </div>
              )}

              {isBusy && (
                <div
                  role="status"
                  className="mt-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3 text-xs font-medium text-[var(--text-secondary)]"
                >
                  {isLoadingSample ? 'Đang tạo và nạp video mẫu...' : 'Đang phân tích thông số video...'}
                </div>
              )}

              <div
                data-upload-stagger
                className="mt-8 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-3"
              >
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={isBusy}
                  className="inline-flex items-center justify-center gap-2 px-5 min-h-[44px] rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-sm font-bold text-[var(--accent-fg)] transition-colors disabled:opacity-45 cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  <Upload className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
                  <span>
                    {isProbingVideo ? 'Đang nạp video...' : 'Chọn video từ máy'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onLoadSampleVideo}
                  disabled={isBusy}
                  className="inline-flex items-center justify-center gap-2 px-5 min-h-[44px] rounded-lg border border-[var(--border-strong)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-elevated)] text-sm font-semibold text-[var(--text-primary)] transition-colors disabled:opacity-45 cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  <Play className="w-4 h-4 text-[var(--accent)]" strokeWidth={1.75} aria-hidden="true" />
                  <span>
                    {isLoadingSample ? 'Đang tải video mẫu...' : 'Dùng video mẫu (12s)'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => subInputRef.current?.click()}
                  disabled={isBusy}
                  className="inline-flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-lg border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  <Captions className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                  <span>Nhập file .SRT / .VTT</span>
                </button>
              </div>

              <p
                data-upload-stagger
                className="mt-4 text-xs text-[var(--text-muted)]"
              >
                Kéo thả trực tiếp MP4, WebM, MOV, MKV (tối đa 300 MB) hoặc tệp phụ đề SRT / VTT.
              </p>
            </div>

            <div
              data-upload-stagger
              className="mt-10 pt-8 border-t border-[var(--border-subtle)] grid grid-cols-1 md:grid-cols-3 gap-6 text-left"
            >
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  01. Nhận diện & Dịch chuẩn ngữ cảnh
                </h2>
                <p className="mt-1.5 text-xs text-[var(--text-secondary)] leading-relaxed">
                  Phân tách câu theo đúng nhịp nói và dịch Việt ngữ tự nhiên theo phong cách điện ảnh, học thuật hoặc kinh doanh.
                </p>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  02. Xem trước & Đồng bộ từng 0.1s
                </h2>
                <p className="mt-1.5 text-xs text-[var(--text-secondary)] leading-relaxed">
                  Hiển thị phụ đề song ngữ theo tỷ lệ khung hình thật, cắt/gộp câu, dịch chuyển thời gian và cảnh báo chồng lấn.
                </p>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  03. Gắn cứng MP4 & Xuất đa định dạng
                </h2>
                <p className="mt-1.5 text-xs text-[var(--text-secondary)] leading-relaxed">
                  Render trực tiếp phụ đề tiếng Việt chuẩn dấu Noto Sans vào video MP4 qua FFmpeg, kèm tệp SRT, VTT và ASS.
                </p>
              </div>
            </div>

            <input
              ref={videoInputRef}
              type="file"
              accept="video/*,.mp4,.webm,.mov,.mkv,.m4v"
              className="hidden"
              onChange={handleVideoChange}
            />
            <input
              ref={subInputRef}
              type="file"
              accept=".srt,.vtt"
              className="hidden"
              onChange={handleSubChange}
            />
          </div>
        </div>
      </div>

      <footer className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
        <span>Phụ đề Studio · Biên tập & xuất phụ đề song ngữ Anh – Việt</span>
        <span aria-hidden="true">·</span>
        <a
          href="https://www.facebook.com/0Cuongisme?locale=vi_VN"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] underline underline-offset-4 transition-colors"
        >
          Liên hệ
        </a>
      </footer>
    </main>
  );
}
