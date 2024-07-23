import { basename, extname } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { FileInfo } from '@nx-audiobook/file-walk'

import { validateFilesAllAccountedFor } from './validators'

// utility
function fileInfoFromPath(filePath: string): FileInfo {
  return {
    path: filePath,
    basename: basename(filePath),
    extension: extname(filePath),
    size: 0,
    mtime: new Date(0),
  }
}

describe('validateFilesAllAccountedFor', () => {
  it('validate empty file list', () => {
    expect(validateFilesAllAccountedFor([])).toEqual({
      ok: true,
      level: 'info',
      message: 'All accounted for',
      extra: {
        total: 0,
        ignored: 0,
        audio: 0,
        ebook: 0,
        allowed: 0,
        unaccounted: [],
      },
    })
  })
  it('validate 2 audio file list', () => {
    expect(
      validateFilesAllAccountedFor(
        ['/path/file1.mp3', '/path/file2.mp3'].map(fileInfoFromPath)
      )
    ).toEqual({
      ok: true,
      level: 'info',
      message: 'All accounted for',
      extra: {
        total: 2,
        ignored: 0,
        audio: 2,
        ebook: 0,
        allowed: 0,
        unaccounted: [],
      },
    })
  })
  it('validate 2 audio file list with 2 known-named-ignored files', () => {
    expect(
      validateFilesAllAccountedFor(
        [
          '/path/file1.mp3',
          '/path/file2.mp3',
          '/path/.DS_Store',
          '/path/MD5SUM',
        ].map(fileInfoFromPath)
      )
    ).toEqual({
      ok: true,
      level: 'info',
      message: 'All accounted for',
      extra: {
        total: 4,
        ignored: 2,
        audio: 2,
        ebook: 0,
        allowed: 0,
        unaccounted: [],
      },
    })
  })
  it('validate 1 audio file list with 2 allowed files and 2 ebooks', () => {
    expect(
      validateFilesAllAccountedFor(
        [
          '/path/book.m4b',
          '/path/cover.jpg',
          '/path/metadata.json',
          '/path/book.epub',
          '/path/book.pdf',
        ].map(fileInfoFromPath)
      )
    ).toEqual({
      ok: true,
      level: 'info',
      message: 'All accounted for',
      extra: {
        total: 5,
        ignored: 0,
        audio: 1,
        ebook: 2,
        allowed: 2,
        unaccounted: [],
      },
    })
  })

  it('reject unknown file name (no extension)', () => {
    expect(
      validateFilesAllAccountedFor(
        ['/path/file1.mp3', '/path/file1.mp3', '/path/README'].map(
          fileInfoFromPath
        )
      )
    ).toEqual({
      ok: false,
      level: 'warn',
      message: 'Have unaccounted for files',
      extra: {
        total: 3,
        ignored: 0,
        audio: 2,
        ebook: 0,
        allowed: 0,
        unaccounted: ['/path/README'],
      },
    })
  })

  it('reject an unknown file extension', () => {
    expect(
      validateFilesAllAccountedFor(['/path/file.unknown'].map(fileInfoFromPath))
    ).toEqual({
      ok: false,
      level: 'warn',
      message: 'Have unaccounted for files',
      extra: {
        total: 1,
        ignored: 0,
        audio: 0,
        ebook: 0,
        allowed: 0,
        unaccounted: ['/path/file.unknown'],
      },
    })
  })

  it('reject a non cover image', () => {
    expect(
      validateFilesAllAccountedFor(['/path/book.jpg'].map(fileInfoFromPath))
    ).toEqual({
      ok: false,
      level: 'warn',
      message: 'Have unaccounted for files',
      extra: {
        total: 1,
        ignored: 0,
        audio: 0,
        ebook: 0,
        allowed: 0,
        unaccounted: ['/path/book.jpg'],
      },
    })
  })
})
