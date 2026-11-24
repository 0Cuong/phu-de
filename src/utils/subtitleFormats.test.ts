import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeCueIssues,
  fixOverlappingCues,
  formatTimestampASS,
  formatTimestampSRT,
  formatTimestampVTT,
  generateASS,
  generateSRT,
  generateVTT,
  hexToAssColor,
  mergeCues,
  parseSRT,
  parseTimecodeToSec,
  parseVTT,
  shiftAllCues,
  splitCueAtTime,
} from './subtitleFormats';
import { DEFAULT_SUBTITLE_STYLE, type SubtitleCue } from '../types/subtitle';

test('timestamp formatters and parser roundtrip cleanly', () => {
  assert.equal(formatTimestampSRT(3661.45), '01:01:01,450');
  assert.equal(formatTimestampVTT(65.125), '00:01:05.125');
  assert.equal(formatTimestampASS(65.12), '0:01:05.12');
  assert.equal(parseTimecodeToSec('01:02:03,450'), 3723.45);
  assert.equal(parseTimecodeToSec('02:15.5'), 135.5);
  assert.equal(parseTimecodeToSec('invalid:time:x'), null);
});

test('SRT and VTT export and bilingual import parse correctly', () => {
  const cues: SubtitleCue[] = [
    {
      id: '1',
      startSec: 0.5,
      endSec: 2.5,
      en: 'Hello world',
      vi: 'Xin chào thế giới',
      speaker: 'Host',
    },
    {
      id: '2',
      startSec: 3,
      endSec: 5,
      en: 'Welcome back',
      vi: 'Chào mừng trở lại',
    },
  ];

  const srt = generateSRT(cues, 'en-top', true);
  assert.match(srt, /\[Host\] Hello world\nXin chào thế giới/);

  const parsedSrt = parseSRT(srt);
  assert.equal(parsedSrt.length, 2);
  assert.equal(parsedSrt[0].vi, 'Xin chào thế giới');
  assert.equal(parsedSrt[1].en, 'Welcome back');

  const vtt = generateVTT(cues, 'vi-top');
  assert.match(vtt, /^WEBVTT/);
  const parsedVtt = parseVTT(vtt);
  assert.equal(parsedVtt.length, 2);
  assert.equal(parsedVtt[0].vi, 'Xin chào thế giới');
});

test('ASS color conversion and bilingual dialogue stacking work properly', () => {
  assert.equal(hexToAssColor('#FDE047', 100), '&H0047E0FD');
  assert.equal(hexToAssColor('#000000', 0), '&HFF000000');

  const ass = generateASS(
    [
      {
        id: '1',
        startSec: 1,
        endSec: 4,
        en: 'Focus on the craft.',
        vi: 'Tập trung vào chất lượng.',
      },
    ],
    DEFAULT_SUBTITLE_STYLE,
    1280,
    720,
  );
  assert.match(ass, /PlayResX: 1280/);
  assert.match(ass, /PlayResY: 720/);
  assert.match(ass, /Style: English,Noto Sans/);
  assert.match(ass, /Style: Vietnamese,Noto Sans/);
  assert.match(ass, /\{\\rEnglish\}Focus on the craft\.\\N\{\\rVietnamese\}Tập trung vào chất lượng\./);
});

test('cue splitting, merging, shifting, and overlap fixing behave deterministically', () => {
  const cue: SubtitleCue = {
    id: 'c1',
    startSec: 1,
    endSec: 5,
    en: 'One two three four',
    vi: 'Một hai ba bốn',
  };

  const split = splitCueAtTime(cue, 3);
  assert.ok(split);
  assert.equal(split[0].endSec, 3);
  assert.equal(split[1].startSec, 3);
  assert.equal(split[0].en, 'One two');
  assert.equal(split[1].en, 'three four');

  const merged = mergeCues(split[0], split[1]);
  assert.equal(merged.startSec, 1);
  assert.equal(merged.endSec, 5);
  assert.equal(merged.en, 'One two three four');

  const shifted = shiftAllCues([cue], -2);
  assert.equal(shifted[0].startSec, 0);
  assert.equal(shifted[0].endSec, 3);

  const overlapping: SubtitleCue[] = [
    { id: 'a', startSec: 0, endSec: 3.5, en: 'First', vi: 'Đầu' },
    { id: 'b', startSec: 2.5, endSec: 5, en: 'Second', vi: 'Hai' },
  ];
  const issuesBefore = analyzeCueIssues(overlapping);
  assert.ok(issuesBefore.some((i) => i.type === 'overlap'));

  const fixed = fixOverlappingCues(overlapping);
  assert.ok(fixed[0].endSec < fixed[1].startSec);
  const issuesAfter = analyzeCueIssues(fixed);
  assert.equal(issuesAfter.some((i) => i.type === 'overlap'), false);
});
