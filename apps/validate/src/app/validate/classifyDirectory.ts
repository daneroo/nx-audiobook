import { FileInfo, getFiles } from '@nx-audiobook/file-walk'
import { isAudioFile } from '@nx-audiobook/validators'
import { getMetadataForSingleFile, ffprobe } from '../metadata/main'
import type { Hint } from '../hints/types'
import type { AudioBook, AudioFile } from '../types'

// Audiobook represents the data for a Directory
// - the audio files in the directory
// requires a hint (author/title), but should have a default from metadata
export async function classifyDirectory(
  hint: Hint | undefined,
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

  // Check for cover File
  // - could also look for cover.png
  const coverFile = fileInfos.find(
    (fileInfo) => fileInfo.basename === 'cover.jpg'
  )
  if (coverFile !== undefined) {
    console.log('coverFile:', coverFile)
  }
  // aggregates the AudioBookMetadata for the entire directories' audioFiles
  // and overrides with hints for author and title, if present.
  const duration = Math.round(
    audioFiles.reduce((sum, file) => sum + file.metadata.duration, 0)
  )
  // set author, title from hints
  const author = hint?.author?.[0] ?? ''
  const title = hint?.title?.[0] ?? ''

  // Get the cover image from the first audioFile, or cover.{jpg|png}
  // - Could do a reduce to get the first non-empty metadata cover,
  //   but we have no occurrence of first file not having a cover, and subsequent files having a cover
  const cover =
    audioFiles[0]?.metadata?.cover ??
    (coverFile !== undefined
      ? {
          size: coverFile.size,
          format: 'image/jpeg',
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
    },
    ...(coverFile === undefined ? {} : { coverFile }),
  }
  return audiobook
}

async function augmentFileInfo(fileInfo: FileInfo): Promise<AudioFile> {
  const metadata = await getMetadataForSingleFile(fileInfo)

  // TODO: Move this to separate app/command; Experiment; get both and compare
  // This shows the difference between ffprobe and music-metadata duration
  // const ffMetadata = await ffprobe(fileInfo)
  // const dd = Math.abs(ffMetadata.duration - metadata.duration)
  // const durationDeltaThreshold = 300 // in seconds
  // if (dd > durationDeltaThreshold && metadata.duration > 0) {
  //   console.log('duration delta:', {
  //     delta: durationToHMS(dd),
  //     ff: durationToHMS(ffMetadata.duration),
  //     mm: durationToHMS(metadata.duration),
  //     '/': fileInfo.path,
  //   })
  // }
  if (metadata.duration === 0) {
    // resolve duration===0 with ffprobe
    const ffMetadata = await ffprobe(fileInfo)
    metadata.duration = ffMetadata.duration
  }
  return { fileInfo, metadata }
}
