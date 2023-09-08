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
  const actuallyAdded = stagingBooksNotInLegacy.filter((stagingBook) => {
    const wasSplit = legacySplit(bookKey(stagingBook))
    return wasSplit.length === 0
  })
  const actuallyConsolidated = stagingBooksNotInLegacy.filter((stagingBook) => {
    const wasSplit = legacySplit(bookKey(stagingBook))
    return wasSplit.length > 0
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
- NEW - ${stagingBooksNotInLegacy.length} - Staging books not in Legacy
  - ADDED - ${
    actuallyAdded.length
  } - Staging books not in Legacy (actually added)
  - CONSOL - ${
    actuallyConsolidated.length
  } - Staging books not in Legacy (consolidated)
`)

  console.log(
    `## ADDED - Staging books not in Legacy (${actuallyAdded.length})\n`
  )
  for (const stagingBook of actuallyAdded) {
    console.log(`- ${bookKey(stagingBook)}`)
  }
  console.log() // nl

  console.log(
    `## CONSOLIDATED - Staging books not in Legacy but split from one (${actuallyConsolidated.length})\n`
  )
  for (const stagingBook of actuallyConsolidated) {
    const wasSplit = legacySplit(bookKey(stagingBook))
    console.log(
      `- ${bookKey(stagingBook)} ${
        wasSplit.length > 0 ? `(from ${wasSplit})` : ''
      }`
    )
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

// These books were split
// map by key (author - title) in staging to legacy
function legacySplit(stagingBookKey: string): string {
  // map from new (staging) key -> legacy key
  const stagingToLegacy: Record<string, string> = {
    'Brent Weeks - The Blinding Knife (1 of 3) [Dramatized Adaptation]':
      'Brent Weeks - The Blinding Knife',
    'Brent Weeks - The Blinding Knife (2 of 3) [Dramatized Adaptation]':
      'Brent Weeks - The Blinding Knife',
    'Brent Weeks - The Blinding Knife (3 of 3) [Dramatized Adaptation]':
      'Brent Weeks - The Blinding Knife',
    'Brent Weeks - The Broken Eye ( 1 of 3) [Dramatized Adaptation]':
      'Brent Weeks - The Broken Eye ',
    'Brent Weeks - The Broken Eye ( 2 of 3) [Dramatized Adaptation]':
      'Brent Weeks - The Broken Eye ',
    'Brent Weeks - The Broken Eye ( 3 of 3) [Dramatized Adaptation]':
      'Brent Weeks - The Broken Eye ',
    'Brent Weeks - The Blood Mirror (1 of 2) [Dramatized Adaptation]':
      'Brent Weeks - The Blood Mirror',
    'Brent Weeks - The Blood Mirror (2 of 2) [Dramatized Adaptation]':
      'Brent Weeks - The Blood Mirror',
    'Brent Weeks - The Burning White (1 of 5) [Dramatized Adaptation]':
      'Brent Weeks - The Burning White',
    'Brent Weeks - The Burning White (2 of 5) [Dramatized Adaptation]':
      'Brent Weeks - The Burning White',
    'Brent Weeks - The Burning White (3 of 5) [Dramatized Adaptation]':
      'Brent Weeks - The Burning White',
    'Brent Weeks - The Burning White (4 of 5) [Dramatized Adaptation]':
      'Brent Weeks - The Burning White',
    'Brent Weeks - The Burning White (5 of 5) [Dramatized Adaptation]':
      'Brent Weeks - The Burning White',
    'Brent Weeks - Black Prism (1 of 3) [Dramatized Adaptation]':
      'Brent Weeks - Black Prism',
    'Brent Weeks - Black Prism (2 of 3) [Dramatized Adaptation]':
      'Brent Weeks - Black Prism',
    'Brent Weeks - Black Prism (3 of 3) [Dramatized Adaptation]':
      'Brent Weeks - Black Prism',

    'Arthur Conan Doyle - A Study in Scarlet':
      'Sherlock Holmes The Definitive Audio Collection',
    'Arthur Conan Doyle - The Sign of Four':
      'Sherlock Holmes The Definitive Audio Collection',
    'Arthur Conan Doyle - The Adventures of Sherlock Holmes':
      'Sherlock Holmes The Definitive Audio Collection',
    'Arthur Conan Doyle - The Memoirs of Sherlock Holmes':
      'Sherlock Holmes The Definitive Audio Collection',
    'Arthur Conan Doyle - The Hound of the Baskervilles':
      'Sherlock Holmes The Definitive Audio Collection',
    'Arthur Conan Doyle - The Return of Sherlock Holmes':
      'Sherlock Holmes The Definitive Audio Collection',
    'Arthur Conan Doyle - The Valley of Fear':
      'Sherlock Holmes The Definitive Audio Collection',
    'Arthur Conan Doyle - His Last Bow':
      'Sherlock Holmes The Definitive Audio Collection',
    'Arthur Conan Doyle - The Casebook of Sherlock Holmes':
      'Sherlock Holmes The Definitive Audio Collection',
  }
  return stagingToLegacy[stagingBookKey] ?? ''
}

function stagingConsolidated(legacyBookKey: string): string {
  // map from legacy key -> new (staging) key
  // - Jim Butcher - Side Jobs
  // - Jim Butcher - Brief Cases

  const legacyToStaging: Record<string, string> = {
    'Jim Butcher - Restoration of Faith': 'Side Jobs',
    'Jim Butcher - B is for Bigfoot': 'Brief Cases',
    'Jim Butcher - Vinette': 'Side Jobs',
    'Jim Butcher - Something Borrowed': 'Side Jobs',
    'Jim Butcher - I Was a Teenage Bigfoot': 'Brief Cases',
    'Jim Butcher - Its my Birthday too': 'Side Jobs',
    'Jim Butcher - Heorot': 'Side Jobs',
    'Jim Butcher - Day off': 'Side Jobs',
    'Jim Butcher - Backup': 'Side Jobs',
    'Jim Butcher - The Warrior': 'Side Jobs',
    'Jim Butcher - Last Call': 'Side Jobs',
    'Jim Butcher - Curses': 'Brief Cases',
    'Jim Butcher - Love Hurts': 'Side Jobs',
    'Jim Butcher - Even Hand': 'Brief Cases',
    'Jim Butcher - Bigfoot on Campus': 'Brief Cases',
    'Jim Butcher - Aftermath': 'Side Jobs',
    'Jim Butcher - Bombshells': 'Brief Cases',
    'Jim Butcher - Jury Duty': 'Brief Cases',
    'Jim Butcher - Cold Case': 'Brief Cases',

    'Brandon Sanderson - Sixth of the Dusk':
      'Brandon Sanderson - Arcanum Unbounded: The Cosmere Collection',
    'Brandon Sanderson - Allomancer Jak and the Pits of Eltania':
      'Brandon Sanderson - Arcanum Unbounded: The Cosmere Collection',
    'Brandon Sanderson - The Eleventh Metal':
      'Brandon Sanderson - Arcanum Unbounded: The Cosmere Collection',
    'Brandon Sanderson - The Hope of Elantris':
      'Brandon Sanderson - Arcanum Unbounded: The Cosmere Collection',
    'Brandon Sanderson - Shadows for Silence in the Forests of Hell':
      'Brandon Sanderson - Arcanum Unbounded: The Cosmere Collection',
  }
  return legacyToStaging[legacyBookKey] ?? ''
}
