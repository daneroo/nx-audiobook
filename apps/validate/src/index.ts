import yargs from 'yargs/yargs'

import { FileInfo, getDirectories, getFiles } from '@nx-audiobook/file-walk'
import { formatElapsed, durationToHMS } from '@nx-audiobook/time'
import {
  isAudioFile,
  show,
  validateFilesAllAccountedFor,
  Validation,
} from '@nx-audiobook/validators'
import {
  AudioBookMetadata,
  getMetadataForSingleFile,
  ffprobe,
} from './app/metadata/main'
import { searchAudible, sortAudibleBooks } from './app/audible/search'
import { db as hints } from './app/hints/db'
import type { Hint, AuthorTitleHintReason } from './app/hints/types'
import { promises as fs } from 'node:fs'

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
    .help()
    .parseAsync()

  // destructure arguments
  const { rootPath: unverifiedRootPath } = argv
  // clean the root path by removing trailing slash
  const rootPath = unverifiedRootPath.replace(/\/$/, '')
  console.error('=-=- Validate:', { rootPath })

  const startMs = +new Date()
  const directories = await getDirectories(rootPath)
  console.error(
    `Got ${directories.length} directories in`,
    formatElapsed(startMs)
  )
  // 1- Global validation
  // - still needed for validateFilesAllAccountedFor,
  // because AudioBook returned from classifyDirectory does not have the full list of files (just audio files)
  {
    const startMs = +new Date()
    const allFiles = await getFiles(rootPath, { recurse: true, stat: false })
    console.error(`Got ${allFiles.length} files in`, formatElapsed(startMs))

    const validation = validateFilesAllAccountedFor(allFiles)
    show('Global - all files accounted for', [validation])
  }

  // 2- Per directory validation
  for (const directoryPath of directories) {
    const audiobook = await classifyDirectory(directoryPath)
    const validations = validateDirectory(audiobook)
    const shortPath = directoryPath.substring(39)
    show(shortPath.length === 0 ? '<root>' : shortPath, validations, {
      alwaysTitle: false,
      onlyFailures: true,
    })
  }

  // 3- rewrite hints
  // eslint-disable-next-line no-lone-blocks
  if (+new Date() > 0) {
    const newHints: Record<string, Hint> = {}
    for (const directoryPath of directories) {
      const audiobook = await classifyDirectory(directoryPath)
      if (audiobook.audioFiles.length === 0) {
        newHints[directoryPath] = {
          skip: 'no audio files',
        }
        continue
      } else {
        // audiobook.audioFiles.length > 0
        const { author, title, duration } = audiobook.metadata
        const authors = dedupArray(
          audiobook.audioFiles.map((file) => file.metadata.author)
        )
        const authorHintReason: AuthorTitleHintReason =
          authors.length === 1 && authors[0] === author ? 'unique' : 'hint'
        const titles = dedupArray(
          audiobook.audioFiles.map((file) => file.metadata.title)
        )
        const titleHintReason: AuthorTitleHintReason =
          titles.length === 1 && titles[0] === title ? 'unique' : 'hint'

        const hint: Hint = {
          author: [author, authorHintReason],
          title: [title, titleHintReason],
          '// duration': durationToHMS(duration),
        }

        // pass on hint.skip
        const oldHintSkip = hints[directoryPath]?.skip
        if (oldHintSkip !== undefined) {
          hint.skip = oldHintSkip
        }

        // special if skip.hint==="multiple authors", overwrite authorHintReason, and add the list of authors in a special comment
        if (oldHintSkip === 'multiple authors') {
          hint.author = [author, 'multiple']
          hint['// multiple authors'] = authors
        }

        // asin section - if not skipped
        if (hint.skip === undefined) {
          const asins = await getAsins(duration, author, title)
          hint.asins = asins
        }

        newHints[directoryPath] = hint
      }
    }
    await fs.writeFile(
      'newdb.ts',
      `// cSpell:disable
import type { Hint } from './types'
export const db: Record<string, Hint> =
` + JSON.stringify(newHints, null, 2)
    )
  }

  async function getAsins(
    duration: number,
    author: string,
    title: string
  ): Promise<string[]> {
    const durationMeta = duration // rename to avoid shadowing
    const audibleBooks = await searchAudible({ author, title })
    const sortedAudible = sortAudibleBooks(audibleBooks, durationMeta)
    const deltaThreshold = 15 * 60 // 15 minutes
    const largeDuration = 1e7
    const asins = sortedAudible
      .map((book) => {
        // this is the duration from the audible result
        const { duration } = book
        const delta =
          duration > 0 ? Math.abs(duration - durationMeta) : largeDuration
        const check = delta <= deltaThreshold ? '✓' : '✗'
        return {
          ...book,
          delta,
          check,
        }
      })
      // exact title match only
      // .filter((candidate) => candidate.title === title)
      // filter out books that are too far off
      .filter((candidate) => candidate.delta <= deltaThreshold)
      .map(
        ({ title, authors, narrators, duration, asin, delta, check }) =>
          `${asin}: ${check} Δ:${durationToHMS(delta)} - ${durationToHMS(
            duration
          )} -  ${title} / ${authors.join(',')} / n: ${narrators.join(',')}`
      )
    return asins
  }
}

// The metadata for an audio file or an entire audiobook

// FileInfo and AudioMetadata for one file
interface AudioFile {
  fileInfo: FileInfo
  metadata: AudioBookMetadata
}
// Describe an Audiobook:
// - The files in the directory
// - The metadata in each of those files
interface AudioBook {
  directoryPath: string
  audioFiles: AudioFile[]
  metadata: AudioBookMetadata
}

// Audiobook represents the data for a Directory
// - the audio files in the directory
async function classifyDirectory(directoryPath: string): Promise<AudioBook> {
  const fileInfos = await getFiles(directoryPath, {
    recurse: false,
    stat: true,
  })

  // - filter out non-audio files
  // - lookup metadata for each file

  // Parallel - is faster than sequential - 3.797s ±  0.409s  (No cache: 77.888s ±  1.136s)
  const audioFiles = await Promise.all(
    fileInfos.filter(isAudioFile).map(augmentFileInfo)
  )
  // Sequential - is slower than parallel - 7.975s ±  0.991s (No cache: 97.116s ±  7.710s)
  // const audioFiles: AudioFile[] = []
  // for (const fileInfo of fileInfos.filter(isAudioFile)) {
  //   audioFiles.push(await augmentFileInfo(fileInfo))
  // }

  // aggregates the AudioBookMetadata for the entire directories' audioFiles
  // adn overrides with hints for author and title, if present.
  const duration = Math.round(
    audioFiles.reduce((sum, file) => sum + file.metadata.duration, 0)
  )
  // set author, title from hints
  const hint = hints[directoryPath]
  const author = hint?.author?.[0] ?? ''
  const title = hint?.title?.[0] ?? ''

  const audiobook: AudioBook = {
    directoryPath,
    audioFiles,
    metadata: { author, title, duration },
  }
  return audiobook
}

async function augmentFileInfo(fileInfo: FileInfo): Promise<AudioFile> {
  const metadata = await getMetadataForSingleFile(fileInfo)
  // TODO get both and compare
  if (metadata.duration === 0) {
    // resolve duration===0 with ffprobe
    const ffMetadata = await ffprobe(fileInfo)
    metadata.duration = ffMetadata.duration
  }
  return { fileInfo, metadata }
}

function validateDirectory(audiobook: AudioBook): Validation[] {
  const { audioFiles } = audiobook
  const validations: Validation[] = [
    validateFilesAllAccountedFor(audioFiles.map((file) => file.fileInfo)),
    validateUniqueAuthorTitle(audiobook),
    validateDuration(audiobook),
  ]
  return validations
}

function validateUniqueAuthorTitle(audiobook: AudioBook): Validation {
  const { audioFiles } = audiobook
  const hint = hints[audiobook.directoryPath]
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

// remove duplicates from array
function dedupArray<T>(ary: T[]): T[] {
  const dedup = [...new Set(ary)]
  return dedup
}

function validateAuthorTitleHint(audiobook: AudioBook): Validation {
  const { metadata } = audiobook
  // these were set from the hints, in classifyDirectory
  // const hint = hints[directoryPath]
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
  const ok =
    audioFiles.length === 0 ||
    (duration > 0 && audioFiles.every((file) => file.metadata.duration > 0))
  return {
    ok,
    message: 'validateDuration',
    level: ok ? 'info' : 'warn',
    extra: { duration },
  }
}
