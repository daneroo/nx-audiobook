export type AuthorTitleHintReason = 'hint' | 'unique' | 'multiple'

export interface Hint {
  // [key: string]: string | [string, AuthorTitleHintReason] | string[]
  author?: [string, AuthorTitleHintReason]
  title?: [string, AuthorTitleHintReason]
  '// multiple authors'?: string[]
  // '// multiple titles'?: string[]
  '// duration'?: string
  asins?: string[]
  skip?: 'no audio files' | 'not on audible' | 'multiple authors'
}
