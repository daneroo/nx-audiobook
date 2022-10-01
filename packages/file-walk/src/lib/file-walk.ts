import { walk } from '@root/walk';
import { basename, extname } from 'node:path';
import { promises as fs } from 'node:fs';

// Returns all subdirectories of rootPath, recursively, including rootPath itself
export async function getDirectories(rootPath: string): Promise<string[]> {
  const directories = [];
  await walk(rootPath, async (err, pathname, dirent) => {
    if (err) {
      // throw an error to stop walking (or return to ignore and keep going)
      console.warn('fs stat error for %s: %s', pathname, err.message);
      return;
    }
    if (dirent.isDirectory()) {
      directories.push(pathname);
    }
  });
  return directories;
}

export type FileInfo = {
  path: string;
  basename: string;
  extension: string;
  size: number;
  mtime: Date;
};

// Returns all files (as File Objects) from rootPath
// if options.recurse is false, only get files in rootPath, not subdirectories
// if options.stat is false, only get path extension and name, not size or mtime
export async function getFiles(
  rootPath: string,
  options: { recurse: boolean; stat: boolean } = { recurse: false, stat: false }
): Promise<FileInfo[]> {
  const files: FileInfo[] = [];
  await walk(rootPath, async (err, pathname, dirent) => {
    if (err) {
      // throw an error to stop walking (or return to ignore and keep going)
      console.warn('fs stat error for %s: %s', pathname, err.message);
      return;
    }
    if (dirent.isDirectory()) {
      // We recurse into subdirectories when either
      // - recurse parameter is true
      // - we are at the root
      return options?.recurse || rootPath === pathname;
    } else if (dirent.isFile()) {
      const { size, mtime } = options?.stat
        ? await fs.stat(pathname)
        : { size: 0, mtime: new Date(0) };
      const file: FileInfo = {
        path: pathname,
        basename: basename(pathname),
        extension: extname(pathname),
        size,
        mtime,
      };
      files.push(file);
    } else {
      // dirent.isSymbolicLink(), etc...
      // console.error('  skipping', dirent.name)
    }
  });
  return files;
}
