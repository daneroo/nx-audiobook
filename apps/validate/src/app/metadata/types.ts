export interface AudioBookMetadata {
  author: string
  title: string
  duration: number
  cover?: CoverImageDescriptor
}

export interface CoverImageDescriptor {
  size: number
  format: CoverImageFormat
}
export interface CoverImage {
  data: Buffer
  format: CoverImageFormat
}

export type CoverImageFormat = 'image/jpeg' | 'image/png' | string
