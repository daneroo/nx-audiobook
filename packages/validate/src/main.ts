import yargs from 'yargs';
import { getDirectories } from '@nx-audiobook/file-walk';
import { hideBin } from 'yargs/helpers';

const defaultRootPath = '/Volumes/Space/archive/media/audiobooks';

main();

async function main() {
  const argv = await yargs(hideBin(process.argv))
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
}

/**
 * Formats the time since the startMs to a string
 * @param {number} startMs - reference start time in milliseconds
 * @returns {string} Return the formatted string
 */

export function formatElapsed(startMs) {
  const elapsedSeconds = ((+new Date() - startMs) / 1000).toFixed(3);
  return elapsedSeconds + 's';
}
