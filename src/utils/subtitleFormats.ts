import type { CueIssue, LanguageOrder, SubtitleCue, SubtitleStyle } from '../types/subtitle.ts';

function pad2(n: number): string {
  return String(Math.floor(n)).padStart(2, '0');
}

function pad3(n: number): string {
  return String(Math.floor(n)).padStart(3, '0');
}

export function clampSeconds(sec: number): number {
  if (!Number.isFinite(sec) || sec < 0) {
    return 0;
  }
  return Math.round(sec * 1000) / 1000;
}

export function formatTimestampSRT(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const totalMs = Math.round(safe * 1000);
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)},${pad3(ms)}`;
}

export function formatTimestampVTT(seconds: number): string {
  return formatTimestampSRT(seconds).replace(',', '.');
}

export function formatTimestampASS(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const totalCs = Math.round(safe * 100);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);
  return `${h}:${pad2(m)}:${pad2(s)}.${pad2(cs)}`;
}

export function formatTimecodeShort(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const totalTenths = Math.round(safe * 10);
  const tenths = totalTenths % 10;
  const totalSec = Math.floor(totalTenths / 10);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);
  if (h > 0) {
    return `${h}:${pad2(m)}:${pad2(s)}.${tenths}`;
  }
  return `${pad2(m)}:${pad2(s)}.${tenths}`;
}

export function parseTimecodeToSec(raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.');
  if (!trimmed) {
    return null;
  }
  const parts = trimmed.split(':');
  if (parts.length === 1) {
    const val = Number(parts[0]);
    return Number.isFinite(val) && val >= 0 ? clampSeconds(val) : null;
  }
  if (parts.length === 2) {
    const mins = Number(parts[0]);
    const secs = Number(parts[1]);
    if (!Number.isFinite(mins) || !Number.isFinite(secs) || mins < 0 || secs < 0) {
      return null;
    }
    return clampSeconds(mins * 60 + secs);
  }
  if (parts.length === 3) {
    const hrs = Number(parts[0]);
    const mins = Number(parts[1]);
    const secs = Number(parts[2]);
    if (
      !Number.isFinite(hrs) ||
      !Number.isFinite(mins) ||
      !Number.isFinite(secs) ||
      hrs < 0 ||
      mins < 0 ||
      secs < 0
    ) {
      return null;
    }
    return clampSeconds(hrs * 3600 + mins * 60 + secs);
  }
  return null;
}

function hasVietnameseDiacritics(text: string): boolean {
  return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(
    text,
  );
}

function splitBilingualLines(lines: string[]): { en: string; vi: string } {
  const cleaned = lines
    .map((l) => l.replace(/<[^>]+>/g, '').trim())
    .filter(Boolean);
  if (cleaned.length === 0) {
    return { en: '', vi: '' };
  }
  if (cleaned.length === 1) {
    const single = cleaned[0];
    return hasVietnameseDiacritics(single)
      ? { en: '', vi: single }
      : { en: single, vi: '' };
  }
  const viLines: string[] = [];
  const enLines: string[] = [];
  for (const line of cleaned) {
    if (hasVietnameseDiacritics(line)) {
      viLines.push(line);
    } else {
      enLines.push(line);
    }
  }
  if (viLines.length > 0 && enLines.length > 0) {
    return { en: enLines.join(' '), vi: viLines.join(' ') };
  }
  // Fallback: first line EN, remaining lines VI
  return {
    en: cleaned[0],
    vi: cleaned.slice(1).join(' '),
  };
}

export function parseSRT(content: string): SubtitleCue[] {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) {
    return [];
  }
  const blocks = normalized.split(/\n{2,}/);
  const cues: SubtitleCue[] = [];

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trimEnd())
      .filter((l) => l.length > 0);
    if (lines.length < 2) {
      continue;
    }

    let timeLineIdx = lines.findIndex((l) => l.includes('-->'));
    if (timeLineIdx === -1) {
      continue;
    }

    const timeParts = lines[timeLineIdx].split('-->');
    if (timeParts.length < 2) {
      continue;
    }
    const startSec = parseTimecodeToSec(timeParts[0].trim());
    const endRaw = timeParts[1].trim().split(/\s+/)[0];
    const endSec = parseTimecodeToSec(endRaw);
    if (startSec === null || endSec === null || endSec <= startSec) {
      continue;
    }

    const textLines = lines.slice(timeLineIdx + 1);
    const { en, vi } = splitBilingualLines(textLines);
    if (!en && !vi) {
      continue;
    }

    cues.push({
      id: `cue-imp-${cues.length + 1}`,
      startSec,
      endSec,
      en,
      vi,
    });
  }

  return sortCues(cues);
}

export function parseVTT(content: string): SubtitleCue[] {
  const stripped = content
    .replace(/^\uFEFF/, '')
    .replace(/^WEBVTT[^\n]*\n*/i, '');
  return parseSRT(stripped);
}

function buildCueLines(
  cue: SubtitleCue,
  order: LanguageOrder,
  includeSpeaker = false,
): string[] {
  const prefix = includeSpeaker && cue.speaker ? `[${cue.speaker}] ` : '';
  const en = cue.en.trim();
  const vi = cue.vi.trim();

  if (order === 'en-only') {
    return en ? [`${prefix}${en}`] : [];
  }
  if (order === 'vi-only') {
    return vi ? [`${prefix}${vi}`] : [];
  }
  if (order === 'vi-top') {
    const result: string[] = [];
    if (vi) result.push(`${prefix}${vi}`);
    if (en) result.push(en);
    return result;
  }
  // default: en-top
  const result: string[] = [];
  if (en) result.push(`${prefix}${en}`);
  if (vi) result.push(vi);
  return result;
}

export function generateSRT(
  cues: SubtitleCue[],
  order: LanguageOrder = 'en-top',
  includeSpeaker = false,
): string {
  const sorted = sortCues(cues);
  const blocks: string[] = [];
  let index = 1;
  for (const cue of sorted) {
    const lines = buildCueLines(cue, order, includeSpeaker);
    if (lines.length === 0) {
      continue;
    }
    blocks.push(
      `${index}\n${formatTimestampSRT(cue.startSec)} --> ${formatTimestampSRT(cue.endSec)}\n${lines.join('\n')}`,
    );
    index += 1;
  }
  return blocks.join('\n\n') + (blocks.length > 0 ? '\n' : '');
}

export function generateVTT(
  cues: SubtitleCue[],
  order: LanguageOrder = 'en-top',
  includeSpeaker = false,
): string {
  const sorted = sortCues(cues);
  const blocks: string[] = ['WEBVTT'];
  for (const cue of sorted) {
    const lines = buildCueLines(cue, order, includeSpeaker);
    if (lines.length === 0) {
      continue;
    }
    blocks.push(
      `${formatTimestampVTT(cue.startSec)} --> ${formatTimestampVTT(cue.endSec)}\n${lines.join('\n')}`,
    );
  }
  return blocks.join('\n\n') + '\n';
}

/**
 * Converts #RRGGBB and alpha (0 = opaque, 255 = fully transparent in ASS)
 * into ASS &HAABBGGRR format.
 */
export function hexToAssColor(hex: string, opacityPercent = 100): string {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const r = full.slice(0, 2).toUpperCase();
  const g = full.slice(2, 4).toUpperCase();
  const b = full.slice(4, 6).toUpperCase();
  const clampedOpacity = Math.max(0, Math.min(100, opacityPercent));
  const assAlpha = Math.round(((100 - clampedOpacity) / 100) * 255);
  const a = assAlpha.toString(16).padStart(2, '0').toUpperCase();
  return `&H${a}${b}${g}${r}`;
}

function escapeAssText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\r?\n/g, '\\N');
}

export function generateASS(
  cues: SubtitleCue[],
  style: SubtitleStyle,
  videoWidth = 1920,
  videoHeight = 1080,
): string {
  const playResX = Math.max(320, Math.round(videoWidth));
  const playResY = Math.max(240, Math.round(videoHeight));
  const scaleFactor = playResY / 1080;

  const enFontSize = Math.max(14, Math.round(style.enSize * scaleFactor));
  const viFontSize = Math.max(14, Math.round(style.viSize * scaleFactor));
  const marginV = Math.max(12, Math.round((style.marginBottomPct / 100) * playResY));
  const marginLR = Math.max(24, Math.round(playResX * 0.04));
  const alignmentCode = style.alignment === 'top' ? 8 : 2;

  const borderStyle = style.bgEnabled ? 3 : 1;
  const outline = style.bgEnabled
    ? Math.max(4, Math.round(8 * scaleFactor))
    : Math.max(0, Math.round(style.outlineWidth * scaleFactor * 10) / 10);
  const shadow = style.bgEnabled
    ? 0
    : Math.max(0, Math.round(style.shadowDepth * scaleFactor * 10) / 10);

  const backOrOutlineColor = style.bgEnabled
    ? hexToAssColor(style.bgColor, style.bgOpacity)
    : '&H00000000';
  const outlineColor = style.bgEnabled
    ? hexToAssColor(style.bgColor, style.bgOpacity)
    : '&H14000000';

  const enColor = hexToAssColor(style.enColor, 100);
  const viColor = hexToAssColor(style.viColor, 100);
  const fontName = style.fontFamily || 'Noto Sans';

  const header = [
    '[Script Info]',
    'Title: Phu De Bilingual Subtitles',
    'ScriptType: v4.00+',
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    `PlayResX: ${playResX}`,
    `PlayResY: ${playResY}`,
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: English,${fontName},${enFontSize},${enColor},&H000000FF,${outlineColor},${backOrOutlineColor},${style.enBold ? -1 : 0},0,0,0,100,100,0,0,${borderStyle},${outline},${shadow},${alignmentCode},${marginLR},${marginLR},${marginV},1`,
    `Style: Vietnamese,${fontName},${viFontSize},${viColor},&H000000FF,${outlineColor},${backOrOutlineColor},${style.viBold ? -1 : 0},0,0,0,100,100,0,0,${borderStyle},${outline},${shadow},${alignmentCode},${marginLR},${marginLR},${marginV},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];

  const sorted = sortCues(cues);
  const events: string[] = [];

  for (const cue of sorted) {
    const start = formatTimestampASS(cue.startSec);
    const end = formatTimestampASS(cue.endSec);
    const speaker = cue.speaker ? cue.speaker.replace(/,/g, ' ') : '';
    const speakerPrefix =
      style.showSpeaker && cue.speaker ? `[${escapeAssText(cue.speaker)}] ` : '';
    const enText = escapeAssText(cue.en.trim());
    const viText = escapeAssText(cue.vi.trim());

    if (style.languageOrder === 'en-only') {
      if (enText) {
        events.push(`Dialogue: 0,${start},${end},English,${speaker},0,0,0,,${speakerPrefix}${enText}`);
      }
      continue;
    }

    if (style.languageOrder === 'vi-only') {
      if (viText) {
        events.push(`Dialogue: 0,${start},${end},Vietnamese,${speaker},0,0,0,,${speakerPrefix}${viText}`);
      }
      continue;
    }

    // Bilingual stacked inside one Dialogue event using inline {\rStyle} override
    // so libass stacks the two lines cleanly without overlapping boxes!
    const parts: string[] = [];
    if (style.languageOrder === 'vi-top') {
      if (viText) parts.push(`{\\rVietnamese}${speakerPrefix}${viText}`);
      if (enText) parts.push(`{\\rEnglish}${enText}`);
    } else {
      if (enText) parts.push(`{\\rEnglish}${speakerPrefix}${enText}`);
      if (viText) parts.push(`{\\rVietnamese}${viText}`);
    }

    if (parts.length > 0) {
      const baseStyle = style.languageOrder === 'vi-top' ? 'Vietnamese' : 'English';
      events.push(
        `Dialogue: 0,${start},${end},${baseStyle},${speaker},0,0,0,,${parts.join('\\N')}`,
      );
    }
  }

  return header.concat(events).join('\n') + '\n';
}

export function sortCues(cues: SubtitleCue[]): SubtitleCue[] {
  return [...cues].sort((a, b) => a.startSec - b.startSec || a.endSec - b.endSec);
}

function splitTextAtWordBoundary(text: string, ratio: number): [string, string] {
  const trimmed = text.trim();
  if (!trimmed) {
    return ['', ''];
  }
  const words = trimmed.split(/\s+/);
  if (words.length <= 1) {
    return [trimmed, ''];
  }
  const idx = Math.max(1, Math.min(words.length - 1, Math.round(words.length * ratio)));
  return [words.slice(0, idx).join(' '), words.slice(idx).join(' ')];
}

export function splitCueAtTime(
  cue: SubtitleCue,
  splitSec: number,
): [SubtitleCue, SubtitleCue] | null {
  const minSegment = 0.25;
  if (splitSec <= cue.startSec + minSegment || splitSec >= cue.endSec - minSegment) {
    return null;
  }
  const ratio = (splitSec - cue.startSec) / (cue.endSec - cue.startSec);
  const [enA, enB] = splitTextAtWordBoundary(cue.en, ratio);
  const [viA, viB] = splitTextAtWordBoundary(cue.vi, ratio);
  const splitPoint = clampSeconds(splitSec);

  return [
    {
      ...cue,
      endSec: splitPoint,
      en: enA,
      vi: viA,
    },
    {
      id: `${cue.id}-b-${Math.round(splitPoint * 1000)}`,
      startSec: splitPoint,
      endSec: cue.endSec,
      en: enB,
      vi: viB,
      speaker: cue.speaker,
    },
  ];
}

export function mergeCues(first: SubtitleCue, second: SubtitleCue): SubtitleCue {
  return {
    id: first.id,
    startSec: Math.min(first.startSec, second.startSec),
    endSec: Math.max(first.endSec, second.endSec),
    en: [first.en.trim(), second.en.trim()].filter(Boolean).join(' '),
    vi: [first.vi.trim(), second.vi.trim()].filter(Boolean).join(' '),
    speaker: first.speaker || second.speaker,
  };
}

export function shiftAllCues(cues: SubtitleCue[], deltaSec: number): SubtitleCue[] {
  return cues.map((cue) => {
    const duration = Math.max(0.2, cue.endSec - cue.startSec);
    const startSec = clampSeconds(Math.max(0, cue.startSec + deltaSec));
    const endSec = clampSeconds(Math.max(startSec + 0.2, cue.endSec + deltaSec));
    return {
      ...cue,
      startSec,
      endSec: endSec <= startSec ? clampSeconds(startSec + duration) : endSec,
    };
  });
}

export function fixOverlappingCues(cues: SubtitleCue[], gapSec = 0.04): SubtitleCue[] {
  const sorted = sortCues(cues);
  const result: SubtitleCue[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const current = { ...sorted[i] };
    if (current.endSec <= current.startSec + 0.2) {
      current.endSec = clampSeconds(current.startSec + 0.5);
    }
    if (i > 0) {
      const prev = result[i - 1];
      if (prev.endSec > current.startSec - gapSec) {
        const midpoint = clampSeconds((prev.endSec + current.startSec) / 2);
        if (midpoint > prev.startSec + 0.25 && current.endSec > midpoint + 0.25) {
          prev.endSec = clampSeconds(midpoint - gapSec / 2);
          current.startSec = clampSeconds(midpoint + gapSec / 2);
        } else {
          prev.endSec = clampSeconds(Math.max(prev.startSec + 0.2, current.startSec - gapSec));
          if (current.startSec < prev.endSec + gapSec) {
            current.startSec = clampSeconds(prev.endSec + gapSec);
            if (current.endSec <= current.startSec + 0.2) {
              current.endSec = clampSeconds(current.startSec + 0.5);
            }
          }
        }
      }
    }
    result.push(current);
  }
  return result;
}

export function analyzeCueIssues(cues: SubtitleCue[]): CueIssue[] {
  const sorted = sortCues(cues);
  const issues: CueIssue[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const cue = sorted[i];
    const duration = cue.endSec - cue.startSec;

    if (duration < 0.6) {
      issues.push({
        cueId: cue.id,
        type: 'too-short',
        message: `Thời lượng quá ngắn (${duration.toFixed(1)}s)`,
      });
    }

    if (!cue.vi.trim()) {
      issues.push({
        cueId: cue.id,
        type: 'missing-vi',
        message: 'Thiếu phụ đề Tiếng Việt',
      });
    }

    if (!cue.en.trim()) {
      issues.push({
        cueId: cue.id,
        type: 'missing-en',
        message: 'Thiếu phụ đề Tiếng Anh',
      });
    }

    const maxChars = Math.max(cue.en.trim().length, cue.vi.trim().length);
    const cps = duration > 0 ? maxChars / duration : 99;
    if (cps > 26 && maxChars > 18) {
      issues.push({
        cueId: cue.id,
        type: 'too-fast',
        message: `Tốc độ đọc nhanh (${Math.round(cps)} ký tự/giây)`,
      });
    }

    if (i > 0 && cue.startSec < sorted[i - 1].endSec - 0.005) {
      issues.push({
        cueId: cue.id,
        type: 'overlap',
        message: 'Chồng lấn thời gian với câu trước',
      });
    }
  }

  return issues;
}
