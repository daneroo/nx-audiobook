import { type FileInfo, getFiles } from '@nx-audiobook/file-walk'
import { isAudioFile } from '@nx-audiobook/validators'
import { getMetadataForSingleFile } from '../metadata/main'
import type { AudioBook, AudioFile } from '../types'

// Audiobook represents the data for a Directory
// - the audio files in the directory
export async function classifyDirectory(
  directoryPath: string,
  sequentially = false
): Promise<AudioBook> {
  const fileInfos = await getFiles(directoryPath, {
    recurse: false,
    stat: true,
  })

  // - filter out non-audio files
  // - lookup metadata for each file
  // - either in parallel (Promise.all) or sequentially (for loop)
  const audioFiles = sequentially
    ? []
    : // Parallel - is faster than sequential - 3.797s ±  0.409s  (No cache: 77.888s ±  1.136s)
      await Promise.all(fileInfos.filter(isAudioFile).map(augmentFileInfo))
  if (sequentially) {
    // Sequential - is slower than parallel - 7.975s ±  0.991s (No cache: 97.116s ±  7.710s)
    for (const fileInfo of fileInfos.filter(isAudioFile)) {
      audioFiles.push(await augmentFileInfo(fileInfo))
    }
  }

  // Check for cover File (*.jpg, *.png)
  const coverFile = fileInfos.find((fileInfo) =>
    ['jpg', 'jpeg', 'png'].includes(
      // careful fileInfo.extension contains the leading "."
      fileInfo.extension.slice(1).toLowerCase()
    )
  )
  const coverFileFormat =
    coverFile === undefined
      ? 'application/octet-stream'
      : ['jpg', 'jpeg'].includes(
          coverFile.extension.slice(1).toLocaleLowerCase()
        )
      ? 'image/jpeg'
      : ['png'].includes(coverFile.extension.slice(1).toLocaleLowerCase())
      ? 'image/png'
      : 'application/octet-stream'

  // aggregates the AudioBookMetadata for the entire directories' audioFiles
  const duration = Math.round(
    audioFiles.reduce((sum, file) => sum + file.metadata.duration, 0)
  )
  // set author, title from metadata (first audio file)
  const author = audioFiles[0]?.metadata?.author ?? ''
  const title = audioFiles[0]?.metadata?.title ?? ''

  // Get the cover image from the first audioFile, or cover.{jpg|png}
  // - Could do a reduce to get the first non-empty metadata cover,
  //   but we have no occurrence of first file not having a cover, and subsequent files having a cover
  const cover =
    audioFiles[0]?.metadata?.cover ??
    (coverFile !== undefined
      ? {
          size: coverFile.size,
          // careful fileInfo.extension contains the leading "."
          format: coverFileFormat,
        }
      : undefined)

  const audiobook: AudioBook = {
    directoryPath,
    audioFiles,
    metadata: {
      author,
      title,
      duration,
      ...(cover === undefined ? {} : { cover }),
      warning: {
        // TODO(daneroo):these should be aggregated from the audioFiles
        // - if any audioFile has a warning, then the audiobook has a warning
        // ...(duration === 0 ? { duration: 'duration is 0' } : {}),
        // ...(cover === undefined ? { cover: 'no cover' } : {}),
      },
    },
    ...(coverFile === undefined ? {} : { coverFile }),
  }
  return audiobook
}

async function augmentFileInfo(fileInfo: FileInfo): Promise<AudioFile> {
  // getMetadataForSingleFile includes
  // - a fallback to ffprobe for duration
  // - a fallback for cover/coverFile
  const metadata = await getMetadataForSingleFile(fileInfo)
  return { fileInfo, metadata }
}
