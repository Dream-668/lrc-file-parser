import type { Lines, Options } from '../types/common';
import { tagRegMap } from './utils';
type TagMapKeys = keyof typeof tagRegMap;
type NonNullableOptions = Required<Options>;
interface Tags extends Record<Exclude<TagMapKeys, 'offset'>, string> {
    offset: number;
}
export default class Lyric {
    lyric: NonNullableOptions['lyric'];
    lxlyric: NonNullableOptions['lxlyric'];
    extendedLyrics: NonNullableOptions['extendedLyrics'];
    tags: Tags;
    lines: Lines;
    onPlay: NonNullableOptions['onPlay'];
    onSetLyric: NonNullableOptions['onSetLyric'];
    isPlay: boolean;
    curLineNum: number;
    maxLine: number;
    offset: NonNullableOptions['offset'];
    isRemoveBlankLine: NonNullableOptions['isRemoveBlankLine'];
    private _playbackRate;
    private _performanceTime;
    private _startTime;
    constructor({ lyric, lxlyric, extendedLyrics, offset, playbackRate, onPlay, onSetLyric, isRemoveBlankLine, }: Options);
    private _init;
    private _initTag;
    private _initLines;
    private _currentTime;
    private _findCurLineNum;
    private _handleMaxLine;
    private _refresh;
    play(curTime?: number): void;
    pause(): void;
    setPlaybackRate(playbackRate: NonNullableOptions['playbackRate']): void;
    setLyric(lyric: NonNullableOptions['lyric'], lxlyric?: NonNullableOptions['lxlyric'], extendedLyrics?: NonNullableOptions['extendedLyrics']): void;
}
export type * from '../types/common';
