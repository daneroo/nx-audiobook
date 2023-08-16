import {
  validateFilesAllAccountedFor,
  type Validation,
} from '@nx-audiobook/validators'
import type { Hint } from '../hints/types'
import type { AudioBook } from '../types'
import { dedupArray } from './dedupArray'

export function validateDirectory(
  hint: Hint | undefined,
  audiobook: AudioBook
): Validation[] {
  const { audioFiles } = audiobook
  const validations: Validation[] = [
    validateFilesAllAccountedFor(audioFiles.map((file) => file.fileInfo)),
    validateUniqueAuthorTitle(hint, audiobook),
    validateDuration(audiobook),
    validateCover(audiobook),
    validateModTimeRange(audiobook),
  ]
  return validations
}

// references hints db (as imported above)
// - either validateAuthorTitleHint is ok (as set by hints in classifyDirectory)
// - or validateUniqueAuthorTitle is ok
function validateUniqueAuthorTitle(
  hint: Hint | undefined,
  audiobook: AudioBook
): Validation {
  const { audioFiles } = audiobook
  // hints[directoryPath]?.author?.[0] ?? '',
  const skip = hint?.skip
  if (skip === 'no audio files') {
    return {
      ok: true,
      message: 'validateUniqueAuthorTitle',
      level: 'info',
      extra: { skip },
    }
  }

  // if there is a non-empty author and title (from hints)
  // then this is valid
  const v = validateAuthorTitleHint(audiobook)
  if (v.ok) {
    return v
  }

  // otherwise, check that all the files have the same author and title
  const authors = dedupArray(audioFiles.map((file) => file.metadata.author))
  const titles = dedupArray(audioFiles.map((file) => file.metadata.title))
  const ok =
    authors.length === 1 &&
    titles.length === 1 &&
    authors[0] !== '' &&
    titles[0] !== ''
  return {
    ok,
    message: 'validateUniqueAuthorTitle',
    level: ok ? 'info' : 'warn',
    extra: { authors, titles },
  }
}

function validateAuthorTitleHint(audiobook: AudioBook): Validation {
  const { metadata } = audiobook
  // these were set from the hints, in classifyDirectory
  const { author, title } = metadata
  const ok = author !== '' && title !== ''
  return {
    ok,
    message: 'validateAuthorTitleHint',
    level: ok ? 'info' : 'error',
    extra: { author, title },
  }
}

function validateDuration(audiobook: AudioBook): Validation {
  const { metadata, audioFiles } = audiobook
  const { duration } = metadata
  const hasAudioFiles = audioFiles.length > 0
  const everyOk = audioFiles.every((file) => file.metadata.duration > 0)
  const ok = !hasAudioFiles || (duration > 0 && everyOk)

  const warnings = dedupArray(
    audioFiles
      .map((file) => file.metadata.warning.duration)
      .filter((w) => w !== undefined)
  )

  return {
    ok,
    message: 'validateDuration',
    level: ok ? 'info' : 'warn',
    extra: {
      ...(hasAudioFiles ? { duration } : { skip: 'no audio files' }),
      ...(warnings.length > 0 ? { warnings: warnings.join(',') } : {}),
    },
  }
}

// Check that the cover image exists
//  as metadata.cover
//  - from audio files metadata (first file)
//  - or from cover.jpg in the directory (coverFile)
function validateCover(audiobook: AudioBook): Validation {
  const { audioFiles, metadata, coverFile } = audiobook
  const hasAudioFiles = audioFiles.length > 0

  // aggregate cover warnings
  const warnings = dedupArray(
    audioFiles
      .map((file) => file.metadata.warning.cover)
      .filter((w) => w !== undefined)
  )

  const ok =
    !hasAudioFiles || coverFile !== undefined || metadata.cover !== undefined
  const extra = {
    ...(!hasAudioFiles ? { skip: 'no audio files' } : {}),
    ...(coverFile !== undefined ? { path: coverFile.path } : {}),
    ...(metadata.cover !== undefined
      ? { embedded: `${metadata.cover.format} (${metadata.cover.size})` }
      : {}),
    ...(warnings.length > 0 ? { warnings: warnings.join(',') } : {}),
    ...(!ok ? { error: 'no cover found' } : {}),
  }
  return {
    ok: ok && warnings.length === 0,
    message: 'validateCover',
    level: ok ? 'info' : 'warn',
    extra,
  }
}

// Validates that the modtime of the audio files are within a reasonable range (7 days)
// This is in preparation for keeping the modTime (min) as an acquisition Date
// which we would like to preserve.
function validateModTimeRange(audiobook: AudioBook): Validation {
  const { audioFiles } = audiobook
  const hasAudioFiles = audioFiles.length > 0

  const mtimeRange = audioFiles.reduce(
    (acc, file) => {
      const mtime = file.fileInfo.mtime.getTime()
      return {
        minMtime: Math.min(acc.minMtime, mtime),
        maxMtime: Math.max(acc.maxMtime, mtime),
      }
    },
    { minMtime: Infinity, maxMtime: -Infinity }
  )
  const rangeInHours =
    (mtimeRange.maxMtime - mtimeRange.minMtime) / (3600 * 1000)
  const ok = !hasAudioFiles || rangeInHours < 24 * 7 // 7 days
  const extra = {
    ...(!hasAudioFiles ? { skip: 'no audio files' } : {}),
    ...(!ok
      ? {
          warnings: `audioFiles mtime range too high ${rangeInHours.toFixed(
            1
          )}h`,
        }
      : {}),
    // ...(!ok ? { error: 'no cover found' } : {}),
  }
  return {
    ok,
    message: 'validateModTime',
    level: ok ? 'info' : 'warn',
    extra,
  }
}
