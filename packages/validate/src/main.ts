import yargs from 'yargs';
import { getDirectories, getFiles } from '@nx-audiobook/file-walk';
import { formatElapsed } from '@nx-audiobook/time';

const defaultRootPath = '/Volumes/Space/archive/media/audiobooks';

main();

async function main() {
  const argv = await yargs(process.argv.slice(2))
    .option('rootPath', {
      alias: 'r',
      type: 'string',
      demandOption: true,
      default: defaultRootPath,
      describe: 'Path of the root directory to search from',
    })
    .help()
    .parseAsync();

  // destructure arguments
  const { rootPath: unverifiedRootPath } = argv;
  // clean the root path by removing trailing slash
  const rootPath = unverifiedRootPath.replace(/\/$/, '');

  const startMs = +new Date();
  const directories = await getDirectories(rootPath);
  console.error(
    `Got ${directories.length} directories in`,
    formatElapsed(startMs)
  );
  if (directories.length === 0) {
    // fake false!
    const startMs = +new Date();
    const allFiles = await getFiles(rootPath, { recurse: true });
    console.error(`Got ${allFiles.length} files in`, formatElapsed(startMs));
    // verifyExtensionsAllAccountedFor(allFiles)
  }
  // rewriteHint('export const db = {');
  // per directory validation
  // for (const directoryPath of directories) {
  //   const bookData = await classifyDirectory(directoryPath);
  //   validateDirectory(directoryPath, bookData);
  //   rewriteDirectory(directoryPath, bookData);
  // }
  // rewriteHint('}');
}
