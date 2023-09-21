import type { Validation } from './types'

import type { FileInfo } from '@nx-audiobook/file-walk'

// for files in a set (typically a directory),
// verify that all extensions (and some known filenames are accounted for)
// simply console.error the unaccounted for files files.
// three inputs options:
//  audio file extensions: e.g. ['.mp3', '.m4b', '.m4a']
//  ignored (known, non-audio) file extensions: e.g. ['.jpg', '.png', '.pdf', '.epub']
//  ignored (known, non-audio) filenames: e.g. ['.DS_Store', 'MD5SUM']

export const audioExtensions = ['.mp3', '.m4b', '.m4a']
export const ignoredExtensions = ['.jpg', '.png', '.pdf', '.epub']
export const ignoredFilenames = ['.DS_Store', 'MD5SUM']

export function isAudioFile(fileInfo: FileInfo): boolean {
  return audioExtensions.includes(fileInfo.extension)
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

  // the actual list of unaccounted for files (not audio , not ignored (ext or basename))
  const unaccounted = files
    .filter((fileInfo) => {
      // *not* (audio or  ignored (ext or basename))
      return !(isAudioFile(fileInfo) || isIgnored(fileInfo))
    })
    // now extract the path
    .map((fileInfo) => fileInfo.path)
  const ok = unaccounted.length === 0

  const extra = {
    total: files.length,
    audio,
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
