export interface Word {
  text: string
  start: number
  duration: number
}

export interface Line {
  time: number
  text: string
  words: Word[]
  extendedLyrics: string[]
}

export type Lines = Line[]

export interface Options {
  onPlay?: (line: number, text: string) => void
  onSetLyric?: (lines: Lines) => void
  offset?: number
  playbackRate?: number
  isRemoveBlankLine?: boolean
  lyric?: string
  extendedLyrics?: string[]
}