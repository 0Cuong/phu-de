import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  clampSeconds,
  fixOverlappingCues,
  generateASS,
  sortCues,
} from './src/utils/subtitleFormats.ts';
import type {
  SubtitleCue,
  SubtitleStyle,
  TranslationTone,
  VideoResolutionPreset,
} from './src/types/subtitle.ts';

const execFileAsync = promisify(execFile);
const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = process.cwd();
const TEMP_BASE = '/tmp/songngu-studio';
const UPLOAD_DIR = path.join(TEMP_BASE, 'uploads');
const EXPORT_DIR = path.join(TEMP_BASE, 'exports');
const SAMPLE_VIDEO_PATH = path.join(TEMP_BASE, 'sample-studio-12s.mp4');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(EXPORT_DIR, { recursive: true });

// Registry mapping serverVideoId -> local path & metadata
const videoRegistry = new Map<
  string,
  { filePath: string; originalName: string; width: number; height: number; durationSec: number; hasAudio: boolean }
>();

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '.mp4').toLowerCase() || '.mp4';
      const safeExt = /^\.[a-z0-9]{1,6}$/.test(ext) ? ext : '.mp4';
      cb(null, `${crypto.randomUUID()}${safeExt}`);
    },
  }),
  limits: {
    fileSize: 300 * 1024 * 1024, // 300MB limit
  },
});

function createGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Chưa cấu hình GEMINI_API_KEY trong biến môi trường máy chủ.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function probeVideoFile(filePath: string): Promise<{
  width: number;
  height: number;
  durationSec: number;
  hasAudio: boolean;
}> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    filePath,
  ]);
  const info = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: Array<{
      codec_type?: string;
      width?: number;
      height?: number;
      duration?: string;
    }>;
  };
  const videoStream = info.streams?.find((s) => s.codec_type === 'video');
  const audioStream = info.streams?.find((s) => s.codec_type === 'audio');

  const rawDuration =
    Number(info.format?.duration) ||
    Number(videoStream?.duration) ||
    Number(audioStream?.duration) ||
    0;

  return {
    width: videoStream?.width || 1280,
    height: videoStream?.height || 720,
    durationSec: Number.isFinite(rawDuration) ? Math.round(rawDuration * 100) / 100 : 0,
    hasAudio: Boolean(audioStream),
  };
}

async function ensureSampleVideo(): Promise<string> {
  if (fs.existsSync(SAMPLE_VIDEO_PATH) && fs.statSync(SAMPLE_VIDEO_PATH).size > 10000) {
    return SAMPLE_VIDEO_PATH;
  }

  // Generate a clean 12-second 1280x720 studio demo video with gentle motion & audio
  await execFileAsync('ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    'color=c=#0F1624:s=1280x720:d=12:r=30',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=261.63:sample_rate=44100:duration=12',
    '-filter_complex',
    [
      '[0:v]drawbox=x=64:y=64:w=1152:h=592:color=#1E293B@0.85:t=2',
      "drawbox=x='64+mod(t*96,1032)':y=350:w=120:h=6:color=#3B82F6@0.9:t=fill",
      "drawbox=x=64:y=352:w=1152:h=2:color=#334155@0.5:t=fill",
      'format=yuv420p[v]',
      '[1:a]volume=0.03[a]',
    ].join(','),
    '-map',
    '[v]',
    '-map',
    '[a]',
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-crf',
    '23',
    '-c:a',
    'aac',
    '-b:a',
    '96k',
    '-movflags',
    '+faststart',
    SAMPLE_VIDEO_PATH,
  ]);

  return SAMPLE_VIDEO_PATH;
}

function getToneInstruction(tone: TranslationTone): string {
  switch (tone) {
    case 'cinematic':
      return 'Văn phong điện ảnh, giàu cảm xúc, câu thoại tự nhiên, ngắn gọn, giữ sắc thái nhân vật.';
    case 'educational':
      return 'Văn phong học thuật / tài liệu rõ ràng, chính xác thuật ngữ, mạch lạc và dễ tiếp thu.';
    case 'business':
      return 'Văn phong công nghệ / kinh doanh chuyên nghiệp, súc tích, chuẩn thuật ngữ ngành.';
    case 'natural':
    default:
      return 'Văn phong giao tiếp tự nhiên, gần gũi, trôi chảy như người bản xứ nói hàng ngày.';
  }
}

function escapeAssFilterPath(filePath: string): string {
  return filePath
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'");
}

function safeUnlink(filePath: string | undefined): void {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // ignore cleanup failure
  }
}

async function startServer() {
  const app = express();
  // Render and other reverse-proxy hosts forward the original client IP.
  app.set('trust proxy', 1);

  const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (allowedOrigins.includes('*') || allowedOrigins.includes(origin))) {
      res.setHeader(
        'Access-Control-Allow-Origin',
        allowedOrigins.includes('*') ? '*' : origin,
      );
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(express.json({ limit: '10mb' }));

  const createRateLimiter = (maxRequests: number, windowMs: number) => {
    const clients = new Map<string, { count: number; resetAt: number }>();
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const now = Date.now();
      const key = req.ip || req.socket.remoteAddress || 'unknown';
      let entry = clients.get(key);
      if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + windowMs };
        clients.set(key, entry);
      }
      entry.count += 1;
      if (entry.count > maxRequests) {
        res.setHeader('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
        res.status(429).json({ error: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.' });
        return;
      }
      next();
    };
  };

  // Basic per-IP safeguards for public endpoints that consume Gemini/FFmpeg.
  const aiTranscribeLimiter = createRateLimiter(8, 15 * 60 * 1000);
  const aiTranslateLimiter = createRateLimiter(24, 15 * 60 * 1000);
  const exportLimiter = createRateLimiter(8, 15 * 60 * 1000);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, ffmpeg: true, geminiConfigured: Boolean(process.env.GEMINI_API_KEY) });
  });

  app.get('/api/sample-video', async (_req, res) => {
    try {
      const samplePath = await ensureSampleVideo();
      res.setHeader('Content-Type', 'video/mp4');
      res.sendFile(samplePath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể tạo video mẫu.';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/probe-video', upload.single('video'), async (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Thiếu tệp video tải lên.' });
      return;
    }
    try {
      const meta = await probeVideoFile(file.path);
      const serverVideoId = crypto.randomUUID();
      videoRegistry.set(serverVideoId, {
        filePath: file.path,
        originalName: file.originalname || 'video.mp4',
        ...meta,
      });
      res.json({
        serverVideoId,
        ...meta,
      });
    } catch (err) {
      safeUnlink(file.path);
      const msg = err instanceof Error ? err.message : 'Không thể phân tích định dạng video.';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/transcribe', aiTranscribeLimiter, upload.single('video'), async (req, res) => {
    const uploadedFile = req.file;
    let tempAudioPath: string | undefined;
    let uploadedGeminiFileName: string | undefined;
    let aiClient: GoogleGenAI | undefined;

    try {
      const serverVideoIdFromReq =
        typeof req.body?.serverVideoId === 'string' ? req.body.serverVideoId.trim() : '';
      const tone = (req.body?.tone as TranslationTone) || 'natural';
      const contextHint =
        typeof req.body?.contextHint === 'string' ? req.body.contextHint.trim() : '';

      let sourcePath: string;
      let activeVideoId: string;
      let meta: { width: number; height: number; durationSec: number; hasAudio: boolean };

      if (uploadedFile) {
        meta = await probeVideoFile(uploadedFile.path);
        activeVideoId = crypto.randomUUID();
        videoRegistry.set(activeVideoId, {
          filePath: uploadedFile.path,
          originalName: uploadedFile.originalname || 'video.mp4',
          ...meta,
        });
        sourcePath = uploadedFile.path;
      } else if (serverVideoIdFromReq && videoRegistry.has(serverVideoIdFromReq)) {
        const entry = videoRegistry.get(serverVideoIdFromReq)!;
        sourcePath = entry.filePath;
        activeVideoId = serverVideoIdFromReq;
        meta = {
          width: entry.width,
          height: entry.height,
          durationSec: entry.durationSec,
          hasAudio: entry.hasAudio,
        };
      } else {
        res.status(400).json({ error: 'Vui lòng tải video lên trước khi tạo phụ đề AI.' });
        return;
      }

      if (!meta.hasAudio) {
        res.status(400).json({
          error:
            'Video này không có kênh âm thanh để bóc băng. Bạn có thể nhập file .SRT/.VTT hoặc thêm câu phụ đề thủ công.',
        });
        return;
      }

      aiClient = createGeminiClient();

      // Extract clean 16kHz mono MP3 for fast, accurate Gemini multimodal transcription
      tempAudioPath = path.join(UPLOAD_DIR, `${crypto.randomUUID()}.mp3`);
      await execFileAsync('ffmpeg', [
        '-y',
        '-i',
        sourcePath,
        '-vn',
        '-ac',
        '1',
        '-ar',
        '16000',
        '-b:a',
        '64k',
        tempAudioPath,
      ]);

      const audioSize = fs.statSync(tempAudioPath).size;
      const prompt = [
        'Bạn là chuyên gia biên tập và dịch thuật phụ đề song ngữ Anh – Việt chuyên nghiệp.',
        'Hãy nghe toàn bộ âm thanh đính kèm và tạo danh sách phụ đề song ngữ có mốc thời gian chính xác từng phần trăm giây.',
        'Quy tắc bắt buộc:',
        '1. Chia câu phụ đề tự nhiên theo nhịp ngắt nghỉ của người nói (mỗi câu 1–2 dòng ngắn gọn, khoảng 1.5–6 giây, không nhồi quá dài).',
        '2. Mốc startSec và endSec tính bằng giây (ví dụ 1.25, 4.80), không vượt quá tổng thời lượng video, không chồng lấn câu trước.',
        '3. Trường "en" là lời thoại Tiếng Anh chuẩn xác (hoặc bản dịch Tiếng Anh tự nhiên nếu người nói đang nói Tiếng Việt).',
        '4. Trường "vi" là bản dịch Tiếng Việt xuất sắc, đúng ngữ cảnh, không dịch word-by-word máy móc.',
        `5. Phong cách dịch: ${getToneInstruction(tone)}`,
        contextHint ? `6. Ngữ cảnh / thuật ngữ riêng cần lưu ý: ${contextHint}` : '',
        '7. Trường "speaker" ghi tên hoặc vai người nói nếu phân biệt được (ví dụ "Speaker 1", "Host", "Narrator").',
      ]
        .filter(Boolean)
        .join('\n');

      const responseSchema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            startSec: {
              type: Type.NUMBER,
              description: 'Thời điểm bắt đầu câu phụ đề tính bằng giây.',
            },
            endSec: {
              type: Type.NUMBER,
              description: 'Thời điểm kết thúc câu phụ đề tính bằng giây.',
            },
            speaker: {
              type: Type.STRING,
              description: 'Nhãn người nói, ví dụ Speaker 1 hoặc Narrator.',
            },
            en: {
              type: Type.STRING,
              description: 'Nội dung phụ đề Tiếng Anh.',
            },
            vi: {
              type: Type.STRING,
              description: 'Nội dung phụ đề Tiếng Việt tương ứng.',
            },
          },
          required: ['startSec', 'endSec', 'en', 'vi'],
        },
      };

      let mediaPart:
        | { inlineData: { mimeType: string; data: string } }
        | { fileData: { mimeType: string; fileUri: string } };

      if (audioSize <= 12 * 1024 * 1024) {
        const audioBase64 = fs.readFileSync(tempAudioPath).toString('base64');
        mediaPart = {
          inlineData: {
            mimeType: 'audio/mp3',
            data: audioBase64,
          },
        };
      } else {
        const uploadedGeminiFile = await aiClient.files.upload({
          file: tempAudioPath,
          config: { mimeType: 'audio/mp3' },
        });
        uploadedGeminiFileName = uploadedGeminiFile.name;
        if (!uploadedGeminiFile.uri) {
          throw new Error('Không nhận được URI tệp âm thanh từ Gemini Files API.');
        }
        mediaPart = {
          fileData: {
            mimeType: uploadedGeminiFile.mimeType || 'audio/mp3',
            fileUri: uploadedGeminiFile.uri,
          },
        };
      }

      const response = await aiClient.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [mediaPart, { text: prompt }],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          responseMimeType: 'application/json',
          responseSchema,
        },
      });

      const rawText = (response.text ?? '[]').trim();
      const parsed = JSON.parse(rawText) as Array<{
        startSec?: number;
        endSec?: number;
        speaker?: string;
        en?: string;
        vi?: string;
      }>;

      const normalizedCues: SubtitleCue[] = parsed
        .map((item, idx) => {
          const startSec = clampSeconds(Number(item.startSec) || 0);
          const rawEnd = clampSeconds(Number(item.endSec) || startSec + 2);
          const endSec = rawEnd > startSec + 0.25 ? rawEnd : clampSeconds(startSec + 1.5);
          return {
            id: `ai-cue-${idx + 1}-${Date.now()}`,
            startSec,
            endSec: meta.durationSec > 0 ? Math.min(endSec, meta.durationSec) : endSec,
            speaker: item.speaker?.trim() || undefined,
            en: (item.en || '').trim(),
            vi: (item.vi || '').trim(),
          };
        })
        .filter((c) => c.en.length > 0 || c.vi.length > 0);

      const cleanCues = fixOverlappingCues(sortCues(normalizedCues));

      res.json({
        serverVideoId: activeVideoId,
        ...meta,
        cues: cleanCues,
      });
    } catch (err) {
      console.error('Transcribe error:', err);
      const msg = err instanceof Error ? err.message : 'Lỗi khi tạo phụ đề AI.';
      res.status(500).json({ error: msg });
    } finally {
      safeUnlink(tempAudioPath);
      if (aiClient && uploadedGeminiFileName) {
        aiClient.files.delete({ name: uploadedGeminiFileName }).catch(() => {});
      }
    }
  });

  app.post('/api/translate-cues', aiTranslateLimiter, async (req, res) => {
    try {
      const { cues, tone = 'natural', contextHint = '', direction = 'en-to-vi' } = req.body as {
        cues?: SubtitleCue[];
        tone?: TranslationTone;
        contextHint?: string;
        direction?: 'en-to-vi' | 'vi-to-en' | 'polish-both';
      };

      if (!Array.isArray(cues) || cues.length === 0) {
        res.status(400).json({ error: 'Danh sách phụ đề đang trống.' });
        return;
      }

      const ai = createGeminiClient();
      const directionGoal =
        direction === 'vi-to-en'
          ? 'Dịch hoặc chuẩn hóa nội dung từ Tiếng Việt sang Tiếng Anh tự nhiên, giữ nguyên nghĩa gốc.'
          : direction === 'polish-both'
            ? 'Chuốt lại cả câu Tiếng Anh (đúng ngữ pháp/chính tả) và bản dịch Tiếng Việt sao cho mượt mà, đồng bộ ngữ cảnh toàn đoạn.'
            : 'Dịch chính xác và tự nhiên từng câu Tiếng Anh sang Tiếng Việt theo mạch hội thoại chung của toàn bộ video.';

      const payloadForModel = cues.map((c) => ({
        id: c.id,
        speaker: c.speaker || '',
        en: c.en,
        vi: c.vi,
      }));

      const prompt = [
        'Bạn là biên dịch viên phụ đề song ngữ Anh – Việt hàng đầu.',
        directionGoal,
        `Phong cách dịch: ${getToneInstruction(tone)}`,
        contextHint ? `Ngữ cảnh / thuật ngữ riêng: ${contextHint}` : '',
        'Giữ nguyên chính xác trường "id" của từng phần tử và trả về đầy đủ tất cả các phần tử.',
        `Dữ liệu đầu vào:\n${JSON.stringify(payloadForModel)}`,
      ]
        .filter(Boolean)
        .join('\n\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                en: { type: Type.STRING },
                vi: { type: Type.STRING },
              },
              required: ['id', 'en', 'vi'],
            },
          },
        },
      });

      const translated = JSON.parse((response.text ?? '[]').trim()) as Array<{
        id: string;
        en: string;
        vi: string;
      }>;
      const byId = new Map(translated.map((t) => [t.id, t]));

      const merged = cues.map((cue) => {
        const hit = byId.get(cue.id);
        if (!hit) return cue;
        return {
          ...cue,
          en: hit.en.trim() || cue.en,
          vi: hit.vi.trim() || cue.vi,
        };
      });

      res.json({ cues: merged });
    } catch (err) {
      console.error('Translate cues error:', err);
      const msg = err instanceof Error ? err.message : 'Lỗi khi dịch lại phụ đề.';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/export-video', exportLimiter, upload.single('video'), async (req, res) => {
    const uploadedFile = req.file;
    let assFilePath: string | undefined;
    let outputFilePath: string | undefined;

    try {
      const rawCues =
        typeof req.body?.cues === 'string' ? JSON.parse(req.body.cues) : req.body?.cues;
      const rawStyle =
        typeof req.body?.style === 'string' ? JSON.parse(req.body.style) : req.body?.style;
      const sourceMode = typeof req.body?.sourceType === 'string' ? req.body.sourceType : 'upload';
      const serverVideoId =
        typeof req.body?.serverVideoId === 'string' ? req.body.serverVideoId.trim() : '';
      const resolutionPreset =
        (req.body?.resolutionPreset as VideoResolutionPreset) || 'original';

      if (!Array.isArray(rawCues) || rawCues.length === 0) {
        res.status(400).json({ error: 'Không có phụ đề nào để chèn vào video.' });
        return;
      }

      const cues = rawCues as SubtitleCue[];
      const style = rawStyle as SubtitleStyle;

      let inputVideoPath: string;
      let inputMeta: { width: number; height: number; hasAudio: boolean };
      let outputBaseName = 'video_song_ngu';

      if (uploadedFile) {
        inputVideoPath = uploadedFile.path;
        const probed = await probeVideoFile(inputVideoPath);
        inputMeta = probed;
        outputBaseName = path.parse(uploadedFile.originalname || 'video').name;
      } else if (serverVideoId && videoRegistry.has(serverVideoId)) {
        const reg = videoRegistry.get(serverVideoId)!;
        inputVideoPath = reg.filePath;
        inputMeta = { width: reg.width, height: reg.height, hasAudio: reg.hasAudio };
        outputBaseName = path.parse(reg.originalName).name;
      } else if (sourceMode === 'sample') {
        inputVideoPath = await ensureSampleVideo();
        const probed = await probeVideoFile(inputVideoPath);
        inputMeta = probed;
        outputBaseName = 'phude_sample';
      } else {
        res.status(400).json({
          error: 'Không tìm thấy tệp video nguồn trên máy chủ. Vui lòng chọn lại video.',
        });
        return;
      }

      let targetW = inputMeta.width;
      let targetH = inputMeta.height;
      const vfParts: string[] = [];

      if (resolutionPreset === '720p' && inputMeta.height > 720) {
        const ratio = 720 / inputMeta.height;
        targetW = Math.round((inputMeta.width * ratio) / 2) * 2;
        targetH = 720;
        vfParts.push(`scale=${targetW}:${targetH}`);
      }

      const assContent = generateASS(cues, style, targetW, targetH);
      const exportId = crypto.randomUUID();
      assFilePath = path.join(EXPORT_DIR, `${exportId}.ass`);
      outputFilePath = path.join(EXPORT_DIR, `${exportId}.mp4`);
      fs.writeFileSync(assFilePath, assContent, 'utf8');

      vfParts.push(`ass='${escapeAssFilterPath(assFilePath)}'`);

      const ffmpegArgs = [
        '-y',
        '-i',
        inputVideoPath,
        '-vf',
        vfParts.join(','),
        '-c:v',
        'libx264',
        '-preset',
        'fast',
        '-crf',
        '20',
        '-pix_fmt',
        'yuv420p',
      ];

      if (inputMeta.hasAudio) {
        ffmpegArgs.push('-c:a', 'aac', '-b:a', '192k');
      } else {
        ffmpegArgs.push('-an');
      }

      ffmpegArgs.push('-movflags', '+faststart', outputFilePath);

      await execFileAsync('ffmpeg', ffmpegArgs, { maxBuffer: 20 * 1024 * 1024 });

      const cleanBase = outputBaseName.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 48) || 'video';
      const downloadName = `${cleanBase}_phude.mp4`;

      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);

      const stream = fs.createReadStream(outputFilePath);
      stream.on('close', () => {
        safeUnlink(assFilePath);
        safeUnlink(outputFilePath);
        if (uploadedFile) safeUnlink(uploadedFile.path);
      });
      stream.on('error', () => {
        safeUnlink(assFilePath);
        safeUnlink(outputFilePath);
        if (uploadedFile) safeUnlink(uploadedFile.path);
      });
      stream.pipe(res);
    } catch (err) {
      console.error('Export video error:', err);
      safeUnlink(assFilePath);
      safeUnlink(outputFilePath);
      if (uploadedFile) safeUnlink(uploadedFile.path);
      const msg = err instanceof Error ? err.message : 'Lỗi khi render video phụ đề.';
      res.status(500).json({ error: msg });
    }
  });

  // Vite dev middleware or static dist serving
  if (process.env.NODE_ENV === 'production') {
    const distDir = path.join(ROOT_DIR, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Phu De Studio server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
