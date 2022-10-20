import yargs from 'yargs/yargs'

import { FileInfo, getDirectories, getFiles } from '@nx-audiobook/file-walk'
import { formatElapsed } from '@nx-audiobook/time'
import {
  show,
  validateFilesAllAccountedFor,
  Validation,
} from '@nx-audiobook/validators'

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
    show('Global', [validation])
  }

  // rewriteHint('export const db = {');
  // 2- Per directory validation
  for (const directoryPath of directories) {
    const audiobook = await classifyDirectory(directoryPath)
    validateDirectory(audiobook)
    // rewriteDirectory(directoryPath, bookData);
  }
  // rewriteHint('}');
}

// Maybe not the best name...
// Describe an Audiobook:
// - The files in the directory
// - The metadata in each of those files
interface AudioBook {
  directoryPath: string
  files: FileInfo[]
  metadata: AudioBookMetadata[]
}

interface AudioBookMetadata {
  path: string
  author: string
  title: string
  duration: number
}

// Eventually export a data structure for the directory
//  return a data structure or Validation?
async function classifyDirectory(directoryPath: string): Promise<AudioBook> {
  const audiobook: AudioBook = {
    directoryPath,
    files: await getFiles(directoryPath),
    metadata: [],
  }
  return audiobook
}

function validateDirectory(audiobook: AudioBook): void {
  const { directoryPath, files } = audiobook
  const validation: Validation = validateFilesAllAccountedFor(files)
  const shortPath = directoryPath.substring(39)
  show(shortPath.length === 0 ? '<root>' : shortPath, [validation])
}
