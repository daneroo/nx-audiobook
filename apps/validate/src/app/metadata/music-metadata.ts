import { parseFile } from 'music-metadata'
import type { FileInfo } from '@nx-audiobook/file-walk'
import { cachedFetchResult } from '../cache/cache'
import type { AudioBookMetadata } from './types'

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
    'music-metadata'
  )
}

// get metadata for a single audio file
export async function fetchResult(args: FetchArgs): Promise<AudioBookMetadata> {
  const { fileInfo, options } = args
  try {
    // DO NOT REUSE options object; it gets polluted! {...options} is a workaround
    const metadata = await parseFile(fileInfo.path, { ...options })
    // special case: duration can be NaN, which would turn into null after JSON.stringify|parse
    const duration = isNaN(metadata.format.duration ?? 0)
      ? 0
      : metadata.format.duration ?? 0
    return {
      author: metadata.common.artist ?? '',
      title: metadata.common.album ?? '',
      duration,
    }
  } catch (error) {
    throw new Error(`music-metadata error: ${fileInfo.path}`)
  }
}
