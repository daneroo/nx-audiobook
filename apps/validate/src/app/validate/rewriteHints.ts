import { durationToHMS } from '@nx-audiobook/time'
import { searchAudible, sortAudibleBooks } from '../audible/search'
import type { Hint, AuthorTitleHintReason } from '../hints/types'
import { promises as fs } from 'node:fs'
import { dedupArray } from './dedupArray'
import { classifyDirectory } from './classifyDirectory'

export async function rewriteHints(
  oldHints: Record<string, Hint>,
  fileName: string,
  directories: string[]
): Promise<void> {
  const newHints: Record<string, Hint> = {}
  for (const directoryPath of directories) {
    const oldHint = oldHints[directoryPath]

    const audiobook = await classifyDirectory(oldHint, directoryPath)
    if (audiobook.audioFiles.length === 0) {
      newHints[directoryPath] = {
        skip: 'no audio files',
      }
      continue
    } else {
      // audiobook.audioFiles.length > 0
      const { author, title, duration } = audiobook.metadata
      const authors = dedupArray(
        audiobook.audioFiles.map((file) => file.metadata.author)
      )
      const authorHintReason: AuthorTitleHintReason =
        authors.length === 1 &&
        authors[0] === author &&
        oldHint?.author?.[1] === 'unique'
          ? 'unique'
          : 'hint'
      const titles = dedupArray(
        audiobook.audioFiles.map((file) => file.metadata.title)
      )
      const titleHintReason: AuthorTitleHintReason =
        titles.length === 1 &&
        titles[0] === title &&
        oldHint?.title?.[1] === 'unique'
          ? 'unique'
          : 'hint'

      const hint: Hint = {
        author: [author, authorHintReason],
        title: [title, titleHintReason],
        '// duration': durationToHMS(duration),
      }

      // pass on hint.skip
      const oldHintSkip = oldHint?.skip
      if (oldHintSkip !== undefined) {
        hint.skip = oldHintSkip
      }

      // special if skip.hint==="multiple authors", overwrite authorHintReason, and add the list of authors in a special comment
      if (oldHintSkip === 'multiple authors') {
        hint.author = [author, 'multiple']
        hint['// multiple authors'] = authors
      }

      // asin section - if not skipped
      if (hint.skip === undefined) {
        const asins = await getAsins(duration, author, title)
        hint.asins = asins
      }

      newHints[directoryPath] = hint
    }
  }
  await fs.writeFile(
    fileName,
    `// cSpell:disable
import type { Hint } from './types'
export const db: Record<string, Hint> =
` + JSON.stringify(newHints, null, 2)
  )
}

async function getAsins(
  duration: number,
  author: string,
  title: string
): Promise<string[]> {
  const durationMeta = duration // rename to avoid shadowing
  const audibleBooks = await searchAudible({ author, title })
  const sortedAudible = sortAudibleBooks(audibleBooks, durationMeta)
  const deltaThreshold = 15 * 60 // 15 minutes
  const largeDuration = 1e7
  const asins = sortedAudible
    .map((book) => {
      // this is the duration from the audible result
      const { duration } = book
      const delta =
        duration > 0 ? Math.abs(duration - durationMeta) : largeDuration
      const check = delta <= deltaThreshold ? '✓' : '✗'

      // debug: just to see series
      // if (book.series !== '') {
      //   console.log('** series', book.series, 'position', book.seriesPosition)
      // }

      return {
        ...book,
        delta,
        check,
      }
    })
    // exact title match only
    // .filter((candidate) => candidate.title === title)
    // filter out books that are too far off
    .filter((candidate) => candidate.delta <= deltaThreshold)
    .map(
      ({ title, authors, narrators, duration, asin, delta, check }) =>
        `${asin}: ${check} Δ:${durationToHMS(delta)} - ${durationToHMS(
          duration
        )} -  ${title} / ${authors.join(',')} / n: ${narrators.join(',')}`
    )
  return asins
}
