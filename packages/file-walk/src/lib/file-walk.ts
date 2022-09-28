import { walk } from '@root/walk';

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

// Returns all files from rootPath
// if options.recurse is false, only get files in rootPath, not subdirectories
export async function getFiles(
  rootPath: string,
  options: { recurse: boolean } = { recurse: false }
): Promise<string[]> {
  const pathnames = [];
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
      pathnames.push(pathname);
    } else {
      // dirent.isSymbolicLink(), etc...
      // console.error('  skipping', dirent.name)
    }
  });
  return pathnames;
}
