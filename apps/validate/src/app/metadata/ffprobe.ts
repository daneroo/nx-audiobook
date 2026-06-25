import type { FileInfo } from '@nx-audiobook/file-walk'
import { cachedFetchResult } from '../cache/cache'
import type { AudioBookMetadata } from './types'

export async function ffprobe(fileInfo: FileInfo): Promise<AudioBookMetadata> {
  return await cachedFetchResult<FileInfo, AudioBookMetadata>(
    fetchResult,
    fileInfo,
    'ffprobe'
  )
}

// get metadata for a single audio file
export async function fetchResult(
  fileInfo: FileInfo
): Promise<AudioBookMetadata> {
  // const ffprobeBin =
  //   '/Applications/OpenAudible.app/Contents/Resources/app/bin/mac/ffprobe' // ffprobe version 4.3.1
  const ffprobeBin = 'ffprobe'
  const command = `${ffprobeBin} -v quiet -of json -show_format -show_chapters "${fileInfo.path}"`

  try {
    const { stdout, stderr } = await execCommand(command)
    if (stderr !== '') {
      console.error('discarding ffprobe stderr:\n', stderr)
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const metadata = JSON.parse(stdout)
    // console.log(JSON.stringify(metadata, null, 2))
    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      author: metadata.format?.tags?.artist ?? '',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      title: metadata.format?.tags?.album ?? '',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      duration: parseDuration(metadata.format?.duration as string | undefined | null, fileInfo.path),
      warning: {},
    }
  } catch (error) {
    console.error({ error })
    throw new Error(`ffprobe error: ${fileInfo.path}`)
  }
}

// Parses the duration field from ffprobe's JSON format output (metadata.format?.duration).
// That field is a decimal string (e.g. "53620.861678") when present, undefined when the
// format key is absent, and null when JSON explicitly carries null — so all three are valid inputs.
//
// Number() conversions: Number("53620.86") → 53620.86, Number(undefined) → NaN, Number(null) → 0.
// Note: isNaN(Infinity) === false, so isNaN is the wrong guard — Number.isFinite catches
// NaN, Infinity, and -Infinity in one check; || duration === 0 catches the null and "0" cases.
//
// Throws rather than returning a bad value so that cachedFetchResult never writes it to disk —
// JSON.stringify would silently coerce NaN/Infinity to null, poisoning the cache permanently.
function parseDuration(raw: string | undefined | null, path: string): number {
  const duration = Number(raw)
  if (!Number.isFinite(duration) || duration === 0) {
    throw new Error(`ffprobe returned unusable duration (${String(raw)}) for ${path}`)
  }
  return duration
}

// Execute a command in a shell
// https://nodejs.org/api/child_process.html#child_processexeccommand-options-callback
//  Good examples for tests
// const results = { example: await execCommand('echo this is stdout') }
// const results = { example: await execCommand('echo this is stderr 1>&2') }
// const results = { example: await execCommand('uname -a') }
// const results = { example: await execCommand('false') } // exit code 1
// const results = {
//   example: await execCommand('docker run --rm ubuntu uname -a')
// }
export async function execCommand(
  command: string
): Promise<{ stdout: string; stderr: string }> {
  const { exec: execWithCallback } = await import('node:child_process')
  const { promisify } = await import('node:util')
  // The promisified version of exec
  const exec = promisify(execWithCallback)
  return await exec(command)
}
