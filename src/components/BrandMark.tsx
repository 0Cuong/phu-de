interface BrandMarkProps {
  compact?: boolean;
}

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <span className="inline-flex items-center gap-2.5 select-none whitespace-nowrap shrink-0">
      <span
        aria-hidden="true"
        className="inline-flex items-center justify-center w-6 h-6 rounded-[5px] border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[10px] font-extrabold tracking-tighter text-[var(--accent)] font-mono"
      >
        PĐ
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className="text-[14px] font-extrabold tracking-tight text-[var(--text-primary)]">
          Phụ đề
        </span>
        {!compact && (
          <span className="text-[11px] font-medium text-[var(--text-muted)] hidden sm:inline">
            Studio
          </span>
        )}
      </span>
    </span>
  );
}
