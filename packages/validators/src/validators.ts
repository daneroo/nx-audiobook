import type { FileInfo } from '@nx-audiobook/file-walk'

import type { Validation } from './types'

// for files in a set (typically a directory),
// verify that all extensions (and some known filenames are accounted for)
// simply console.error the unaccounted for files files.
// three inputs options:
//  audio file extensions: e.g. ['.mp3', '.m4b', '.m4a']
//  allowed (but not yet required filenames): e.g. ['coder.jpg', 'cover.png', 'metadata.json']
//  ignored (known, non-audio) file extensions: e.g. ['.jpg', '.png', '.pdf', '.epub']
//  ignored (known, non-audio) filenames: e.g. ['.DS_Store', 'MD5SUM']

export const audioExtensions = ['.mp3', '.m4b', '.m4a']
export const ebookExtensions = ['.pdf', '.epub']
export const allowedFilenames = ['cover.jpg', 'cover.png', 'metadata.json']
export const ignoredExtensions = ['.tiff']
export const ignoredFilenames = ['.DS_Store', 'MD5SUM']

export function isAudioFile(fileInfo: FileInfo): boolean {
  return audioExtensions.includes(fileInfo.extension)
}

export function isEBookFile(fileInfo: FileInfo): boolean {
  return ebookExtensions.includes(fileInfo.extension)
}
export function isAllowed(fileInfo: FileInfo): boolean {
  return allowedFilenames.includes(fileInfo.basename)
}

export function isIgnored(fileInfo: FileInfo): boolean {
  return (
    ignoredFilenames.includes(fileInfo.basename) ||
    ignoredExtensions.includes(fileInfo.extension)
  )
}

export function validateFilesAllAccountedFor(files: FileInfo[]): Validation {
  // count ignored files
  const ignored = files.filter(isIgnored).length

  // count audio files
  const audio = files.filter(isAudioFile).length

  // count ebook files
  const ebook = files.filter(isEBookFile).length

  // count allowed named files
  const allowed = files.filter(isAllowed).length

  // the actual list of unaccounted for files (not audio , not ignored (ext or basename))
  const unaccounted = files
    .filter((fileInfo) => {
      // *not* (audio or  ignored (ext or basename))
      return !(
        isAudioFile(fileInfo) ||
        isEBookFile(fileInfo) ||
        isAllowed(fileInfo) ||
        isIgnored(fileInfo)
      )
    })
    // now extract the path
    .map((fileInfo) => fileInfo.path)
  const ok = unaccounted.length === 0

  const extra = {
    total: files.length,
    audio,
    ebook,
    allowed,
    ignored,
    unaccounted,
  }

  const validation: Validation = {
    ok,
    level: ok ? 'info' : 'warn',
    message: ok ? 'All accounted for' : 'Have unaccounted for files',
    extra,
  }
  return validation
}
