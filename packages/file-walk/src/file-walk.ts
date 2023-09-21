import { walk, type WalkFunc } from '@root/walk'

import { basename, extname } from 'node:path'
import { promises as fs } from 'node:fs'

// Returns all subdirectories of rootPath, recursively, including rootPath itself
export async function getDirectories(rootPath: string): Promise<string[]> {
  const directories: string[] = []
  // eslint-disable-next-line @typescript-eslint/require-await
  const walker: WalkFunc = async (err, pathname, dirent) => {
    if (err !== null && err !== undefined) {
      // throw an error to stop walking (or return to ignore and keep going)
      console.warn('fs stat error for %s: %s', pathname, err.message)
      return false
    }
    if (dirent.isDirectory()) {
      directories.push(pathname)
      return true
    }
    return false
  }

  await walk(rootPath, walker)
  return directories
}

export interface FileInfo {
  path: string
  basename: string
  extension: string
  size: number
  mtime: Date
}

// Returns all files (as File Objects) from rootPath
// if options.recurse is false, only get files in rootPath, not subdirectories
// if options.stat is false, only get path extension and name, not size or mtime
export async function getFiles(
  rootPath: string,
  options: { recurse: boolean; stat: boolean } = { recurse: false, stat: false }
): Promise<FileInfo[]> {
  const files: FileInfo[] = []

  const walker: WalkFunc = async (err, pathname, dirent) => {
    if (err !== null && err !== undefined) {
      // throw an error to stop walking (or return to ignore and keep going)
      console.warn('fs stat error for %s: %s', pathname, err.message)
      return false
    }
    if (dirent.isDirectory()) {
      // We recurse into subdirectories when either
      // - recurse parameter is true
      // - we are at the root
      return options.recurse || rootPath === pathname
    } else if (dirent.isFile()) {
      const { size, mtime } = options.stat
        ? await fs.stat(pathname)
        : { size: 0, mtime: new Date(0) }
      const file: FileInfo = {
        path: pathname,
        basename: basename(pathname),
        extension: extname(pathname),
        size,
        mtime,
      }
      files.push(file)
    }
    return false
  }
  await walk(rootPath, walker)
  return files
}

// Return a single FileInfo object for the directory at pathname
export async function getDirectory(pathname: string): Promise<FileInfo> {
  const { size, mtime } = await fs.stat(pathname)
  const file: FileInfo = {
    path: pathname,
    basename: basename(pathname),
    extension: extname(pathname),
    size,
    mtime,
  }
  return file
}
