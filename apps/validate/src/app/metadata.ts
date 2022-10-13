import { parseFile } from 'music-metadata'
import type { FileInfo } from '@nx-audiobook/file-walk'
import { isAudioFile } from '@nx-audiobook/validators'

export function metadata(): string {
  return 'metadata'
}

export interface AudioBookMetadata {
  path: string
  author?: string
  title?: string
  duration?: number
}

// get metadata for a single audio file
export async function getMetadataForSingleFile(
  fileInfo: FileInfo,
  options: { duration: boolean; includeChapters: boolean } = {
    duration: false, // much slower when true even for some .mp3
    includeChapters: false,
  }
): Promise<AudioBookMetadata | null> {
  if (!isAudioFile(fileInfo)) {
    return null
  }
  try {
    const metadata = await parseFile(fileInfo.path, options)
    return {
      path: fileInfo.path,
      author: metadata.common.artist ?? '',
      title: metadata.common.album ?? '',
      duration: metadata.format.duration ?? 0,
    }
  } catch (error) {
    console.error(`Error parsing metadata for ${fileInfo.path}`)
    return null
  }
}
