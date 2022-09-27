import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const defaultRootPath = '/Volumes/Space/archive/media/audiobooks';

const argv = yargs(hideBin(process.argv))
  .option('rootPath', {
    alias: 'r',
    type: 'string',
    demandOption: true,
    default: defaultRootPath,
    describe: 'Path of the root directory to search from',
  })
  .parseSync();

// destructure arguments
const { rootPath: unverifiedRootPath } = argv;
// clean the root path by removing trailing slash
const rootPath = unverifiedRootPath.replace(/\/$/, '');

console.log('Hello rootPath:', rootPath);
