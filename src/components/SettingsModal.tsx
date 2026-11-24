import { useEffect, useRef } from 'react';
import { ExternalLink, Monitor, Moon, Sun, X } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { ensureGsapRegistered, gsap, prefersReducedMotion } from '../utils/motion';

export type AppTheme = 'dark' | 'light';

interface SettingsModalProps {
  isOpen: boolean;
  theme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
  onClose: () => void;
}

export function SettingsModal({
  isOpen,
  theme,
  onThemeChange,
  onClose,
}: SettingsModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const prevActive = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    ensureGsapRegistered();
    const ctx = gsap.context(() => {
      const reduced = prefersReducedMotion();
      if (reduced) {
        gsap.set([backdropRef.current, dialogRef.current], { opacity: 1, y: 0, scale: 1 });
        return;
      }
      gsap.fromTo(
        backdropRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.2, ease: 'power2.out' },
      );
      gsap.fromTo(
        dialogRef.current,
        { opacity: 0, y: 16, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.26, ease: 'power3.out' },
      );

      if (scrollBodyRef.current) {
        const blocks = scrollBodyRef.current.querySelectorAll('[data-settings-section]');
        blocks.forEach((el) => {
          gsap.fromTo(
            el,
            { opacity: 0.85, y: 6 },
            {
              opacity: 1,
              y: 0,
              duration: 0.25,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: el,
                scroller: scrollBodyRef.current!,
                start: 'top 95%',
                once: true,
              },
            },
          );
        });
      }
    });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      ctx.revert();
      prevActive?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={backdropRef}
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        className="w-full sm:max-w-lg max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between gap-4 bg-[var(--bg-secondary)]">
          <div>
            <h2
              id="settings-dialog-title"
              className="text-base font-bold tracking-tight text-[var(--text-primary)]"
            >
              Cài đặt & Thông tin ứng dụng
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Phụ đề Studio
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Đóng cài đặt"
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <X className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        <div
          ref={scrollBodyRef}
          className="flex-1 overflow-y-auto p-5 space-y-6"
        >
          {/* Theme selector */}
          <section data-settings-section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Giao diện làm việc
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Khung xem trước video luôn giữ nền tối độc lập để bảo toàn độ tương phản phụ đề.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onThemeChange('dark')}
                aria-pressed={theme === 'dark'}
                className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer min-h-[44px] ${
                  theme === 'dark'
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-secondary)] hover:border-[var(--border-strong)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                    <Moon className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                    <span>Tối (Graphite)</span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="w-4 h-4 rounded-sm border border-white/15 bg-[#101114]"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-[var(--text-secondary)]">
                  Tối ưu cho phòng dựng và làm việc dài giờ.
                </p>
              </button>

              <button
                type="button"
                onClick={() => onThemeChange('light')}
                aria-pressed={theme === 'light'}
                className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer min-h-[44px] ${
                  theme === 'light'
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-secondary)] hover:border-[var(--border-strong)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                    <Sun className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                    <span>Sáng (Warm Paper)</span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="w-4 h-4 rounded-sm border border-black/15 bg-[#F5F4F0]"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-[var(--text-secondary)]">
                  Rõ nét dưới ánh sáng ban ngày, dịu mắt khi rà soát chữ.
                </p>
              </button>
            </div>
          </section>

          {/* Keyboard Shortcuts */}
          <section
            data-settings-section
            className="pt-5 border-t border-[var(--border-subtle)] space-y-2.5"
          >
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Phím tắt biên tập (Desktop)
            </h3>
            <div className="divide-y divide-[var(--border-subtle)] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
              <div className="px-3.5 py-2.5 flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)]">Phát / Tạm dừng video</span>
                <kbd className="px-2 py-0.5 rounded border border-[var(--border-strong)] bg-[var(--bg-surface)] font-mono text-[11px] text-[var(--text-primary)]">
                  Space
                </kbd>
              </div>
              <div className="px-3.5 py-2.5 flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)]">Tua lùi / tiến 0.5 giây</span>
                <span className="flex items-center gap-1">
                  <kbd className="px-2 py-0.5 rounded border border-[var(--border-strong)] bg-[var(--bg-surface)] font-mono text-[11px] text-[var(--text-primary)]">
                    ←
                  </kbd>
                  <kbd className="px-2 py-0.5 rounded border border-[var(--border-strong)] bg-[var(--bg-surface)] font-mono text-[11px] text-[var(--text-primary)]">
                    →
                  </kbd>
                </span>
              </div>
              <div className="px-3.5 py-2.5 flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)]">Cắt đôi câu tại kim thời gian</span>
                <kbd className="px-2 py-0.5 rounded border border-[var(--border-strong)] bg-[var(--bg-surface)] font-mono text-[11px] text-[var(--text-primary)]">
                  S
                </kbd>
              </div>
            </div>
          </section>

          {/* About & Contact */}
          <section
            data-settings-section
            className="pt-5 border-t border-[var(--border-subtle)] space-y-3"
          >
            <div className="flex items-center justify-between">
              <BrandMark />
              <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <Monitor className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                <span>Studio Edition</span>
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Phụ đề Studio kết hợp bóc băng đa phương thức qua Gemini API với bộ
              render FFmpeg / libass và font Noto Sans chuẩn tiếng Việt để xuất video phụ đề
              song ngữ Anh – Việt hoàn chỉnh.
            </p>

            <div className="pt-1 flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3.5 py-2.5">
              <div>
                <div className="text-xs font-semibold text-[var(--text-primary)]">
                  Liên hệ hỗ trợ & góp ý
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                  Kết nối trực tiếp qua Facebook
                </div>
              </div>
              <a
                href="https://www.facebook.com/0Cuongisme?locale=vi_VN"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-md border border-[var(--border-strong)] bg-[var(--bg-surface)] hover:border-[var(--accent)] text-xs font-semibold text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors whitespace-nowrap shrink-0"
              >
                <span>Liên hệ</span>
                <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
              </a>
            </div>
          </section>
        </div>

        <div className="px-5 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex items-center justify-between text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-2">
            <span>Phụ đề Studio</span>
            <span aria-hidden="true">·</span>
            <a
              href="https://www.facebook.com/0Cuongisme?locale=vi_VN"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--text-secondary)] hover:text-[var(--accent)] underline underline-offset-4 transition-colors"
            >
              Liên hệ
            </a>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] font-semibold transition-colors cursor-pointer min-h-[40px]"
          >
            Xong
          </button>
        </div>
      </div>
    </div>
  );
}
