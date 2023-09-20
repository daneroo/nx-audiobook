import yargs from 'yargs/yargs'

import { getDirectories, getFiles } from '@nx-audiobook/file-walk'
import { show, validateFilesAllAccountedFor } from '@nx-audiobook/validators'
import { validateDirectory } from './app/validate/validateDirectory'
import { classifyDirectory } from './app/validate/classifyDirectory'
import { convertDirectory } from './app/validate/convertDirectory'
import { fixModTimeHintPerDirectory } from './app/validate/validateModTime'

const defaultRootPath = '/Volumes/Reading/audiobooks'

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
    .option('convertDir', {
      type: 'string',
      nargs: 1,
      describe:
        'convert audio into destination path: e.g.: --convert /Volumes/Space/Scratch/convert',
    })
    .option('mtime', {
      type: 'string',
      choices: ['check', 'fix'], // Limit the options to 'check' or 'fix'
      describe: 'Fix (or check) modification time of audio files',
    })
    .count('verbose')
    .alias('v', 'verbose')
    .help()
    .parseAsync()

  // destructure arguments
  const {
    rootPath: unverifiedRootPath,
    convertDir,
    verbose: verbosity,
    mtime: mtimeMethod,
  } = argv
  // clean the root path by removing trailing slash
  const rootPath = unverifiedRootPath.replace(/\/$/, '')

  // 5- mtime (Moved here to no pollute stdout)
  if (mtimeMethod !== undefined) {
    console.log('=-=- Mtime:', mtimeMethod)
    const dryRun = mtimeMethod !== 'fix'
    await fixModTimeHintPerDirectory(rootPath, dryRun)
    // exit the program early
    return
  }

  console.info('=- Classify and Validate:', { rootPath })

  // 1- Global validation
  // - still needed for validateFilesAllAccountedFor,
  // because AudioBook returned from classifyDirectory does not have the full list of files (just audio files)
  await validateGlobal(rootPath, verbosity)

  // 2- Per directory validation
  await validatePerDirectory(rootPath, verbosity)

  // 3 - convert
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
    const audiobook = await classifyDirectory(directoryPath)
    const validations = validateDirectory(audiobook)
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
    `=-=- Total books: ${totalBooks} from ${directories.length} directories`
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
    const audiobook = await classifyDirectory(directoryPath)
    await convertDirectory(audiobook, convertDir)
  }
}
