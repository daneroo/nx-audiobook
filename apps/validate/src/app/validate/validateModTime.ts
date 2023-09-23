import type { Validation } from '@nx-audiobook/validators'
import type { AudioBook } from '../types'
import { utimes } from 'node:fs/promises'
import { modTimeHint } from '../hints/modTime'
import {
  type FileInfo,
  getDirectories,
  getDirectory,
  getFiles,
} from '@nx-audiobook/file-walk'
import { classifyDirectory } from './classifyDirectory'

export async function fixModTimeHintPerDirectory(
  rootPath: string,
  options: {
    dryRun: boolean
    verbosity: number
    includeNonAudioFiles: boolean
  } = {
    dryRun: true,
    verbosity: 0,
    includeNonAudioFiles: false,
  }
): Promise<void> {
  const directories = await getDirectories(rootPath)
  const { dryRun, verbosity, includeNonAudioFiles } = options
  console.info(
    `=-=- ${dryRun ? 'Check' : 'Fix'} Modification times for ${
      directories.length
    } directories`
  )
  let totalBooks = 0
  for (const directoryPath of directories) {
    const audiobook = await classifyDirectory(directoryPath)
    if (audiobook.audioFiles.length > 0) {
      await fixModTimeHintBook(audiobook, {
        dryRun,
        verbosity,
        includeNonAudioFiles,
      })
      totalBooks++
    }
  }
  console.info(
    `=-=- Total books: ${totalBooks} from ${directories.length} directories`
  )
}

// Fixes the modtime of the audio files to match our hints/modTime for a Book
// - optionally fix the directory as a whole, and *all* it's files
export async function fixModTimeHintBook(
  audiobook: AudioBook,
  options: { dryRun: boolean; verbosity: number; includeNonAudioFiles: boolean }
): Promise<void> {
  const { dryRun, verbosity, includeNonAudioFiles } = options
  const [error, mtimeHintMS] = modTimeHint(audiobook)
  if (error !== undefined) {
    console.error(
      `fixModTimeHintBook:  ${error} path: ${audiobook.directoryPath}`
    )
    return
  }

  // fix the mtime of either all files, or just the audio files
  if (includeNonAudioFiles) {
    const files = await getFiles(audiobook.directoryPath, {
      recurse: false,
      stat: true,
    })
    for (const file of files) {
      await fixModTimeFile(file, mtimeHintMS, { dryRun, verbosity })
    }
  } else {
    for (const file of audiobook.audioFiles) {
      await fixModTimeFile(file.fileInfo, mtimeHintMS, { dryRun, verbosity })
    }
  }
  // Now fix the directory itself
  const dirInfo: FileInfo = await getDirectory(audiobook.directoryPath)
  await fixModTimeFile(dirInfo, mtimeHintMS, { dryRun, verbosity })
}

// Fixes the modtime of a single file to match our hints/modTime
export async function fixModTimeFile(
  fileInfo: FileInfo,
  mtimeHintMS: number,
  options: { dryRun: boolean; verbosity: number }
): Promise<void> {
  const { dryRun, verbosity } = options

  // This is the desired modtime as as ISO Formatted Str
  const mtimeHintStr = new Date(mtimeHintMS).toISOString()
  // This is the current modtime in ms
  const mtimeMS = fileInfo.mtime.getTime()
  // This is the current modtime as as ISO Formatted Str
  const mtimeStr = fileInfo.mtime.toISOString()
  // This is the path of the file
  const path = fileInfo.path

  if (mtimeMS === mtimeHintMS) {
    // mtime hint is satisfied
    if (verbosity > 0) {
      console.log(`fixModTimeFile (OK) ${mtimeStr} == ${mtimeHintStr} ${path}`)
    }
    return
  }
  // ELSE mtime hint is not satisfied -  need to fix/check the modtime
  if (dryRun) {
    console.log(`fixModTimeFile (check) ${mtimeStr} => ${mtimeHintStr} ${path}`)
  } else {
    console.log(`fixModTimeFile (fix) ${mtimeStr} => ${mtimeHintStr} ${path}`)
    await utimes(path, new Date(mtimeHintMS), new Date(mtimeHintMS))
  }
}

// Validates that the modtime of the audio files match our hints/modTime
// This is in preparation for keeping the modTime (min) as an acquisition Date
// which we would like to preserve.
export function validateModTimeHint(audiobook: AudioBook): Validation {
  const { audioFiles } = audiobook
  const hasAudioFiles = audioFiles.length > 0

  // early return if we are in a parentDir (no audio files)
  if (!hasAudioFiles) {
    return {
      ok: true,
      message: 'validateModTimeHint',
      level: 'info',
      extra: { skip: 'no audio files' },
    }
  }

  // hasAudioFiles is always true below
  // Go-style error handling
  const [error, mtimeHintMS] = modTimeHint(audiobook)
  if (error !== undefined) {
    return {
      ok: false,
      message: 'validateModTimeHint',
      level: 'warn',
      extra: { warnings: [error] },
    }
  }

  // every audioFile matches the hint modtime
  const everyOk = audioFiles.every(
    (file) => file.fileInfo.mtime.getTime() === mtimeHintMS
  )
  // ok also requires hasAudioFiles be true and everyOk be true
  const ok = everyOk

  const extra = {
    ...(!ok
      ? {
          warnings: [
            `audioFile mtime mismatch, expected ${new Date(
              mtimeHintMS
            ).toISOString()}`,
          ],
        }
      : {}),
  }
  return {
    ok,
    message: 'validateModTimeHint',
    level: ok ? 'info' : 'warn',
    extra,
  }
}
