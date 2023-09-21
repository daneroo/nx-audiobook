import {
  validateFilesAllAccountedFor,
  type Validation,
} from '@nx-audiobook/validators'
import type { AudioBook } from '../types'
import { dedupArray } from './dedupArray'
import { validateModTimeRange, validateModTimeHint } from './validateModTime'

export function validateDirectory(
  // hint: Hint | undefined,
  audiobook: AudioBook
): Validation[] {
  const { audioFiles } = audiobook
  const validations: Validation[] = [
    validateFilesAllAccountedFor(audioFiles.map((file) => file.fileInfo)),
    validateUniqueAuthorTitle(audiobook),
    validateDuration(audiobook),
    validateCover(audiobook),
    validateModTimeRange(audiobook),
    validateModTimeHint(audiobook),
  ]
  return validations
}

// TODO(daneroo): needs to be revisited, now that we removed hints and constrain to a single audio file
// - either validateAuthorTitleHint is ok (as set by hints in classifyDirectory)
// - or validateUniqueAuthorTitle is ok
function validateUniqueAuthorTitle(audiobook: AudioBook): Validation {
  const { audioFiles } = audiobook
  if (audioFiles.length === 0) {
    return {
      ok: true,
      message: 'validateUniqueAuthorTitle',
      level: 'info',
      extra: { skip: 'no audio files' },
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

// Check that the cover image exists (metadata and file)
// - metadata.cover - from audio files metadata (first file)
// - from cover.(jpg|png) in the directory (coverFile)
function validateCover(audiobook: AudioBook): Validation {
  const { audioFiles, metadata, coverFile } = audiobook
  const hasAudioFiles = audioFiles.length > 0

  // aggregate cover warnings
  const warnings = dedupArray(
    audioFiles
      .map((file) => file.metadata.warning.cover)
      .filter((w) => w !== undefined)
  )

  if (hasAudioFiles) {
    if (coverFile === undefined) {
      warnings.push('no cover file found')
    } else {
      const coverFileRE = /^cover\.(jpg|png)$/
      if (!coverFileRE.test(coverFile.basename)) {
        warnings.push(
          `bad cover file name (cover.(jpg|png)): ${coverFile.basename}`
        )
      }
    }
  }

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
