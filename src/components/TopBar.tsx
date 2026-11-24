import { useEffect, useRef } from 'react';
import { Download, Moon, Settings, Sun } from 'lucide-react';
import type { WorkspaceTab } from '../types/subtitle';
import type { AppTheme } from './SettingsModal';
import { BrandMark } from './BrandMark';
import { ensureGsapRegistered, gsap, prefersReducedMotion } from '../utils/motion';

interface TopBarProps {
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  hasVideo: boolean;
  isExporting: boolean;
  theme: AppTheme;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onPrimaryExportClick: () => void;
  onBrandClick: () => void;
}

export function TopBar({
  activeTab,
  onTabChange,
  hasVideo,
  isExporting,
  theme,
  onToggleTheme,
  onOpenSettings,
  onPrimaryExportClick,
  onBrandClick,
}: TopBarProps) {
  const navRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const tabButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const navItems: Array<{ id: WorkspaceTab; label: string }> = [
    { id: 'editor', label: 'Biên tập' },
    { id: 'style', label: 'Kiểu chữ' },
    { id: 'export', label: 'Xuất bản' },
  ];

  // Smooth GSAP active indicator slide across nav tabs
  useEffect(() => {
    const activeBtn = tabButtonRefs.current[activeTab];
    const indicator = indicatorRef.current;
    if (!activeBtn || !indicator) return;

    ensureGsapRegistered();
    const targetX = activeBtn.offsetLeft;
    const targetW = activeBtn.offsetWidth;

    if (prefersReducedMotion()) {
      gsap.set(indicator, { x: targetX, width: targetW, opacity: 1 });
    } else {
      gsap.to(indicator, {
        x: targetX,
        width: targetW,
        opacity: 1,
        duration: 0.24,
        ease: 'power3.out',
      });
    }
  }, [activeTab]);

  return (
    <header
      data-entrance="header"
      className="h-14 shrink-0 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 sm:px-5 flex items-center justify-between gap-3 md:gap-8"
    >
      {/* Zone 1: Brand lockup */}
      <div className="flex items-center shrink-0">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onBrandClick();
          }}
          aria-label="Phụ đề"
          className="py-1.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <BrandMark />
        </a>
      </div>

      {/* Zone 2: Desktop Navigation + Settings */}
      <nav
        ref={navRef}
        aria-label="Điều hướng chính"
        className="relative hidden md:flex items-center gap-6"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              ref={(el) => {
                tabButtonRefs.current[item.id] = el;
              }}
              type="button"
              onClick={() => onTabChange(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`py-4 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                isActive
                  ? 'text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {item.label}
            </button>
          );
        })}

        <button
          type="button"
          onClick={onOpenSettings}
          className="py-4 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          Cài đặt
        </button>

        <span
          ref={indicatorRef}
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 h-0.5 bg-[var(--accent)] rounded-full opacity-0"
        />
      </nav>

      {/* Zone 3: Theme Toggle + Settings (mobile) + Primary CTA */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={
            theme === 'dark'
              ? 'Chuyển sang giao diện sáng'
              : 'Chuyển sang giao diện tối'
          }
          title={theme === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}
          className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Moon className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Mở cài đặt"
          className="md:hidden min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <Settings className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onPrimaryExportClick}
          disabled={!hasVideo || isExporting}
          className="inline-flex items-center gap-2 px-3.5 sm:px-4 min-h-[40px] text-xs font-bold rounded-lg bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <Download className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
          <span className="hidden sm:inline">
            {isExporting ? 'Đang xuất MP4...' : 'Xuất video (.mp4)'}
          </span>
          <span className="sm:hidden">
            {isExporting ? 'Đang xuất...' : 'Xuất MP4'}
          </span>
        </button>
      </div>
    </header>
  );
}
