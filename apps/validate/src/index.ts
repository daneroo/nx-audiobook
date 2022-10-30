import yargs from 'yargs/yargs'

import * as path from 'node:path'
import * as fs from 'node:fs/promises'

import type { AudioBook } from './app/types'
import { getDirectories, getFiles } from '@nx-audiobook/file-walk'
import { show, validateFilesAllAccountedFor } from '@nx-audiobook/validators'
import { db as hints } from './app/hints/db'
import { validateDirectory } from './app/validate/validateDirectory'
import { classifyDirectory } from './app/validate/classifyDirectory'
import { rewriteHints } from './app/validate/rewriteHints'
import { getCoverImage } from './app/metadata/main'
import { durationToHMS } from '@nx-audiobook/time'
const defaultRootPath = '/Volumes/Space/archive/media/audiobooks'

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

async function main(): Promise<void> {
  const argv = await yargs(process.argv.slice(2))
    .option('rootPath', {
      alias: 'r',
      type: 'string',
      demandOption: true,
      default: defaultRootPath,
      describe: 'Path of the root directory to search from',
    })
    .option('rewriteHintsDB', {
      type: 'string',
      nargs: 1,
      describe:
        'Path of hints file to rewrite e.g.: --rewriteHints=src/app/hints/newdb.ts',
    })
    .option('convertDir', {
      type: 'string',
      nargs: 1,
      describe:
        'convert audio into destination path: e.g.: --convert ./converted',
    })
    .count('verbose')
    .alias('v', 'verbose')
    .help()
    .parseAsync()

  // destructure arguments
  const {
    rootPath: unverifiedRootPath,
    rewriteHintsDB,
    convertDir,
    verbose: verbosity,
  } = argv
  // clean the root path by removing trailing slash
  const rootPath = unverifiedRootPath.replace(/\/$/, '')
  console.info('=- Classify and Validate:', { rootPath })

  // 1- Global validation
  // - still needed for validateFilesAllAccountedFor,
  // because AudioBook returned from classifyDirectory does not have the full list of files (just audio files)
  await validateGlobal(rootPath, verbosity)

  // 2- Per directory validation
  await validatePerDirectory(rootPath, verbosity)

  // 3- rewrite hints
  if (rewriteHintsDB !== undefined) {
    console.log('=-=- Rewriting hints db:', rewriteHintsDB)
    const directories = await getDirectories(rootPath)
    await rewriteHints(hints, rewriteHintsDB, directories)
  }

  // 4- convert
  if (convertDir !== undefined) {
    console.log('=-=- Convert:', convertDir)
    await convertPerDirectory(rootPath, convertDir)
  }
}

async function validateGlobal(
  rootPath: string,
  verbosity: number
): Promise<void> {
  const allFiles = await getFiles(rootPath, { recurse: true, stat: false })
  console.info(`=-=- Global Validation of ${allFiles.length} files`)

  const validation = validateFilesAllAccountedFor(allFiles)
  show('Global - all files accounted for', [validation], verbosity)
}

async function validatePerDirectory(
  rootPath: string,
  verbosity: number
): Promise<void> {
  const directories = await getDirectories(rootPath)
  console.info(`=-=- Classify and validate ${directories.length} directories`)
  let totalBooks = 0
  for (const directoryPath of directories) {
    const hint = hints[directoryPath]
    const audiobook = await classifyDirectory(hint, directoryPath)
    const validations = validateDirectory(hint, audiobook)
    const shortPath = directoryPath.substring(rootPath.length)
    show(
      shortPath.length === 0 ? '/ (<root>)' : shortPath,
      validations,
      verbosity
    )
    if (audiobook.audioFiles.length > 0) {
      totalBooks++
    }
  }
  console.info(
    `=-=- Total books: ${totalBooks} = ${directories.length} directories`
  )
}

// move this to a separate file
async function convertPerDirectory(
  rootPath: string,
  convertDir: string
  // verbosity: number
): Promise<void> {
  const directories = await getDirectories(rootPath)
  console.info(
    `=- Convert ${directories.length} directories into ${convertDir}`
  )
  for (const directoryPath of directories) {
    const hint = hints[directoryPath]
    const audiobook = await classifyDirectory(hint, directoryPath)
    await convertDirectory(audiobook, convertDir)
  }
}

async function convertDirectory(
  audiobook: AudioBook,
  convertDir: string
): Promise<void> {
  const { directoryPath, audioFiles, metadata, coverFile } = audiobook

  const TMP_DIR = path.join(convertDir, 'tmpdir')
  const COVER_DIR = path.join(convertDir, 'covers')
  // const OUTPUT_DIR = path.join(convertDir, 'converted')

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
      const suffix = coverFile.extension.slice(1)
      const coverFileName = path.join(
        COVER_DIR,
        `${metadata.author} - ${metadata.title}.${suffix}`
      )
      await fs.copyFile(coverFile.path, coverFileName)
    } else {
      await noCover(audiobook)
    }
  } else {
    await noCover(audiobook)
  }

  async function noCover(audiobook: AudioBook): Promise<void> {
    // console.error('no cover', { directoryPath })
    const { author, title, duration } = audiobook.metadata
    const summaryPrompt = `A very detailed book cover for the book "${title}" by ${author}`
    console.info(`no cover: ${summaryPrompt}`)
    const summaryDescription = `${author} - ${title} ${durationToHMS(
      duration
    )} ${audiobook.audioFiles.length} files`
    await fs.writeFile(
      path.join(COVER_DIR, `${author} - ${title}.txt`),
      summaryDescription
    )
  }
  // // console.error(
  // //   '******',
  // //   JSON.stringify(
  // //     metas[0],
  // //     (key, value) => {
  // //       if (key === 'data' && Array.isArray(value)) return '[removed]'
  // //       if (key === 'warnings' && Array.isArray(value)) return '[removed]'
  // //       return value
  // //     },
  // //     2
  // //   )
  // // )

  // const author = getAuthor(directoryPath)
  // const title = getTitle(directoryPath)

  // // chapters
  // const chapters = chaptersFromMetas(metas)
  // // console.error(JSON.stringify(chapters, null, 2))

  // // write the meta data in ffmetadata format
  // const metadata = { artist: author, title }
  // await fs.writeFile(
  //   path.join(TMPDIR, 'ffmetadata.txt'),
  //   ffmeta.stringify({ metadata, streams: [], chapters })
  // )

  // const startMs = +new Date()
  // await convert()
  // console.error('Converted in', formatElapsed(startMs))
  // await move()
}
