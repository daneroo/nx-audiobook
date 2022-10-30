import { parseFile } from 'music-metadata'
import type { FileInfo } from '@nx-audiobook/file-walk'
import { cachedFetchResult } from '../cache/cache'
import type { AudioBookMetadata, CoverImage } from './types'

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

    const picture = metadata.common.picture?.[0]

    return {
      author: metadata.common.artist ?? '',
      title: metadata.common.album ?? '',
      duration,
      ...(picture === undefined
        ? {}
        : {
            cover: {
              size: picture.data.length,
              format: picture.format,
            },
          }),
    }
  } catch (error) {
    throw new Error(`music-metadata error: ${fileInfo.path}`)
  }
}

export async function getCoverImage(
  fileInfo: FileInfo
): Promise<CoverImage | undefined> {
  try {
    const metadata = await parseFile(fileInfo.path, { duration: false })
    const pictures = metadata.common.picture
    if (pictures === undefined) {
      return
    }
    if (pictures.length === 0) {
      console.error(`no pictures found in ${fileInfo.path}`)
      return
    }
    if (pictures.length > 1) {
      console.warn(`multiple pictures found in ${fileInfo.path}`)
    }
    const picture = pictures[0]
    if (picture === undefined) {
      console.error(`no pictures[0] found in ${fileInfo.path}`)
      return
    }
    if (!(picture.format === 'image/jpeg' || picture.format === 'image/png')) {
      console.error('cover image is not a jpeg|png file:', picture.format)
      return
    }
    // const cover = metadata.common.picture?.[0].data
    return {
      data: picture.data,
      format: picture.format,
    }
  } catch (error) {
    throw new Error(`music-metadata error: ${fileInfo.path}`)
  }
}
