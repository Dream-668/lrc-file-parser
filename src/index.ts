import type { Line, Lines, Options } from '../types/common'
import { formatTimeLabel, getNow, noop, parseExtendedLyric, parseWordLyric, tagRegMap, timeExp, timeFieldExp, timeoutTools } from './utils'

type TagMapKeys = keyof typeof tagRegMap
type NonNullableOptions = Required<Options>
interface Tags extends Record<Exclude<TagMapKeys, 'offset'>, string> {
  offset: number
}

const tags = {
  title: '',
  artist: '',
  album: '',
  offset: 0,
  by: '',
}

export default class Lyric {
  lyric: NonNullableOptions['lyric']
  lxlyric: NonNullableOptions['lxlyric']
  extendedLyrics: NonNullableOptions['extendedLyrics']
  tags: Tags
  lines: Lines
  onPlay: NonNullableOptions['onPlay']
  onSetLyric: NonNullableOptions['onSetLyric']
  isPlay: boolean
  curLineNum: number
  curWordIndex: number
  curWordProgress: number
  maxLine: number
  offset: NonNullableOptions['offset']
  isRemoveBlankLine: NonNullableOptions['isRemoveBlankLine']
  private _playbackRate: NonNullableOptions['playbackRate']
  private _performanceTime: number
  private _startTime: number

  constructor({
    lyric = '',
    lxlyric = '',
    extendedLyrics = [],
    offset = 150,
    playbackRate = 1,
    onPlay = noop,
    onSetLyric = noop,
    isRemoveBlankLine = true,
  }: Options) {
    this.lyric = lyric
    this.lxlyric = lxlyric
    this.extendedLyrics = extendedLyrics
    this.tags = { ...tags }
    this.lines = []
    this.onPlay = onPlay
    this.onSetLyric = onSetLyric
    this.isPlay = false
    this.curLineNum = 0
    this.curWordIndex = -1
    this.curWordProgress = 0
    this.maxLine = 0
    this.offset = offset
    this.isRemoveBlankLine = isRemoveBlankLine
    this._playbackRate = playbackRate
    this._performanceTime = 0
    this._startTime = 0
    this._init()
  }

  private _init() {
    if (this.lyric == null) this.lyric = ''
    if (this.lxlyric == null) this.lxlyric = ''
    if (this.extendedLyrics == null) this.extendedLyrics = []
    this._initTag()
    this._initLines()
    this.onSetLyric(this.lines)
  }

  private _initTag() {
    this.tags = { ...tags }
    for (let tag of Object.keys(tags) as TagMapKeys[]) {
      const matches = this.lyric.match(new RegExp(`\\[${tagRegMap[tag]}:([^\\]]*)]`, 'i'))
      if (matches) {
        // @ts-expect-error
        this.tags[tag] = matches[1]
      }
    }
    if (this.tags.offset) {
      let offset = parseInt(this.tags.offset as unknown as string)
      this.tags.offset = Number.isNaN(offset) ? 0 : offset
    } else {
      this.tags.offset = 0
    }
  }

  private _initLines() {
    this.lines = []
    const lines = this.lyric.split(/\r\n|\n|\r/)
    const linesMap: Record<string, Line> = {}
    const length = lines.length
    for (let i = 0; i < length; i++) {
      const line = lines[i].trim()
      let result = timeFieldExp.exec(line)
      if (result) {
        const timeField = result[0]
        const text = line.replace(timeFieldExp, '').trim()
        if (text || !this.isRemoveBlankLine) {
          const times = timeField.match(timeExp)
          if (times == null) continue
          for (let time of times) {
            const timeStr = formatTimeLabel(time)
            if (linesMap[timeStr]) {
              linesMap[timeStr].extendedLyrics.push(text)
              continue
            }
            const timeArr = timeStr.split(':')
            if (timeArr.length > 3) continue
            else if (timeArr.length < 3) for (let i = 3 - timeArr.length; i--;) timeArr.unshift('0')
            if (timeArr[2].includes('.')) timeArr.splice(2, 1, ...timeArr[2].split('.'))

            linesMap[timeStr] = {
              time: parseInt(timeArr[0]) * 60 * 60 * 1000 + parseInt(timeArr[1]) * 60 * 1000 + parseInt(timeArr[2]) * 1000 + parseInt(timeArr[3] || '0'),
              text: text,
              words: [],
              extendedLyrics: [],
            }
          }
        }
      }
    }

    if (this.lxlyric) {
      const lxLines = this.lxlyric.split(/\r\n|\n|\r/)
      for (let i = 0; i < lxLines.length; i++) {
        const line = lxLines[i].trim()
        let result = timeFieldExp.exec(line)
        if (result) {
          const timeField = result[0]
          const rawText = line.replace(timeFieldExp, '').trim()
          if (rawText) {
            const times = timeField.match(timeExp)
            if (times == null) continue
            for (let time of times) {
              const timeStr = formatTimeLabel(time)
              const targetLine = linesMap[timeStr]
              if (targetLine) {
                const { words, pureText } = parseWordLyric(rawText)
                targetLine.words = words
                targetLine.text = pureText
              }
            }
          }
        }
      }
    }

    for (const lrc of this.extendedLyrics) parseExtendedLyric(linesMap, lrc)
    this.lines = Object.values(linesMap)
    this.lines.sort((a, b) => a.time - b.time)
    this.maxLine = this.lines.length - 1
  }

  private _currentTime() {
    return (getNow() - this._performanceTime) * this._playbackRate + this._startTime
  }

  private _findCurLineNum(curTime: number, startIndex = 0) {
    if (curTime <= 0) return 0
    const length = this.lines.length
    for (let index = startIndex; index < length; index++) if (curTime <= this.lines[index].time) return index === 0 ? 0 : index - 1
    return length - 1
  }

  private _getWordState(line: Line, currentTime: number): { index: number; progress: number } {
    if (!line.words.length) return { index: -1, progress: 0 }
    const elapsed = currentTime - line.time
    if (elapsed <= 0) return { index: -1, progress: 0 }
    for (let i = 0; i < line.words.length; i++) {
      const w = line.words[i]
      const wordStart = w.start
      const wordEnd = w.start + w.duration
      if (elapsed < wordStart) {
        return { index: i - 1, progress: 1 }
      }
      if (elapsed <= wordEnd) {
        const progress = w.duration > 0 ? (elapsed - wordStart) / w.duration : 1
        return { index: i, progress: Math.min(Math.max(progress, 0), 1) }
      }
    }
    return { index: line.words.length - 1, progress: 1 }
  }

  private _handleMaxLine() {
    this.curWordIndex = -1
    this.curWordProgress = 0
    this.onPlay(this.curLineNum, this.lines[this.curLineNum].text, -1, 0)
    this.pause()
  }

  private _refresh() {
    this.curLineNum++
    if (this.curLineNum >= this.maxLine) { this._handleMaxLine(); return }

    let curLine = this.lines[this.curLineNum]

    const currentTime = this._currentTime()
    const driftTime = currentTime - curLine.time

    if (driftTime >= 0 || this.curLineNum === 0) {
      let nextLine = this.lines[this.curLineNum + 1]
      const delay = (nextLine.time - curLine.time - driftTime) / this._playbackRate

      if (delay > 0) {
        if (this.isPlay) {
          timeoutTools.start(() => {
            if (!this.isPlay) return
            this._refresh()
          }, delay)
        }
        const { index, progress } = this._getWordState(curLine, currentTime)
        this.curWordIndex = index
        this.curWordProgress = progress
        this.onPlay(this.curLineNum, curLine.text, this.curWordIndex, this.curWordProgress)
      } else {
        let newCurLineNum = this._findCurLineNum(currentTime, this.curLineNum + 1)
        if (newCurLineNum > this.curLineNum) this.curLineNum = newCurLineNum - 1
        this._refresh()
      }
      return
    }

    this.curLineNum = this._findCurLineNum(currentTime, this.curLineNum) - 1
    this._refresh()
  }

  play(curTime = 0) {
    if (!this.lines.length) return
    this.pause()
    this.isPlay = true

    this._performanceTime = getNow() - Math.trunc(this.tags.offset + this.offset)
    this._startTime = curTime

    this.curLineNum = this._findCurLineNum(this._currentTime()) - 1

    this._refresh()
  }

  pause() {
    if (!this.isPlay) return
    this.isPlay = false
    timeoutTools.clear()
    if (this.curLineNum === this.maxLine) return
    const curTime = this._currentTime()
    const curLineNum = this._findCurLineNum(curTime)
    if (this.curLineNum !== curLineNum) {
      this.curLineNum = curLineNum
      const line = this.lines[curLineNum]
      const { index, progress } = this._getWordState(line, curTime)
      this.curWordIndex = index
      this.curWordProgress = progress
      this.onPlay(curLineNum, line.text, this.curWordIndex, this.curWordProgress)
    } else {
      const line = this.lines[this.curLineNum]
      const { index, progress } = this._getWordState(line, curTime)
      if (index !== this.curWordIndex || progress !== this.curWordProgress) {
        this.curWordIndex = index
        this.curWordProgress = progress
        this.onPlay(this.curLineNum, line.text, this.curWordIndex, this.curWordProgress)
      }
    }
  }

  setPlaybackRate(playbackRate: NonNullableOptions['playbackRate']) {
    this._playbackRate = playbackRate
    if (!this.lines.length) return
    if (!this.isPlay) return
    this.play(this._currentTime())
  }

  setLyric(lyric: NonNullableOptions['lyric'], lxlyric: NonNullableOptions['lxlyric'] = '', extendedLyrics: NonNullableOptions['extendedLyrics'] = []) {
    if (this.isPlay) this.pause()
    this.lyric = lyric
    this.lxlyric = lxlyric
    this.extendedLyrics = extendedLyrics
    this.curWordIndex = -1
    this.curWordProgress = 0
    this._init()
  }
}

export type * from '../types/common'