import {
  validateFilesAllAccountedFor,
  Validation,
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
  return {
    ok,
    message: 'validateDuration',
    level: ok ? 'info' : 'warn',
    extra: {
      ...(hasAudioFiles ? { duration } : {}),
      ...(hasAudioFiles && !everyOk
        ? {
            durations: audioFiles
              .map((file) => file.metadata.duration)
              .filter((d) => d > 0),
          }
        : {}),
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
  // all audio files have the "same" cover
  const everyOk = audioFiles.every((file) => file.metadata.cover !== undefined)

  // dedup'd format|size of all covers (in each audio file)
  const formats = dedupArray(
    audioFiles.map((file) => file.metadata.cover?.format)
  ).filter((f) => f !== undefined) as string[]
  const sizes = dedupArray(
    audioFiles.map((file) => file.metadata.cover?.size)
  ).filter((f) => f !== undefined) as number[]

  const ok =
    !hasAudioFiles ||
    coverFile !== undefined ||
    (metadata.cover !== undefined && everyOk)
  return {
    ok,
    message: 'validateCover',
    level: ok ? 'info' : 'warn',
    extra: {
      ...(hasAudioFiles && metadata.cover !== undefined
        ? { ...metadata.cover }
        : {}),
      ...(hasAudioFiles && formats.length !== 1 ? { formats } : {}),
      ...(hasAudioFiles && formats.length !== 1 ? { sizes } : {}),
    },
  }
}
