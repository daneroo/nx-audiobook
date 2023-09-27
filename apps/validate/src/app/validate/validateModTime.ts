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
import { show } from '@nx-audiobook/validators'

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
    const shortPath = directoryPath.substring(rootPath.length)

    if (audiobook.audioFiles.length > 0) {
      const validation = await fixModTimeHintBook(audiobook, {
        dryRun,
        verbosity,
        includeNonAudioFiles,
      })
      const validations = [validation]
      show(
        shortPath.length === 0 ? '/ (<root>)' : shortPath,
        validations,
        verbosity
      )

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
): Promise<Validation> {
  const { dryRun, verbosity, includeNonAudioFiles } = options

  // The error here is most likely a missing key in the mtime hint lookup
  const [error, mtimeHintMS] = modTimeHint(audiobook)
  if (error !== undefined) {
    return {
      ok: false,
      message: 'fixModTimeHintBook',
      level: 'warn',
      extra: { warnings: [error] },
    }
  }

  // fix the mtime of either all files, or just the audio files
  const files = includeNonAudioFiles
    ? await getFiles(audiobook.directoryPath, {
        recurse: false,
        stat: true,
      })
    : audiobook.audioFiles.map((af) => af.fileInfo)
  // And add the directory itself
  files.push(await getDirectory(audiobook.directoryPath))

  const mtimeHintStr = new Date(mtimeHintMS).toISOString()

  // now perform the check - and gather warnings
  const warnings: string[] = []
  for (const file of files) {
    const ok = await fixModTimeFile(file, mtimeHintMS, { dryRun, verbosity })
    if (!ok) {
      // This is the current modtime as as ISO Formatted Str
      const mtimeStr = file.mtime.toISOString()
      const fileIdentifier =
        file.path === audiobook.directoryPath ? '/ (dir itself)' : file.basename
      warnings.push(
        `mtime mismatch ${mtimeStr} => ${mtimeHintStr} for ${fileIdentifier}`
      )
    }
  }
  const ok = warnings.length === 0
  const extra = !ok ? { warnings } : {}
  return {
    ok,
    message: 'validateModTimeHintBook',
    level: ok ? 'info' : 'warn',
    extra,
  }
}

// Fixes the modtime of a single file to match our hints/modTime
// return true if the file already has the correct modification time
export async function fixModTimeFile(
  fileInfo: FileInfo,
  mtimeHintMS: number,
  options: { dryRun: boolean; verbosity: number }
): Promise<boolean> {
  const { dryRun, verbosity } = options

  // This is the desired modtime as as ISO Formatted Str
  const mtimeHintStr = new Date(mtimeHintMS).toISOString()
  // This is the current modtime in ms
  const mtimeMS = fileInfo.mtime.getTime()
  // This is the current modtime as as ISO Formatted Str
  const mtimeStr = fileInfo.mtime.toISOString()
  // This is the path of the file
  const path = fileInfo.path

  // TODO(daneroo): clean this up once API for fixing is determined
  if (mtimeMS === mtimeHintMS) {
    // mtime hint is satisfied
    // if (verbosity > 0) {
    //   console.log(`fixModTimeFile (OK) ${mtimeStr} == ${mtimeHintStr} ${path}`)
    // }
    return true
  }
  // ELSE mtime hint is not satisfied -  need to fix/check the modtime
  if (dryRun) {
    // console.log(`fixModTimeFile (check) ${mtimeStr} => ${mtimeHintStr} ${path}`)
  } else {
    // console.log(`fixModTimeFile (fix) ${mtimeStr} => ${mtimeHintStr} ${path}`)
    await utimes(path, new Date(mtimeHintMS), new Date(mtimeHintMS))
  }
  return false
}

// Validates that the modtime of the audio files match our hints/modTime
// This is in preparation for keeping the modTime (min) as an acquisition Date
// which we would like to preserve.
export async function validateModTimeHint(
  audiobook: AudioBook
): Promise<Validation> {
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

  // Go-style error handling for modTimeHint
  const [error, mtimeHintMS] = modTimeHint(audiobook)
  if (error !== undefined) {
    return {
      ok: false,
      message: 'validateModTimeHint',
      level: 'warn',
      extra: { warnings: [error] },
    }
  }

  const validations = await fixModTimeHintBook(audiobook, {
    dryRun: true,
    verbosity: 0,
    includeNonAudioFiles: false,
  })
  return validations
}
