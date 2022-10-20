import yargs from 'yargs/yargs'

import { FileInfo, getDirectories, getFiles } from '@nx-audiobook/file-walk'
import { formatElapsed } from '@nx-audiobook/time'
import {
  isAudioFile,
  show,
  validateFilesAllAccountedFor,
  Validation,
} from '@nx-audiobook/validators'

import { AudioMetadata, getMetadataForSingleFile } from './app/metadata'

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
  {
    const startMs = +new Date()
    const allFiles = await getFiles(rootPath, { recurse: true, stat: false })
    console.error(`Got ${allFiles.length} files in`, formatElapsed(startMs))

    const validation = validateFilesAllAccountedFor(allFiles)
    show('Global - all files accounted for', [validation])
  }

  // rewriteHint('export const db = {');
  // 2- Per directory validation
  for (const directoryPath of directories) {
    const audiobook = await classifyDirectory(directoryPath)
    const validations = validateDirectory(audiobook)
    const shortPath = directoryPath.substring(39)
    show(shortPath.length === 0 ? '<root>' : shortPath, validations, {
      alwaysTitle: false,
      onlyFailures: true,
    })

    // rewriteDirectory(directoryPath, bookData);
  }
  // rewriteHint('}');
}

// The metadata for an audio file or an entire audiobook

// FileInfo and AudioMetadata for one file
interface AudioFile {
  info: FileInfo
  metadata: AudioMetadata
}
// Describe an Audiobook:
// - The files in the directory
// - The metadata in each of those files
interface AudioBook {
  directoryPath: string
  audioFiles: AudioFile[]
  metadata: AudioMetadata
}

// Eventually export a data structure for the directory
//  return a data structure or Validation?
async function classifyDirectory(directoryPath: string): Promise<AudioBook> {
  const fileInfos = await getFiles(directoryPath, {
    recurse: false,
    stat: true,
  })

  // - filter out non-audio files
  // - lookup metadata for each file
  const audioFiles = await Promise.all(
    fileInfos.filter(isAudioFile).map(AugmentFileInfo)
  )
  const audiobook: AudioBook = {
    directoryPath,
    audioFiles,
    metadata: {
      author: '',
      title: '',
      duration: 0,
    },
  }
  return audiobook
}

async function AugmentFileInfo(info: FileInfo): Promise<AudioFile> {
  const metadata = await getMetadataForSingleFile(info)
  return { info, metadata }
}

function validateDirectory(audiobook: AudioBook): Validation[] {
  const { audioFiles } = audiobook
  const validations: Validation[] = [
    validateFilesAllAccountedFor(audioFiles.map((file) => file.info)),
    validateUniqueAuthorTitle(audiobook),
  ]
  return validations
}

function validateUniqueAuthorTitle(audiobook: AudioBook): Validation {
  const { audioFiles } = audiobook
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
    level: 'warn',
    extra: { authors, titles },
  }
}

// remove duplicates from array
function dedupArray<T>(ary: T[]): T[] {
  const dedup = [...new Set(ary)]
  return dedup
}

// async function sleep(ms: number): Promise<void> {
//   return await new Promise((resolve) => setTimeout(resolve, ms))
// }
