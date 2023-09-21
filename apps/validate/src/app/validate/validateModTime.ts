import type { Validation } from '@nx-audiobook/validators'
import type { AudioBook } from '../types'
import { statSync } from 'node:fs'
import { utimes } from 'node:fs/promises'
import { modTimeHint } from '../hints/modTime'
import { getDirectories } from '@nx-audiobook/file-walk'
import { classifyDirectory } from './classifyDirectory'

export async function fixModTimeHintPerDirectory(
  rootPath: string,
  dryRun: boolean
): Promise<void> {
  const directories = await getDirectories(rootPath)
  console.info(
    `=-=- ${dryRun ? 'Check' : 'Fix'} Modification times for ${
      directories.length
    } directories`
  )
  let totalBooks = 0
  for (const directoryPath of directories) {
    const audiobook = await classifyDirectory(directoryPath)
    if (audiobook.audioFiles.length > 0) {
      await fixModTimeHint(audiobook, dryRun)
      totalBooks++
    }
  }
  console.info(
    `=-=- Total books: ${totalBooks} from ${directories.length} directories`
  )
}

// Fixes the modtime of the audio files to match our hints/modTime
export async function fixModTimeHint(
  audiobook: AudioBook,
  dryRun: boolean
): Promise<void> {
  const mtimeHintMS = modTimeHint(audiobook)
  const mtimeHintStr = new Date(mtimeHintMS).toISOString()

  for (const file of audiobook.audioFiles) {
    if (file.fileInfo.mtime.getTime() === mtimeHintMS) {
      // hint is satisfied
      console.log(
        `fixModTimeHint (OK) ${
          file.fileInfo.path
        } ${file.fileInfo.mtime.toISOString()} == ${mtimeHintStr}`
      )
      continue
    }
    // need to fix the modtime
    if (dryRun) {
      console.log(
        `fixModTimeHint (check) ${
          file.fileInfo.path
        } ${file.fileInfo.mtime.toISOString()} => ${mtimeHintStr}`
      )
      // // escape single quotes in path: this does not work!!!!
      // const path = file.fileInfo.path.replace(/'/g, "'\\''")
      // console.log(
      //   `touch -m -d '${new Date(mtimeHintMS).toISOString()}' '${path}'`
      // )
    } else {
      console.log(
        `fixModTimeHint (fix) ${
          file.fileInfo.path
        } ${file.fileInfo.mtime.toISOString()} => ${mtimeHintStr}`
      )
      await utimes(
        file.fileInfo.path,
        new Date(mtimeHintMS),
        new Date(mtimeHintMS)
      )
    }
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
