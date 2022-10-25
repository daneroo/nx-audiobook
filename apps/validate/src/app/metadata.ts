import * as path from 'node:path'
import * as crypto from 'node:crypto'
import * as fs from 'node:fs/promises'
import { parseFile } from 'music-metadata'
import type { FileInfo } from '@nx-audiobook/file-walk'

export function metadata(): string {
  return 'metadata'
}

export interface AudioBookMetadata {
  author: string
  title: string
  duration: number
}

interface MetaOptions {
  duration: boolean
  includeChapters: boolean
}
interface FetchArgs {
  fileInfo: FileInfo
  options: MetaOptions
}

export async function getMetadataForSingleFile(
  fileInfo: FileInfo,
  options: MetaOptions = {
    duration: false, // much slower when true even for some .mp3
    includeChapters: false,
  }
): Promise<AudioBookMetadata> {
  return await cachedFetchResult<FetchArgs, AudioBookMetadata>(fetchResult, {
    fileInfo,
    options,
  })
  // return await fetchResult({ fileInfo, options })
}

// get metadata for a single audio file
export async function fetchResult(args: FetchArgs): Promise<AudioBookMetadata> {
  const { fileInfo, options } = args
  try {
    // DO NOT REUSE options object; it gets polluted! {...options} is a workaround
    const metadata = await parseFile(fileInfo.path, { ...options })
    return {
      author: metadata.common.artist ?? '',
      title: metadata.common.album ?? '',
      duration: metadata.format.duration ?? 0,
    }
  } catch (error) {
    throw new Error(`Error parsing metadata for ${fileInfo.path}`)
  }
}

// The rest is no specific to this file
const cacheDirectoryPath = path.join(process.cwd(), 'cache/metadata')

// Another way to specify this:
// type CacheableFetcher<Arg, Return> = (arg: Arg) => Promise<Return>
// fetcher: CacheableFetcher<Arg, Return>,

// call fetcher and store result in cache
async function cachedFetchResult<Arg, Return>(
  fetcher: (arg: Arg) => Promise<Return>,
  arg: Arg
): Promise<Return> {
  const cachedResult = await getCachedResult<Arg, Return>(arg)
  if (cachedResult != null) {
    return cachedResult
  }

  const result = await fetcher(arg)

  await fs.mkdir(cacheDirectoryPath, { recursive: true })
  await storeJSON(result, getCacheKeyPath(arg))
  return result
}

async function getCachedResult<Arg, Return>(arg: Arg): Promise<Return | null> {
  const cacheKeyPath = getCacheKeyPath(arg)
  try {
    const result = (await readJSON(cacheKeyPath)) as Return
    return result
  } catch (error) {}
  return null
}

function getCacheKeyPath<Arg>(arg: Arg): string {
  const cacheKey = sha256sum(JSON.stringify(arg))
  const cacheKeyPath = path.join(cacheDirectoryPath, `${cacheKey}.json`)
  return cacheKeyPath
}

// The functions below are for caching results
function sha256sum(input: string): string {
  return crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex')
}

async function storeJSON<T>(json: T, path: string): Promise<void> {
  const data = JSON.stringify(json, null, 2)
  await fs.writeFile(path, data)
}

async function readJSON<T>(path: string): Promise<T> {
  const data = await fs.readFile(path)
  const json = JSON.parse(data.toString()) as T
  return json
}
