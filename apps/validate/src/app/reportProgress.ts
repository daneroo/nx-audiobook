import { getDirectories } from '@nx-audiobook/file-walk'
import { durationToHMS } from '@nx-audiobook/time'
import { db as hints } from './hints/db'
import { classifyDirectory } from './validate/classifyDirectory'
import type { AudioBook } from './types'

// legacyPath is the path of the original audiobooks
// stagingPath is the path of the migrated audiobooks
export async function reportProgress(
  legacyPath: string,
  stagingPath: string
  // verbosity: number
): Promise<void> {
  const legacyBooks = await getBooks(legacyPath)
  const stagingBooks = await getBooks(stagingPath)

  const legacyBooksMap = mapBooks(legacyBooks)
  const stagingBooksMap = mapBooks(stagingBooks)

  // Three buckets:
  // - legacy books not found in staging
  // - staging books not found in legacy
  // - legacy books found in staging
  // - legacy books not found in staging
  const legacyBooksNotInStaging = legacyBooks.filter((legacyBook) => {
    const stagingBook = stagingBooksMap.get(bookKey(legacyBook))
    return stagingBook === undefined
  })
  const stagingBooksNotInLegacy = stagingBooks.filter((stagingBook) => {
    const legacyBook = legacyBooksMap.get(bookKey(stagingBook))
    return legacyBook === undefined
  })

  const totalBooks = legacyBooks.length + stagingBooksNotInLegacy.length
  console.info(`# Progress

Progress report for moving audiobooks from Legacy to Staging

_Progress:_ ${stagingBooks.length} of ${totalBooks} ${(
    (stagingBooks.length / totalBooks) *
    100
  ).toFixed(1)}% (${legacyBooksNotInStaging.length} remaining)

- TOTAL+ - ${totalBooks} - Legacy U Staging:
- SOURCE - ${legacyBooks.length} \`${legacyPath}\` - Legacy books
- DONE++ - ${stagingBooks.length} \`${stagingPath}\` - Staging books
- REMAIN - ${legacyBooksNotInStaging.length} - Legacy books not in Staging
- ADDED - ${stagingBooksNotInLegacy.length} - Staging books not in Legacy
`)

  console.log(
    `## ADDED - Staging books not in Legacy (${stagingBooksNotInLegacy.length})\n`
  )
  for (const stagingBook of stagingBooksNotInLegacy) {
    console.log(`- ${bookKey(stagingBook)}`)
  }
  console.log() // nl

  // now compare the books that are in both legacy and staging
  const inBoth = stagingBooks.filter((stagingBook) => {
    const key = bookKey(stagingBook)
    const legacyBook = legacyBooksMap.get(key)
    return legacyBook !== undefined
  })
  console.log(
    `## REMAIN - Legacy books not in Staging (${legacyBooksNotInStaging.length})\n`
  )
  for (const stagingBook of legacyBooksNotInStaging) {
    console.log(`- ${bookKey(stagingBook)}`)
  }
  console.log() // nl

  console.log(`## Books already Migrated

There are ${inBoth.length} books which have been migrated.

Let's compare the effective audio bitrate (size/duration) for Legacy → Staging.

| Book | Effective | Bitrate |
| ---- | ---: | ---: |`)
  for (const stagingBook of inBoth) {
    const key = bookKey(stagingBook)
    const legacyBook = legacyBooksMap.get(key)
    if (legacyBook === undefined) {
      console.error(
        `=-=- Legacy book not found: ${key}. This should not happen`
      )
    } else {
      console.log(
        `| ${key} | ${bookEffectiveBitrate(
          legacyBook
        )} | ${bookEffectiveBitrate(stagingBook)} |`
      )
    }
  }
}

function bookEffectiveBitrate(book: AudioBook): string {
  // sum the audioFIles sizes
  const size = book.audioFiles.reduce((acc, file) => {
    return acc + file.fileInfo.size
  }, 0)
  const sizeInBytes = size
  const durationInSeconds = book.metadata.duration
  const kbps = (sizeInBytes * 8) / durationInSeconds / 1000.0
  // if (kbps > 1000) {
  //   const duration = durationToHMS(durationInSeconds)
  //   console.error('=-=-= kbps > 1000', kbps, duration, book.directoryPath)
  // }
  return `${kbps.toFixed(2)} kbps`
}

// function bookSize(book: AudioBook): string {
//   // sum the audioFIles sizes
//   const size = book.audioFiles.reduce((acc, file) => {
//     return acc + file.fileInfo.size
//   }, 0)
//   const sizeInMiB = (size / 1024 / 1024).toFixed(2)
//   return `${sizeInMiB} MiB`
// }
// function bookDuration(book: AudioBook): string {
//   return `${durationToHMS(book.metadata.duration)}`
// }

function bookKey(book: AudioBook): string {
  // replace author by 'multiple' if there are more than 2 authors (',' separated)
  const author =
    book.metadata.author.split(',').length > 2
      ? 'Multiple Authors'
      : book.metadata.author
  return `${author} - ${book.metadata.title}`
}
function mapBooks(books: AudioBook[]): Map<string, AudioBook> {
  const map = new Map<string, AudioBook>()
  for (const book of books) {
    map.set(bookKey(book), book)
  }
  return map
}
// only books that have audioFiles are returned

async function getBooks(path: string): Promise<AudioBook[]> {
  const directories = await getDirectories(path)
  const books = []
  for (const directoryPath of directories) {
    const hint = hints[directoryPath]
    const audiobook = await classifyDirectory(hint, directoryPath)

    // fix if there was no hint (for staging directory)
    if (hint === undefined && audiobook.audioFiles.length > 0) {
      if (audiobook.audioFiles[0]?.metadata !== undefined) {
        const { author, title } = audiobook.audioFiles[0].metadata
        audiobook.metadata.author = author
        audiobook.metadata.title = title
      } else {
        console.error('=-=-= Could not fix book:', directoryPath)
      }
    }

    books.push(audiobook)
  }
  return books.filter((book) => book.audioFiles.length > 0)
}
