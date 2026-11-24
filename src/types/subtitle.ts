export type LanguageOrder = 'en-top' | 'vi-top' | 'en-only' | 'vi-only';

export type TranslationTone = 'natural' | 'cinematic' | 'educational' | 'business';

export type WorkspaceTab = 'editor' | 'style' | 'export';

export type VideoResolutionPreset = 'original' | '720p';

export interface SubtitleCue {
  id: string;
  startSec: number;
  endSec: number;
  en: string;
  vi: string;
  speaker?: string;
}

export interface SubtitleStyle {
  presetId: string;
  languageOrder: LanguageOrder;
  fontFamily: string;
  enSize: number; // Relative font size at 1080p height baseline (px)
  viSize: number;
  enColor: string; // Hex #RRGGBB
  viColor: string; // Hex #RRGGBB
  enBold: boolean;
  viBold: boolean;
  bgEnabled: boolean;
  bgColor: string; // Hex #RRGGBB
  bgOpacity: number; // 0..100
  outlineWidth: number; // 0..6
  shadowDepth: number; // 0..4
  marginBottomPct: number; // 2..30 (% of video height)
  lineGap: number; // px gap between EN and VI
  alignment: 'bottom' | 'top';
  showSpeaker: boolean;
}

export interface VideoInfo {
  sourceType: 'upload' | 'sample';
  fileName: string;
  objectUrl: string;
  serverVideoId?: string;
  width: number;
  height: number;
  durationSec: number;
  hasAudio: boolean;
}

export interface CueIssue {
  cueId: string;
  type: 'overlap' | 'too-fast' | 'too-short' | 'missing-vi' | 'missing-en';
  message: string;
}

export interface StylePreset {
  id: string;
  name: string;
  description: string;
  patch: Partial<SubtitleStyle>;
}

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  presetId: 'cinema',
  languageOrder: 'en-top',
  fontFamily: 'Noto Sans',
  enSize: 40,
  viSize: 44,
  enColor: '#E2E8F0',
  viColor: '#FDE047',
  enBold: false,
  viBold: true,
  bgEnabled: true,
  bgColor: '#090D16',
  bgOpacity: 72,
  outlineWidth: 2,
  shadowDepth: 1,
  marginBottomPct: 6,
  lineGap: 6,
  alignment: 'bottom',
  showSpeaker: false,
};

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'cinema',
    name: 'Điện ảnh Song Ngữ',
    description: 'Tiếng Anh trắng thanh, Tiếng Việt vàng ấm dễ đọc trên mọi khung hình.',
    patch: {
      presetId: 'cinema',
      enColor: '#F1F5F9',
      viColor: '#FDE047',
      enSize: 38,
      viSize: 44,
      enBold: false,
      viBold: true,
      bgEnabled: true,
      bgColor: '#090D16',
      bgOpacity: 72,
      outlineWidth: 2,
      shadowDepth: 1,
      alignment: 'bottom',
      marginBottomPct: 6,
    },
  },
  {
    id: 'youtube',
    name: 'YouTube Học Thuật',
    description: 'Nền hộp tối rõ nét, hai dòng cân bằng cho video giảng dạy và review.',
    patch: {
      presetId: 'youtube',
      enColor: '#FFFFFF',
      viColor: '#93C5FD',
      enSize: 42,
      viSize: 42,
      enBold: true,
      viBold: true,
      bgEnabled: true,
      bgColor: '#000000',
      bgOpacity: 82,
      outlineWidth: 1,
      shadowDepth: 0,
      alignment: 'bottom',
      marginBottomPct: 5,
    },
  },
  {
    id: 'social',
    name: 'Shorts / Reels Nổi Bật',
    description: 'Chữ lớn viền dày không nền hộp, đặt cao tránh thanh công cụ mạng xã hội.',
    patch: {
      presetId: 'social',
      enColor: '#FFFFFF',
      viColor: '#FACC15',
      enSize: 48,
      viSize: 54,
      enBold: true,
      viBold: true,
      bgEnabled: false,
      bgColor: '#000000',
      bgOpacity: 0,
      outlineWidth: 4,
      shadowDepth: 2,
      alignment: 'bottom',
      marginBottomPct: 16,
    },
  },
  {
    id: 'minimal',
    name: 'Tối Giản Trong Suốt',
    description: 'Viền mảnh tinh tế, giữ nguyên độ thoáng cho phim tài liệu và vlog.',
    patch: {
      presetId: 'minimal',
      enColor: '#E2E8F0',
      viColor: '#FFFFFF',
      enSize: 36,
      viSize: 40,
      enBold: false,
      viBold: true,
      bgEnabled: false,
      bgColor: '#000000',
      bgOpacity: 0,
      outlineWidth: 2.5,
      shadowDepth: 2,
      alignment: 'bottom',
      marginBottomPct: 5,
    },
  },
];

export const SAMPLE_CUES: SubtitleCue[] = [
  {
    id: 'cue-1',
    startSec: 0.4,
    endSec: 2.8,
    speaker: 'Narrator',
    en: 'Great subtitles never distract from the story.',
    vi: 'Phụ đề chuẩn mực không bao giờ làm xao nhãng mạch truyện.',
  },
  {
    id: 'cue-2',
    startSec: 2.95,
    endSec: 5.5,
    speaker: 'Narrator',
    en: 'Every word lands right on beat with natural Vietnamese phrasing.',
    vi: 'Từng câu chữ bắt đúng nhịp nói với văn phong Việt tự nhiên.',
  },
  {
    id: 'cue-3',
    startSec: 5.65,
    endSec: 8.3,
    speaker: 'Narrator',
    en: 'Adjust timing, contrast, and typography in real time.',
    vi: 'Tinh chỉnh thời gian, độ tương phản và kiểu chữ theo thời gian thực.',
  },
  {
    id: 'cue-4',
    startSec: 8.45,
    endSec: 11.6,
    speaker: 'Narrator',
    en: 'Then export a crisp bilingual MP4 ready for any screen.',
    vi: 'Sau đó xuất ngay video MP4 song ngữ sắc nét cho mọi màn hình.',
  },
];
