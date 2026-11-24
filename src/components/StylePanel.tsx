import {
  STYLE_PRESETS,
  type LanguageOrder,
  type SubtitleStyle,
} from '../types/subtitle';

interface StylePanelProps {
  style: SubtitleStyle;
  onUpdateStyle: (patch: Partial<SubtitleStyle>) => void;
}

const COLOR_SWATCHES = [
  '#FFFFFF',
  '#F1F5F9',
  '#FDE047',
  '#FACC15',
  '#93C5FD',
  '#86EFAC',
  '#FCA5A5',
];

export function StylePanel({ style, onUpdateStyle }: StylePanelProps) {
  const languageOrders: Array<{ value: LanguageOrder; label: string }> = [
    { value: 'en-top', label: 'EN trên · VI dưới' },
    { value: 'vi-top', label: 'VI trên · EN dưới' },
    { value: 'en-only', label: 'Chỉ Tiếng Anh' },
    { value: 'vi-only', label: 'Chỉ Tiếng Việt' },
  ];

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full bg-[var(--bg-main)]">
      {/* Presets */}
      <section aria-labelledby="style-presets-heading">
        <h2
          id="style-presets-heading"
          className="text-sm font-bold text-[var(--text-primary)] mb-2.5"
        >
          Mẫu hiển thị dựng sẵn
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {STYLE_PRESETS.map((preset) => {
            const active = style.presetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onUpdateStyle(preset.patch)}
                className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                  active
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text-primary)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                }`}
              >
                <div className="text-xs font-semibold text-[var(--text-primary)]">
                  {preset.name}
                </div>
                <p className="mt-1 text-[11px] text-[var(--text-secondary)] leading-snug">
                  {preset.description}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Language Stacking & Position */}
      <section
        aria-labelledby="layout-order-heading"
        className="pt-5 border-t border-[var(--border-subtle)] space-y-4"
      >
        <h2
          id="layout-order-heading"
          className="text-sm font-bold text-[var(--text-primary)]"
        >
          Thứ tự ngôn ngữ & Vị trí
        </h2>

        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
          {languageOrders.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onUpdateStyle({ languageOrder: opt.value })}
              className={`px-2.5 min-h-[38px] md:min-h-[32px] rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                style.languageOrder === opt.value
                  ? 'bg-[var(--accent)] text-[var(--accent-fg)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="alignment-select"
              className="block text-xs text-[var(--text-secondary)] mb-1"
            >
              Neo khung hình
            </label>
            <select
              id="alignment-select"
              value={style.alignment}
              onChange={(e) =>
                onUpdateStyle({ alignment: e.target.value as 'bottom' | 'top' })
              }
              className="w-full min-h-[38px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)]"
            >
              <option value="bottom">Cạnh dưới</option>
              <option value="top">Cạnh trên</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="margin-range"
              className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1"
            >
              <span>Cách lề</span>
              <span className="font-mono tabular-nums text-[var(--text-primary)]">
                {style.marginBottomPct}%
              </span>
            </label>
            <input
              id="margin-range"
              type="range"
              min={2}
              max={28}
              step={1}
              value={style.marginBottomPct}
              onChange={(e) =>
                onUpdateStyle({ marginBottomPct: Number(e.target.value) })
              }
              className="w-full accent-[var(--accent)] cursor-pointer mt-2"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label
              htmlFor="line-gap-range"
              className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1"
            >
              <span>Khoảng cách giữa 2 dòng EN – VI</span>
              <span className="font-mono tabular-nums text-[var(--text-primary)]">
                {style.lineGap}px
              </span>
            </label>
            <input
              id="line-gap-range"
              type="range"
              min={0}
              max={20}
              step={2}
              value={style.lineGap}
              onChange={(e) =>
                onUpdateStyle({ lineGap: Number(e.target.value) })
              }
              className="w-full accent-[var(--accent)] cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="show-speaker-toggle"
              className="text-xs text-[var(--text-primary)] cursor-pointer"
            >
              Hiển thị nhãn người nói (ví dụ [Host])
            </label>
            <input
              id="show-speaker-toggle"
              type="checkbox"
              checked={style.showSpeaker}
              onChange={(e) => onUpdateStyle({ showSpeaker: e.target.checked })}
              className="w-4 h-4 accent-[var(--accent)] cursor-pointer"
            />
          </div>
        </div>
      </section>

      {/* English Typography */}
      <section
        aria-labelledby="en-style-heading"
        className="pt-5 border-t border-[var(--border-subtle)] space-y-3"
      >
        <div className="flex items-center justify-between">
          <h2 id="en-style-heading" className="text-sm font-bold text-[var(--text-primary)]">
            Dòng Tiếng Anh (EN)
          </h2>
          <label className="inline-flex items-center gap-1.5 text-xs text-[var(--text-primary)] cursor-pointer">
            <input
              type="checkbox"
              checked={style.enBold}
              onChange={(e) => onUpdateStyle({ enBold: e.target.checked })}
              className="accent-[var(--accent)]"
            />
            <span>In đậm</span>
          </label>
        </div>

        <div>
          <label
            htmlFor="en-size-range"
            className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1"
          >
            <span>Cỡ chữ (chuẩn 1080p)</span>
            <span className="font-mono tabular-nums text-[var(--text-primary)]">
              {style.enSize}px
            </span>
          </label>
          <input
            id="en-size-range"
            type="range"
            min={24}
            max={72}
            step={2}
            value={style.enSize}
            onChange={(e) => onUpdateStyle({ enSize: Number(e.target.value) })}
            className="w-full accent-[var(--accent)] cursor-pointer"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {COLOR_SWATCHES.map((hex) => (
            <button
              key={`en-${hex}`}
              type="button"
              onClick={() => onUpdateStyle({ enColor: hex })}
              aria-label={`Chọn màu chữ Tiếng Anh ${hex}`}
              className={`w-7 h-7 rounded-md border cursor-pointer ${
                style.enColor.toUpperCase() === hex
                  ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/40'
                  : 'border-[var(--border-strong)]'
              }`}
              style={{ backgroundColor: hex }}
            />
          ))}
          <input
            type="color"
            aria-label="Màu tùy chỉnh Tiếng Anh"
            value={style.enColor}
            onChange={(e) => onUpdateStyle({ enColor: e.target.value })}
            className="w-7 h-7 rounded bg-transparent border-0 cursor-pointer"
          />
        </div>
      </section>

      {/* Vietnamese Typography */}
      <section
        aria-labelledby="vi-style-heading"
        className="pt-5 border-t border-[var(--border-subtle)] space-y-3"
      >
        <div className="flex items-center justify-between">
          <h2 id="vi-style-heading" className="text-sm font-bold text-[var(--text-primary)]">
            Dòng Tiếng Việt (VI)
          </h2>
          <label className="inline-flex items-center gap-1.5 text-xs text-[var(--text-primary)] cursor-pointer">
            <input
              type="checkbox"
              checked={style.viBold}
              onChange={(e) => onUpdateStyle({ viBold: e.target.checked })}
              className="accent-[var(--accent)]"
            />
            <span>In đậm</span>
          </label>
        </div>

        <div>
          <label
            htmlFor="vi-size-range"
            className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1"
          >
            <span>Cỡ chữ (chuẩn 1080p)</span>
            <span className="font-mono tabular-nums text-[var(--text-primary)]">
              {style.viSize}px
            </span>
          </label>
          <input
            id="vi-size-range"
            type="range"
            min={24}
            max={76}
            step={2}
            value={style.viSize}
            onChange={(e) => onUpdateStyle({ viSize: Number(e.target.value) })}
            className="w-full accent-[var(--accent)] cursor-pointer"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {COLOR_SWATCHES.map((hex) => (
            <button
              key={`vi-${hex}`}
              type="button"
              onClick={() => onUpdateStyle({ viColor: hex })}
              aria-label={`Chọn màu chữ Tiếng Việt ${hex}`}
              className={`w-7 h-7 rounded-md border cursor-pointer ${
                style.viColor.toUpperCase() === hex
                  ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/40'
                  : 'border-[var(--border-strong)]'
              }`}
              style={{ backgroundColor: hex }}
            />
          ))}
          <input
            type="color"
            aria-label="Màu tùy chỉnh Tiếng Việt"
            value={style.viColor}
            onChange={(e) => onUpdateStyle({ viColor: e.target.value })}
            className="w-7 h-7 rounded bg-transparent border-0 cursor-pointer"
          />
        </div>
      </section>

      {/* Backdrop & Outline */}
      <section
        aria-labelledby="backdrop-heading"
        className="pt-5 border-t border-[var(--border-subtle)] space-y-3"
      >
        <div className="flex items-center justify-between">
          <h2 id="backdrop-heading" className="text-sm font-bold text-[var(--text-primary)]">
            Hộp nền & Viền chữ
          </h2>
          <label className="inline-flex items-center gap-1.5 text-xs text-[var(--text-primary)] cursor-pointer">
            <input
              type="checkbox"
              checked={style.bgEnabled}
              onChange={(e) => onUpdateStyle({ bgEnabled: e.target.checked })}
              className="accent-[var(--accent)]"
            />
            <span>Bật hộp nền</span>
          </label>
        </div>

        {style.bgEnabled ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="bg-color-input"
                className="block text-xs text-[var(--text-secondary)] mb-1"
              >
                Màu hộp nền
              </label>
              <input
                id="bg-color-input"
                type="color"
                value={style.bgColor}
                onChange={(e) => onUpdateStyle({ bgColor: e.target.value })}
                className="w-full h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] cursor-pointer"
              />
            </div>

            <div>
              <label
                htmlFor="bg-opacity-range"
                className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1"
              >
                <span>Độ mờ nền</span>
                <span className="font-mono tabular-nums text-[var(--text-primary)]">
                  {style.bgOpacity}%
                </span>
              </label>
              <input
                id="bg-opacity-range"
                type="range"
                min={15}
                max={100}
                step={5}
                value={style.bgOpacity}
                onChange={(e) =>
                  onUpdateStyle({ bgOpacity: Number(e.target.value) })
                }
                className="w-full accent-[var(--accent)] cursor-pointer mt-2"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="outline-range"
                className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1"
              >
                <span>Độ dày viền</span>
                <span className="font-mono tabular-nums text-[var(--text-primary)]">
                  {style.outlineWidth}px
                </span>
              </label>
              <input
                id="outline-range"
                type="range"
                min={0}
                max={6}
                step={0.5}
                value={style.outlineWidth}
                onChange={(e) =>
                  onUpdateStyle({ outlineWidth: Number(e.target.value) })
                }
                className="w-full accent-[var(--accent)] cursor-pointer mt-2"
              />
            </div>

            <div>
              <label
                htmlFor="shadow-range"
                className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1"
              >
                <span>Đổ bóng</span>
                <span className="font-mono tabular-nums text-[var(--text-primary)]">
                  {style.shadowDepth}px
                </span>
              </label>
              <input
                id="shadow-range"
                type="range"
                min={0}
                max={4}
                step={0.5}
                value={style.shadowDepth}
                onChange={(e) =>
                  onUpdateStyle({ shadowDepth: Number(e.target.value) })
                }
                className="w-full accent-[var(--accent)] cursor-pointer mt-2"
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
