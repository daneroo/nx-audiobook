import yargs from 'yargs/yargs'

import { getDirectories, getFiles } from '@nx-audiobook/file-walk'
import { show, validateFilesAllAccountedFor } from '@nx-audiobook/validators'
import { db as hints } from './app/hints/db'
import { validateDirectory } from './app/validate/validateDirectory'
import { classifyDirectory } from './app/validate/classifyDirectory'
import { rewriteHints } from './app/validate/rewriteHints'

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
      // demandOption: true,
      // default: defaultRootPath,
      describe:
        'Path of hints file to rewrite e.g.: --rewriteHints=src/app/hints/newdb.ts',
    })
    .count('verbose')
    .alias('v', 'verbose')
    .help()
    .parseAsync()

  // destructure arguments
  const {
    rootPath: unverifiedRootPath,
    rewriteHintsDB,
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
  }
}
