import { parseFile } from 'music-metadata'
import type { FileInfo } from '@nx-audiobook/file-walk'

export function metadata(): string {
  return 'metadata'
}

export interface AudioMetadata {
  author: string
  title: string
  duration: number
}

// get metadata for a single audio file
export async function getMetadataForSingleFile(
  fileInfo: FileInfo,
  options: { duration: boolean; includeChapters: boolean } = {
    duration: false, // much slower when true even for some .mp3
    includeChapters: false,
  }
): Promise<AudioMetadata> {
  // if (!isAudioFile(fileInfo)) {
  //   throw new Error(`Not an audio file: ${fileInfo.path}`)
  // }
  try {
    const metadata = await parseFile(fileInfo.path, options)
    return {
      author: metadata.common.artist ?? '',
      title: metadata.common.album ?? '',
      duration: metadata.format.duration ?? 0,
    }
  } catch (error) {
    throw new Error(`Error parsing metadata for ${fileInfo.path}`)
  }
}
