import { parseFile } from 'music-metadata'
import type { FileInfo } from '@nx-audiobook/file-walk'
import { cachedFetchResult } from '../cache/cache'

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
  return await cachedFetchResult<FetchArgs, AudioBookMetadata>(
    fetchResult,
    {
      fileInfo,
      options,
    },
    'metadata'
  )
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
