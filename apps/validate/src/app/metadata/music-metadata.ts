import type { IPicture } from 'music-metadata'
import { parseFile } from 'music-metadata'
import type { FileInfo } from '@nx-audiobook/file-walk'
import { cachedFetchResult } from '../cache/cache'
import type {
  AudioBookMetadata,
  CoverImage,
  CoverImageDescriptor,
} from './types'
import { ffprobe } from './ffprobe'
import imageType from 'image-type'

interface MetaOptions {
  duration: boolean
  includeChapters: boolean
}
interface FetchArgs {
  fileInfo: FileInfo
  options: MetaOptions
}

// getMetadataForSingleFile includes a fallback to ffprobe for duration, and fallback for cover/coverFile
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

    const { duration, warning: durationWarning } = await fixDuration(
      metadata.format.duration,
      fileInfo
    )
    const { cover, warning: coverWarning } = await fixCoverImage(
      metadata.common.picture?.[0]
    )

    return {
      author: metadata.common.artist ?? '',
      title: metadata.common.album ?? '',
      duration,
      ...(cover !== undefined && { cover }),
      warning: {
        ...(durationWarning !== undefined && { duration: durationWarning }),
        ...(coverWarning !== undefined && { cover: coverWarning }),
      },
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

    const { cover, warning } = await fixCoverImage(picture)
    if (warning !== undefined) {
      console.warn(`fixCoverImage warning: ${warning}`)
    }
    if (cover === undefined) {
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

// overrides duration w/ ffprobe if required
async function fixDuration(
  duration: number | undefined,
  fileInfo: FileInfo
): Promise<{ duration: number; warning?: string }> {
  // if !ok override with ffprobe, and add warning
  if (duration === undefined || duration === 0 || isNaN(duration)) {
    // resolve duration===0 with ffprobe
    const ffMetadata = await ffprobe(fileInfo)
    return {
      duration: ffMetadata.duration,
      warning: 'overridden with ffprobe',
    }
  }
  return { duration }
}

// This is to validate that the cover image is actually the type it claims to be
// metadata.common.picture?.[].format sometimes has the wrong value
// we fix this with a comparison to imageType, based on header bytes in a buffer
// we return the corrected format, and a warning if it was wrong
async function fixCoverImage(
  picture: IPicture | undefined // from music-metadata: metadata.common.picture?.[0].data
): Promise<{ cover?: CoverImageDescriptor; warning?: string }> {
  if (picture === undefined) {
    return {} // no cover , no warning
  }
  try {
    const { format } = picture
    const actualType = await imageType(picture.data)
    if (actualType === undefined) {
      return {
        warning: `unrecognized cover image format: ${format}`,
      }
    }
    const { mime: actualFormat } = actualType
    if (actualFormat !== 'image/jpeg' && actualFormat !== 'image/png') {
      return {
        warning: `unsupported cover image format: ${actualFormat}`,
      }
    }
    return {
      cover: {
        size: picture.data.length,
        format: actualFormat,
      },
      ...(actualFormat !== format && {
        warning: `cover image type mismatch: music-meta:${format} actual:${actualFormat}`,
      }),
    }
  } catch (error) {
    // console.error('fixCoverImage error:', error)
    return {
      warning: `unrecognized cover image`,
    }
  }
}
