import yargs from 'yargs/yargs';

import { FileInfo, getDirectories, getFiles } from '@nx-audiobook/file-walk';
import { formatElapsed } from '@nx-audiobook/time';
import {
  show,
  validateFilesAllAccountedFor,
  Validation,
} from '@nx-audiobook/validators';

const defaultRootPath = '/Volumes/Space/archive/media/audiobooks';

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

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
    const allFiles = await getFiles(rootPath, { recurse: true, stat: false });
    console.error(`Got ${allFiles.length} files in`, formatElapsed(startMs));

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const validation = validateFilesAllAccountedFor(allFiles);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    show('Global', [validation]);
  }

  // rewriteHint('export const db = {');
  // per directory validation
  for (const directoryPath of directories) {
    const audiobook = await classifyDirectory(directoryPath);
    validateDirectory(audiobook);
    // rewriteDirectory(directoryPath, bookData);
  }
  // rewriteHint('}');
}

// Maybe not the best name...
interface AudioBook {
  directoryPath: string;
  files: FileInfo[];
  metadata: AudioBookMetadata[];
}

interface AudioBookMetadata {
  path: string;
  author: string;
  title: string;
  duration: number;
}

// Eventually export a data structure for the directory
//  return a data structure or Validation?
async function classifyDirectory(directoryPath: string): Promise<AudioBook> {
  const audiobook: AudioBook = {
    directoryPath,
    files: await getFiles(directoryPath),
    metadata: [],
  };
  return audiobook;
}

function validateDirectory(audiobook: AudioBook): void {
  const { directoryPath, files } = audiobook;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const validation: Validation = validateFilesAllAccountedFor(files);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  show(directoryPath.length === 0 ? directoryPath.substring(39) : '<root>', [
    validation,
  ]);
}
