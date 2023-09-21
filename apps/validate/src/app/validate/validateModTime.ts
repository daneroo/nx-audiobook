import type { Validation } from '@nx-audiobook/validators'
import type { AudioBook } from '../types'
import { statSync } from 'node:fs'
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
  const mtimeHintMS = modTimeHint(audiobook)

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
  const mtimeHintMS = modTimeHint(audiobook)

  const { audioFiles } = audiobook
  const hasAudioFiles = audioFiles.length > 0

  // every audioFile matches the hint modtime
  const everyOk = audioFiles.every(
    (file) => file.fileInfo.mtime.getTime() === mtimeHintMS
  )
  const ok = !hasAudioFiles || everyOk

  const extra = {
    ...(!hasAudioFiles ? { skip: 'no audio files' } : {}),
    ...(!ok
      ? {
          warnings: [
            `audioFile mtime mismatch, expected ${new Date(
              mtimeHintMS
            ).toISOString()}`,
          ],
          // fix: audioFiles.map((file) => {
          //   // escape single quotes in path
          //   const path = file.fileInfo.path.replace(/'/g, "'\\''")

          //   return `touch -m -d '${new Date(
          //     mtimeHintMS
          //   ).toISOString()}' '${path}'`
          // }),
        }
      : {}),
  }
  return {
    ok,
    message: 'validateModTime',
    level: ok ? 'info' : 'warn',
    extra,
  }
}

// Validates that the modtime of the audio files are within a reasonable range (1 hour (prev 7 days))
// This is in preparation for keeping the modTime (min) as an acquisition Date
// which we would like to preserve.
export function validateModTimeRange(audiobook: AudioBook): Validation {
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
  // also add the directory mtime to the range
  const includeDirMtime = false
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (includeDirMtime) {
    const dirStat = statSync(audiobook.directoryPath)
    // console.log('*****', audiobook.directoryPath, dirStat.mtime.getTime())
    mtimeRange.minMtime = Math.min(mtimeRange.minMtime, dirStat.mtime.getTime())
    mtimeRange.maxMtime = Math.max(mtimeRange.maxMtime, dirStat.mtime.getTime())
  }
  // ...
  const rangeInHours =
    (mtimeRange.maxMtime - mtimeRange.minMtime) / (3600 * 1000)
  const ok = !hasAudioFiles || rangeInHours < 1 // 1 hour
  const extra = {
    ...(!hasAudioFiles ? { skip: 'no audio files' } : {}),
    ...(!ok
      ? {
          warnings: [
            `audioFiles mtime range too high ${rangeInHours.toFixed(1)}h`,
            `range ${new Date(mtimeRange.minMtime).toISOString()} ${new Date(
              mtimeRange.maxMtime
            ).toISOString()}`,
          ],
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
