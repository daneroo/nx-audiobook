import yargs from 'yargs';
import { FileInfo, getDirectories, getFiles } from '@nx-audiobook/file-walk';
import { formatElapsed } from '@nx-audiobook/time';
import { show, validateFilesAllAccountedFor } from '@nx-audiobook/validators';

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
    const allFiles = await getFiles(rootPath, { recurse: true, stat: false });
    console.error(`Got ${allFiles.length} files in`, formatElapsed(startMs));

    const validation = validateFilesAllAccountedFor(allFiles);
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
type AudioBook = {
  directoryPath: string;
  files: FileInfo[];
  metadata: AudioBookMetadata[];
};

type AudioBookMetadata = {
  path: string;
  author: string;
  title: string;
  duration: number;
};

// Eventually export a data structure for the directory
//  return a data structure or Validation?
async function classifyDirectory(directoryPath) {
  const audiobook: AudioBook = {
    directoryPath,
    files: await getFiles(directoryPath),
    metadata: [],
  };
  return audiobook;
}

async function validateDirectory(audiobook: AudioBook) {
  const { directoryPath, files } = audiobook;
  const validation = validateFilesAllAccountedFor(files);
  show(directoryPath.substring(39) || '<root>', [validation]);
}
