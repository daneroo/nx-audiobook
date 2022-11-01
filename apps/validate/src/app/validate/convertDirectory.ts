import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import * as url from 'url' // for __dirname
import * as ffmeta from 'ffmeta' // this is just to serialize ffmpeg's metadata in it's custom format
import type { AudioBook, AudioFile } from '../types'
import { getCoverImage } from '../metadata/main'
import { durationToHMS, formatElapsed } from '@nx-audiobook/time'

export async function convertDirectory(
  audiobook: AudioBook,
  convertDir: string
): Promise<void> {
  const { directoryPath, audioFiles, metadata, coverFile } = audiobook

  const TMP_DIR = path.join(convertDir, 'tmpdir')
  const COVER_DIR = path.join(convertDir, 'covers')
  const OUTPUT_DIR = path.join(convertDir, 'converted')

  await fs.mkdir(COVER_DIR, { recursive: true })
  await fs.mkdir(TMP_DIR, { recursive: true })
  if (audioFiles.length === 0) {
    console.error('=-=- Convert:', directoryPath)
    console.error('no audio files')
    return
  }

  const summaryDescription = `${metadata.author} - ${
    metadata.title
  } ${durationToHMS(metadata.duration)} ${audioFiles.length} files`
  console.info(`=-=- Convert: ${summaryDescription}`)

  // write listing.txt - writeFile takes an iterable (our mapped array in this case)
  await fs.writeFile(
    path.join(TMP_DIR, 'listing.txt'),
    audioFiles.map((f) => {
      // https://ffmpeg.org/ffmpeg-utils.html#Examples
      // to escape a single quote: ' => '\''
      const escaped = f.fileInfo.path.replace(/'/g, "'\\''")
      return `file '${escaped}'\n`
    })
  )

  // write cover.jpg
  if (audioFiles[0] !== undefined) {
    const cover = await getCoverImage(audioFiles[0].fileInfo)
    if (cover !== undefined) {
      // map image/jpeg->jpg, image/png->png
      const suffix = cover.format.replace('image/', '').replace('jpeg', 'jpg')
      await fs.writeFile(path.join(TMP_DIR, `cover.${suffix}`), cover.data)
      const coverFileName = path.join(
        COVER_DIR,
        `${metadata.author} - ${metadata.title}.${suffix}`
      )
      await fs.writeFile(coverFileName, cover.data)
    } else if (coverFile !== undefined) {
      // careful fileInfo.extension contains the leading "."
      const suffix = coverFile.extension.slice(1).toLowerCase()
      await fs.copyFile(coverFile.path, path.join(TMP_DIR, `cover.${suffix}`))
      const coverFileName = path.join(
        COVER_DIR,
        `${metadata.author} - ${metadata.title}.${suffix}`
      )
      await fs.copyFile(coverFile.path, coverFileName)
    } else {
      await noCover(audiobook, TMP_DIR, COVER_DIR)
    }
  } else {
    await noCover(audiobook, TMP_DIR, COVER_DIR)
  }

  const { author, title } = metadata

  // chapters - from audioFiles[].metadata
  // - could passthrough if original already has chapters - and single file
  // - could use the file names as chapter names
  const chapters = chaptersFromMetas(audioFiles)
  // console.error(JSON.stringify(chapters, null, 2))

  // write the meta data in ffmetadata format
  {
    const metadata = { artist: author, title }
    await fs.writeFile(
      path.join(TMP_DIR, 'ffmetadata.txt'),
      ffmeta.stringify({ metadata, streams: [], chapters })
    )
  }

  // get the format from the first file (suffix based for now)
  // careful fileInfo.extension contains the leading "."
  const outputSuffix = audioFiles[0]?.fileInfo.extension.slice(1) ?? 'mp3'
  console.log({ outputSuffix })

  const startMs = +new Date()
  await convert(TMP_DIR, outputSuffix /*, OUTPUT_DIR, author, title */)
  console.error('Converted in', formatElapsed(startMs))
  await move(TMP_DIR, outputSuffix, OUTPUT_DIR, author, title)
  console.info('Removing', TMP_DIR)
  await fs.rm(TMP_DIR, { recursive: true })
}

async function noCover(
  audiobook: AudioBook,
  TMP_DIR: string,
  COVER_DIR: string
): Promise<void> {
  // console.error('no cover', { directoryPath })
  // this breaks because __dirname is different in dev/build
  // ESM equivalent to __dirname
  // const thisDirname = url.fileURLToPath(new URL('.', import.meta.url))
  // console.log({ thisDirname })
  // relative to pwd
  const missingCoverFile = path.resolve(
    '../../',
    'assets',
    'images',
    'missing-cover.jpg'
  )
  const { metadata } = audiobook
  console.error('missing cover', { missingCoverFile })
  await fs.copyFile(missingCoverFile, path.join(TMP_DIR, `cover.jpg`))

  const coverFileName = path.join(
    COVER_DIR,
    `${metadata.author} - ${metadata.title}.jpg`
  )
  await fs.copyFile(missingCoverFile, coverFileName)
}

async function move(
  TMP_DIR: string,
  outputSuffix: string,
  OUTPUT_DIR: string,
  author: string,
  title: string
): Promise<void> {
  // move the file to the output directory
  await fs.mkdir(OUTPUT_DIR, { recursive: true })

  const from = path.join(TMP_DIR, `output.${outputSuffix}`)
  const to = path.join(OUTPUT_DIR, `${author} - ${title}.${outputSuffix}`)
  console.error(`Renaming to ${to}`)
  await fs.rename(from, to)
}

// All in one step!
// time ffmpeg -v quiet -f concat -safe 0 -i listing.txt -i cover.jpg -i ffmetadata.txt -map_metadata 2 -map 0:0 -map 1:0 -c copy output.mp3
// re-extract metadata from produced file
// ffmpeg -v quiet -i output.mp3 -f ffmetadata -
// same with
// ffprobe -v quiet -print_format json -show_format -show_chapters output.mp3
async function convert(
  TMP_DIR: string,
  outputSuffix: string
  // OUTPUT_DIR: string,
  // author: string,
  // title: string
): Promise<void> {
  // -y is for allowing overwrite of output.mp3
  // -v quiet is for suppressing ffmpeg output
  // -safe 0 allows unsafe filenames (e.g. with spaces)
  // for m4b we need to add -disposition:v:0 attached_pic
  // -vn -c:a libmp3lame -b:a 64k : would be for transcoding m4b to mp3

  // for m4b we need to add -disposition:v:0 attached_pic
  const disposition =
    outputSuffix === 'm4b' ? '-disposition:v:0 attached_pic' : ''
  const command = `cd "${TMP_DIR}" && ffmpeg -v quiet -y -f concat -safe 0 -i listing.txt -i cover.jpg -i ffmetadata.txt -map 0:0 -map 1:0 -map_metadata 2 -c copy ${disposition} output.${outputSuffix}`
  console.error('convert command\n', command)

  try {
    const { stdout, stderr } = await execCommand(command)
    if (stderr !== '') {
      console.error('convert stderr', stderr)
    }
    if (stdout !== '') {
      console.error('convert stdout', stdout)
    }
    // return stdout
  } catch (error) {
    // console.error('exec', error)
    console.error('convert error', error)
  }
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
// extract common.title and format.duration from each AudioFile's metadata
// and map to expected format for ffmeta.stringify
interface Chapter {
  TIMEBASE: string
  START: string
  END: string
  metadata: {
    title: string
  }
}

function chaptersFromMetas(audioFiles: AudioFile[]): Chapter[] {
  let startMillis = 0

  const results: Chapter[] = audioFiles.map((audioFile) => {
    const { metadata } = audioFile
    const durationMillis = metadata.duration * 1000
    const endMillis = startMillis + durationMillis
    const result: Chapter = {
      TIMEBASE: '1/1000',
      START: startMillis.toFixed(0),
      END: endMillis.toFixed(0),
      metadata: {
        title: metadata.title,
      },
    }
    startMillis = endMillis
    return result
  })
  return results
}
