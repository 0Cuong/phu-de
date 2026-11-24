import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExportPanel } from './components/ExportPanel';
import { SettingsModal, type AppTheme } from './components/SettingsModal';
import { StylePanel } from './components/StylePanel';
import { SubtitleEditorPanel } from './components/SubtitleEditorPanel';
import { TimelineStrip } from './components/TimelineStrip';
import { TopBar } from './components/TopBar';
import { UploadStage } from './components/UploadStage';
import { VideoStage } from './components/VideoStage';
import {
  DEFAULT_SUBTITLE_STYLE,
  SAMPLE_CUES,
  type SubtitleCue,
  type SubtitleStyle,
  type TranslationTone,
  type VideoInfo,
  type VideoResolutionPreset,
  type WorkspaceTab,
} from './types/subtitle';
import { ensureGsapRegistered, gsap, prefersReducedMotion } from './utils/motion';
import { apiUrl, isApiConfigured, apiUnavailableMessage } from './utils/api';
import {
  analyzeCueIssues,
  clampSeconds,
  fixOverlappingCues,
  mergeCues,
  parseSRT,
  parseVTT,
  shiftAllCues,
  sortCues,
  splitCueAtTime,
} from './utils/subtitleFormats';

function readInitialTheme(): AppTheme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = localStorage.getItem('0cuong-theme');
    return saved === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export default function App() {
  const [theme, setTheme] = useState<AppTheme>(readInitialTheme);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('editor');
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [style, setStyle] = useState<SubtitleStyle>(DEFAULT_SUBTITLE_STYLE);
  const [selectedCueId, setSelectedCueId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const [tone, setTone] = useState<TranslationTone>('natural');
  const [contextHint, setContextHint] = useState('');

  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [isProbingVideo, setIsProbingVideo] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [isExportingMp4, setIsExportingMp4] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportedMp4Url, setExportedMp4Url] = useState<string | null>(null);
  const [exportedMp4Name, setExportedMp4Name] = useState<string | null>(null);

  const appRootRef = useRef<HTMLDivElement | null>(null);
  const panelContentRef = useRef<HTMLDivElement | null>(null);
  const hasAnimatedHeaderRef = useRef(false);
  const hasAnimatedWorkspaceRef = useRef(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const uploadedFileRef = useRef<File | null>(null);
  const hiddenFileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync theme class on <html> and persist preference
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('0cuong-theme', theme);
    } catch {
      // ignore storage failure
    }
  }, [theme]);

  // Initial header entrance animation (runs once)
  useEffect(() => {
    if (hasAnimatedHeaderRef.current || !appRootRef.current) return;
    hasAnimatedHeaderRef.current = true;
    ensureGsapRegistered();
    if (prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '[data-entrance="header"]',
        { opacity: 0, y: -8 },
        { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', clearProps: 'transform' },
      );
    }, appRootRef);
    return () => ctx.revert();
  }, []);

  // Workspace entrance animation when video first loads (runs once per workspace open)
  useEffect(() => {
    if (!videoInfo) {
      hasAnimatedWorkspaceRef.current = false;
      return;
    }
    if (hasAnimatedWorkspaceRef.current) return;
    hasAnimatedWorkspaceRef.current = true;
    ensureGsapRegistered();
    if (prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '[data-entrance="workspace-pane"]',
        { opacity: 0, y: 10 },
        {
          opacity: 1,
          y: 0,
          duration: 0.48,
          stagger: 0.06,
          ease: 'power3.out',
          clearProps: 'transform',
        },
      );
    }, appRootRef);
    return () => ctx.revert();
  }, [videoInfo]);

  // Controlled subtle panel transition on tab switch
  useEffect(() => {
    if (!videoInfo || !panelContentRef.current) return;
    ensureGsapRegistered();
    if (prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        panelContentRef.current,
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out', clearProps: 'transform' },
      );
    });
    return () => ctx.revert();
  }, [activeTab, videoInfo]);

  const issues = useMemo(() => analyzeCueIssues(cues), [cues]);

  const activeCueAtPlayhead = useMemo(
    () =>
      cues.find(
        (cue) => currentTime >= cue.startSec && currentTime <= cue.endSec,
      ) || null,
    [cues, currentTime],
  );

  const canSplitActiveCue = useMemo(() => {
    if (!activeCueAtPlayhead) return false;
    return (
      currentTime > activeCueAtPlayhead.startSec + 0.25 &&
      currentTime < activeCueAtPlayhead.endSec - 0.25
    );
  }, [activeCueAtPlayhead, currentTime]);

  const loadSampleVideo = useCallback(async (customCues?: SubtitleCue[]) => {
    setUploadError(null);
    setAiError(null);
    setExportError(null);
    setIsLoadingSample(true);
    try {
      const sampleUrl = isApiConfigured
        ? apiUrl('/api/sample-video')
        : `${import.meta.env.BASE_URL}sample-studio-12s.mp4`;
      const resp = await fetch(sampleUrl);
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Không thể tải video mẫu.');
      }
      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);
      uploadedFileRef.current = null;
      setVideoInfo((prev) => {
        if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl);
        return {
          sourceType: 'sample',
          fileName: 'phude_demo_12s.mp4',
          objectUrl,
          width: 1280,
          height: 720,
          durationSec: 12,
          hasAudio: true,
        };
      });
      const initialCues = customCues && customCues.length > 0 ? customCues : SAMPLE_CUES;
      setCues(initialCues);
      setSelectedCueId(initialCues[0]?.id || null);
      setCurrentTime(0.8);
      setIsPlaying(false);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Lỗi khi tải video mẫu.',
      );
    } finally {
      setIsLoadingSample(false);
    }
  }, []);

  // Support ?autostart=1 to jump straight into sample workspace
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      loadSampleVideo();
    }
  }, [loadSampleVideo]);

  // Smoothly sync playhead time during playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let rafId = 0;
    const syncTime = () => {
      setCurrentTime(video.currentTime);
      if (!video.paused && !video.ended) {
        rafId = requestAnimationFrame(syncTime);
      }
    };

    const onPlay = () => {
      setIsPlaying(true);
      rafId = requestAnimationFrame(syncTime);
    };
    const onPause = () => {
      setIsPlaying(false);
      cancelAnimationFrame(rafId);
      setCurrentTime(video.currentTime);
    };
    const onEnded = () => {
      setIsPlaying(false);
      cancelAnimationFrame(rafId);
      setCurrentTime(video.currentTime);
    };
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    video.addEventListener('timeupdate', onTimeUpdate);

    return () => {
      cancelAnimationFrame(rafId);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('timeupdate', onTimeUpdate);
    };
  }, [videoInfo?.objectUrl]);

  const handleTogglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, []);

  const handleSeek = useCallback((timeSec: number) => {
    const clamped = Math.max(0, timeSec);
    setCurrentTime(clamped);
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
  }, []);

  const handleSplitActiveCue = useCallback(() => {
    if (!activeCueAtPlayhead) return;
    const result = splitCueAtTime(activeCueAtPlayhead, currentTime);
    if (!result) return;
    setCues((prev) =>
      sortCues(
        prev.flatMap((c) => (c.id === activeCueAtPlayhead.id ? result : [c])),
      ),
    );
    setSelectedCueId(result[1].id);
  }, [activeCueAtPlayhead, currentTime]);

  // Keyboard shortcuts: Space (play/pause), Left/Right (±0.5s), S (split cue)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSettingsOpen || !videoInfo) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target?.isContentEditable
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleSeek(Math.max(0, currentTime - 0.5));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleSeek(Math.min(videoInfo.durationSec || 600, currentTime + 0.5));
      } else if (e.code === 'KeyS' && canSplitActiveCue) {
        e.preventDefault();
        handleSplitActiveCue();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    canSplitActiveCue,
    currentTime,
    handleSeek,
    handleSplitActiveCue,
    handleTogglePlay,
    isSettingsOpen,
    videoInfo,
  ]);

  const handleSelectVideoFile = async (file: File) => {
    setIsProbingVideo(true);
    setUploadError(null);
    setAiError(null);
    setExportError(null);

    const objectUrl = URL.createObjectURL(file);
    uploadedFileRef.current = file;

    let probed = {
      serverVideoId: undefined as string | undefined,
      width: 1280,
      height: 720,
      durationSec: 0,
      hasAudio: true,
    };

    // A static GitHub Pages frontend can still preview and edit local videos.
    // Server-side probing is an enhancement used when the API is configured.
    if (isApiConfigured) {
      try {
        const formData = new FormData();
        formData.append('video', file);
        const resp = await fetch(apiUrl('/api/probe-video'), {
          method: 'POST',
          body: formData,
        });
        if (resp.ok) {
          probed = await resp.json();
        } else {
          const errorData = await resp.json().catch(() => ({}));
          setUploadError(
            errorData.error || 'Không thể phân tích video trên máy chủ. Video vẫn được mở để biên tập cục bộ.',
          );
        }
      } catch {
        setUploadError(
          'Không kết nối được máy chủ xử lý. Video vẫn được mở để xem, biên tập và xuất phụ đề rời; tính năng AI và render MP4 cần backend.',
        );
      }
    }

    setVideoInfo((prev) => {
      if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl);
      return {
        sourceType: 'upload',
        fileName: file.name,
        objectUrl,
        serverVideoId: probed.serverVideoId,
        width: probed.width || 1280,
        height: probed.height || 720,
        durationSec: probed.durationSec || 0,
        hasAudio: probed.hasAudio,
      };
    });

    setCues((prevCues) => (prevCues === SAMPLE_CUES ? [] : prevCues));
    setCurrentTime(0);
    setIsPlaying(false);
    setIsProbingVideo(false);
  };

  const handleImportSubtitleFile = async (file: File) => {
    setUploadError(null);
    setAiError(null);
    try {
      const text = await file.text();
      const lower = file.name.toLowerCase();
      const parsed = lower.endsWith('.vtt') ? parseVTT(text) : parseSRT(text);
      if (parsed.length === 0) {
        throw new Error(
          'Không tìm thấy câu phụ đề hợp lệ trong tệp SRT/VTT này.',
        );
      }

      if (!videoInfo) {
        await loadSampleVideo(parsed);
      } else {
        setCues(parsed);
        setSelectedCueId(parsed[0].id);
        handleSeek(parsed[0].startSec);
      }
      setActiveTab('editor');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Không thể đọc tệp phụ đề.';
      if (!videoInfo) {
        setUploadError(msg);
      } else {
        setAiError(msg);
      }
    }
  };

  const handleRunAiTranscribe = async () => {
    if (!videoInfo) return;
    if (!isApiConfigured) {
      setAiError(apiUnavailableMessage('Nhận dạng và dịch phụ đề AI'));
      return;
    }
    setIsTranscribing(true);
    setAiError(null);
    try {
      const formData = new FormData();
      formData.append('tone', tone);
      formData.append('contextHint', contextHint);

      if (videoInfo.serverVideoId) {
        formData.append('serverVideoId', videoInfo.serverVideoId);
      } else if (uploadedFileRef.current) {
        formData.append('video', uploadedFileRef.current);
      } else if (videoInfo.sourceType === 'sample') {
        const sampleResp = await fetch(apiUrl('/api/sample-video'));
        const blob = await sampleResp.blob();
        formData.append('video', new File([blob], 'sample.mp4', { type: 'video/mp4' }));
      }

      const resp = await fetch(apiUrl('/api/transcribe'), {
        method: 'POST',
        body: formData,
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Tạo phụ đề tự động thất bại.');
      }

      if (data.serverVideoId) {
        setVideoInfo((prev) =>
          prev
            ? {
                ...prev,
                serverVideoId: data.serverVideoId,
                width: data.width || prev.width,
                height: data.height || prev.height,
                durationSec: data.durationSec || prev.durationSec,
              }
            : prev,
        );
      }

      const nextCues = (data.cues || []) as SubtitleCue[];
      if (nextCues.length === 0) {
        throw new Error(
          'Không nhận diện được lời thoại trong video này. Bạn có thể nhập SRT hoặc thêm câu thủ công.',
        );
      }
      setCues(nextCues);
      setSelectedCueId(nextCues[0]?.id || null);
      handleSeek(nextCues[0]?.startSec || 0);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Lỗi khi bóc băng tự động.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleRunAiRetranslate = async (
    direction: 'en-to-vi' | 'vi-to-en' | 'polish-both',
  ) => {
    if (cues.length === 0) return;
    if (!isApiConfigured) {
      setAiError(apiUnavailableMessage('Dịch lại bằng AI'));
      return;
    }
    setIsTranslating(true);
    setAiError(null);
    try {
      const resp = await fetch(apiUrl('/api/translate-cues'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cues,
          tone,
          contextHint,
          direction,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Dịch lại phụ đề thất bại.');
      }
      setCues(data.cues as SubtitleCue[]);
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : 'Lỗi khi dịch lại phụ đề.',
      );
    } finally {
      setIsTranslating(false);
    }
  };

  const handleUpdateCue = (cueId: string, patch: Partial<SubtitleCue>) => {
    setCues((prev) =>
      sortCues(
        prev.map((c) => (c.id === cueId ? { ...c, ...patch } : c)),
      ),
    );
  };

  const handleDeleteCue = (cueId: string) => {
    setCues((prev) => prev.filter((c) => c.id !== cueId));
    if (selectedCueId === cueId) {
      setSelectedCueId(null);
    }
  };

  const handleMergeWithNext = (cueId: string) => {
    setCues((prev) => {
      const idx = prev.findIndex((c) => c.id === cueId);
      if (idx === -1 || idx >= prev.length - 1) return prev;
      const merged = mergeCues(prev[idx], prev[idx + 1]);
      return [...prev.slice(0, idx), merged, ...prev.slice(idx + 2)];
    });
  };

  const handleAddCueAtTime = (timeSec: number) => {
    const startSec = clampSeconds(timeSec);
    const maxDuration = videoInfo?.durationSec || 600;
    const endSec = clampSeconds(Math.min(maxDuration, startSec + 2.5));
    const finalEnd = endSec > startSec + 0.3 ? endSec : clampSeconds(startSec + 1.5);
    const newCue: SubtitleCue = {
      id: `cue-${Date.now()}`,
      startSec,
      endSec: finalEnd,
      en: 'New English line',
      vi: 'Câu phụ đề Tiếng Việt mới',
    };
    setCues((prev) => sortCues([...prev, newCue]));
    setSelectedCueId(newCue.id);
    setActiveTab('editor');
  };

  const handleShiftAllCues = (deltaSec: number) => {
    setCues((prev) => shiftAllCues(prev, deltaSec));
  };

  const handleFixOverlaps = () => {
    setCues((prev) => fixOverlappingCues(prev));
  };

  const handleExportMp4 = async (resolutionPreset: VideoResolutionPreset) => {
    if (!videoInfo || cues.length === 0) return;
    if (!isApiConfigured) {
      setExportError(apiUnavailableMessage('Render video MP4'));
      return;
    }
    setIsExportingMp4(true);
    setExportError(null);

    try {
      const formData = new FormData();
      formData.append('cues', JSON.stringify(cues));
      formData.append('style', JSON.stringify(style));
      formData.append('resolutionPreset', resolutionPreset);
      formData.append('sourceType', videoInfo.sourceType);

      if (videoInfo.serverVideoId) {
        formData.append('serverVideoId', videoInfo.serverVideoId);
      } else if (uploadedFileRef.current) {
        formData.append('video', uploadedFileRef.current);
      }

      const resp = await fetch(apiUrl('/api/export-video'), {
        method: 'POST',
        body: formData,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Render video MP4 thất bại.');
      }

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const base = videoInfo.fileName.replace(/\.[^/.]+$/, '') || 'video';
      const fileName = `${base}_phude.mp4`;

      setExportedMp4Url((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setExportedMp4Name(fileName);

      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : 'Lỗi khi xuất video MP4.',
      );
    } finally {
      setIsExportingMp4(false);
    }
  };

  return (
    <div
      ref={appRootRef}
      data-state={videoInfo ? 'workspace' : 'upload'}
      data-theme={theme}
      className="min-h-screen lg:h-screen flex flex-col bg-[var(--bg-main)] text-[var(--text-primary)] lg:overflow-hidden"
    >
      <TopBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hasVideo={Boolean(videoInfo)}
        isExporting={isExportingMp4}
        theme={theme}
        onToggleTheme={() =>
          setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
        }
        onOpenSettings={() => setIsSettingsOpen(true)}
        onBrandClick={() => setActiveTab('editor')}
        onPrimaryExportClick={() => {
          setActiveTab('export');
          if (videoInfo && cues.length > 0 && !isExportingMp4) {
            handleExportMp4('original');
          }
        }}
      />

      {!isApiConfigured && (
        <div
          role="status"
          className="mx-3 mt-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-xs leading-relaxed text-[var(--text-secondary)] sm:mx-4"
        >
          <strong className="text-[var(--text-primary)]">Chế độ GitHub Pages:</strong>{' '}
          Bạn có thể tải video lên, xem trước, biên tập và xuất SRT/VTT/ASS. Để bật tạo/dịch phụ đề AI và render MP4, cần triển khai backend và đặt biến{' '}
          <code className="font-mono">VITE_API_BASE_URL</code>.
        </div>
      )}

      {!videoInfo ? (
        <UploadStage
          onSelectVideoFile={handleSelectVideoFile}
          onLoadSampleVideo={() => loadSampleVideo()}
          onImportSubtitleFile={handleImportSubtitleFile}
          isLoadingSample={isLoadingSample}
          isProbingVideo={isProbingVideo}
          errorMessage={uploadError}
        />
      ) : (
        <main className="flex-1 flex flex-col lg:flex-row min-h-0">
          {/* Left / Center Stage: Video Player + Visual Timeline */}
          <div
            data-entrance="workspace-pane"
            className="flex-1 flex flex-col min-w-0 min-h-0 lg:border-r border-[var(--border-subtle)]"
          >
            <VideoStage
              videoInfo={videoInfo}
              videoRef={videoRef}
              cues={cues}
              style={style}
              currentTime={currentTime}
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              onSeek={handleSeek}
              onChangeVideoClick={() => hiddenFileInputRef.current?.click()}
              onSelectCue={(id) => {
                setSelectedCueId(id);
                setActiveTab('editor');
              }}
              onLoadedMetadata={(durationSec, width, height) => {
                setVideoInfo((prev) =>
                  prev
                    ? {
                        ...prev,
                        durationSec: durationSec || prev.durationSec,
                        width: width || prev.width,
                        height: height || prev.height,
                      }
                    : prev,
                );
              }}
            />

            <TimelineStrip
              durationSec={videoInfo.durationSec}
              currentTime={currentTime}
              cues={cues}
              selectedCueId={selectedCueId}
              onSeek={handleSeek}
              onSelectCue={(id) => {
                setSelectedCueId(id);
                setActiveTab('editor');
              }}
              onAddCueAtTime={handleAddCueAtTime}
              onSplitActiveCue={handleSplitActiveCue}
              onShiftAllCues={handleShiftAllCues}
              canSplitActiveCue={canSplitActiveCue}
            />
          </div>

          {/* Right Inspector: Editor / Style / Export */}
          <aside
            data-entrance="workspace-pane"
            aria-label="Bảng điều khiển phụ đề"
            className="w-full lg:w-[430px] xl:w-[470px] shrink-0 flex flex-col min-h-0 bg-[var(--bg-secondary)] border-t lg:border-t-0 border-[var(--border-subtle)]"
          >
            {/* Mobile / Tablet Quick Panel Switcher (< md) */}
            <div className="md:hidden px-3 py-2 border-b border-[var(--border-subtle)] flex items-center gap-1.5 bg-[var(--bg-secondary)]">
              {(
                [
                  { id: 'editor', label: `Phụ đề (${cues.length})` },
                  { id: 'style', label: 'Kiểu chữ' },
                  { id: 'export', label: 'Xuất file' },
                ] as Array<{ id: WorkspaceTab; label: string }>
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 min-h-[44px] px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-[var(--accent)] text-[var(--accent-fg)]'
                      : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div ref={panelContentRef} className="flex-1 min-h-0">
              {activeTab === 'editor' && (
                <SubtitleEditorPanel
                  cues={cues}
                  issues={issues}
                  selectedCueId={selectedCueId}
                  currentTime={currentTime}
                  hasAudio={videoInfo.hasAudio}
                  tone={tone}
                  contextHint={contextHint}
                  isTranscribing={isTranscribing}
                  isTranslating={isTranslating}
                  aiError={aiError}
                  onToneChange={setTone}
                  onContextHintChange={setContextHint}
                  onRunAiTranscribe={handleRunAiTranscribe}
                  onRunAiRetranslate={handleRunAiRetranslate}
                  onImportSubtitleFile={handleImportSubtitleFile}
                  onSelectCue={setSelectedCueId}
                  onSeek={handleSeek}
                  onUpdateCue={handleUpdateCue}
                  onDeleteCue={handleDeleteCue}
                  onMergeWithNext={handleMergeWithNext}
                  onAddCue={() => handleAddCueAtTime(currentTime)}
                  onFixOverlaps={handleFixOverlaps}
                />
              )}

              {activeTab === 'style' && (
                <StylePanel
                  style={style}
                  onUpdateStyle={(patch) =>
                    setStyle((prev) => ({ ...prev, ...patch }))
                  }
                />
              )}

              {activeTab === 'export' && (
                <ExportPanel
                  videoInfo={videoInfo}
                  cues={cues}
                  style={style}
                  isExportingMp4={isExportingMp4}
                  exportError={exportError}
                  exportedMp4Url={exportedMp4Url}
                  exportedMp4Name={exportedMp4Name}
                  onExportMp4={handleExportMp4}
                />
              )}
            </div>

            <div className="px-4 py-2 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
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
                onClick={() => setIsSettingsOpen(true)}
                className="hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                Cài đặt & Phím tắt
              </button>
            </div>
          </aside>
        </main>
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        theme={theme}
        onThemeChange={setTheme}
        onClose={() => setIsSettingsOpen(false)}
      />

      <input
        ref={hiddenFileInputRef}
        type="file"
        accept="video/*,.mp4,.webm,.mov,.mkv,.m4v"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleSelectVideoFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
