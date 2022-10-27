import type { FileInfo } from '@nx-audiobook/file-walk'
import type { AudioBookMetadata } from './metadata/main'

// The metadata for an audio file or an entire audiobook
// FileInfo and AudioMetadata for one file
export interface AudioFile {
  fileInfo: FileInfo
  metadata: AudioBookMetadata
}
// Describe an Audiobook:
// - The files in the directory
// - The metadata in each of those files
export interface AudioBook {
  directoryPath: string
  audioFiles: AudioFile[]
  metadata: AudioBookMetadata
}
