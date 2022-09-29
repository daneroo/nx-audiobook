import yargs from 'yargs';
import { getDirectories, getFiles } from '@nx-audiobook/file-walk';
import { formatElapsed } from '@nx-audiobook/time';
import { validateFilesAllAccountedFor } from '@nx-audiobook/validators';

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
  console.error('=-=- Validate:', { rootPath });

  const startMs = +new Date();
  const directories = await getDirectories(rootPath);
  console.error(
    `Got ${directories.length} directories in`,
    formatElapsed(startMs)
  );
  {
    const startMs = +new Date();
    const allFiles = await getFiles(rootPath, { recurse: true });
    console.error(`Got ${allFiles.length} files in`, formatElapsed(startMs));
    const advice = validateFilesAllAccountedFor(allFiles);
    console.error('advice', advice);
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
