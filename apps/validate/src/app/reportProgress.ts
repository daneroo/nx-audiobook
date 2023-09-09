import { getDirectories } from '@nx-audiobook/file-walk'
import { durationToHMS } from '@nx-audiobook/time'
import { db as hints } from './hints/db'
import { classifyDirectory } from './validate/classifyDirectory'
import type { AudioBook } from './types'
import { statSync } from 'node:fs'
import { format } from 'date-fns'

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
  const actuallySplit = stagingBooksNotInLegacy.filter((stagingBook) => {
    const wasSplit = legacySplit(bookKey(stagingBook))
    return wasSplit.length > 0
  })
  const actuallyRemaining = legacyBooksNotInStaging.filter((legacyBook) => {
    const wasConsolidated = stagingConsolidated(bookKey(legacyBook))
    const wasSplit = stagingSplit(bookKey(legacyBook))
    return wasSplit.length === 0 && wasConsolidated.length === 0
  })
  const remainingButSplit = legacyBooksNotInStaging.filter((legacyBook) => {
    const wasSplit = stagingSplit(bookKey(legacyBook))
    return wasSplit.length > 0
  })
  const remainingButConsolidated = legacyBooksNotInStaging.filter(
    (legacyBook) => {
      const wasConsolidated = stagingConsolidated(bookKey(legacyBook))
      return wasConsolidated.length > 0
    }
  )

  const totalBooks = stagingBooks.length + actuallyRemaining.length
  console.info(`# Progress

Progress report for moving audiobooks from Legacy to Staging

_Progress:_ ${stagingBooks.length} of ${totalBooks} ${(
    (stagingBooks.length / totalBooks) *
    100
  ).toFixed(1)}% (${actuallyRemaining.length} remaining)

- TOTAL - ${totalBooks} - Staging + Actually Remaining:
- SOURCE - ${legacyBooks.length} \`${legacyPath}\` - Legacy books
- DONE - ${stagingBooks.length} \`${stagingPath}\` - Staging books
- Staging books not in Legacy - ${stagingBooksNotInLegacy.length}
  - ADDED - ${
    actuallyAdded.length
  } - Staging books not in Legacy (actually added)
  - SPLIT - ${
    actuallySplit.length
  } - Staging books not in Legacy but split into 1+
- Legacy books not in Staging - ${legacyBooksNotInStaging.length}
  - Actually REMAINING - ${actuallyRemaining.length}
  - REMAINING but Split - ${remainingButSplit.length}
  - REMAINING but Consolidated - ${remainingButConsolidated.length}
`)

  console.log(
    `## ADDED - Staging books not in Legacy (${actuallyAdded.length})\n`
  )
  for (const stagingBook of actuallyAdded) {
    console.log(`- ${bookKey(stagingBook)}`)
  }
  console.log() // nl

  console.log(
    `## SPLIT - Staging books not in Legacy but split from one (${actuallySplit.length})\n`
  )
  for (const stagingBook of actuallySplit) {
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

  // - remain but split
  console.log(
    `## Legacy books not in Staging but Split into 1+ (${remainingButSplit.length})\n`
  )
  for (const stagingBook of remainingButSplit) {
    const wasSplit = stagingSplit(bookKey(stagingBook))
    console.log(
      `- ${bookKey(stagingBook)}${
        wasSplit.length > 0 ? ` (split into ${wasSplit})+` : ''
      }`
    )
  }
  console.log() // nl
  // - remain but consolidated
  console.log(
    `## Legacy books not in Staging but consolidated into one (${remainingButConsolidated.length})\n`
  )
  for (const stagingBook of remainingButConsolidated) {
    const wasConsolidated = stagingConsolidated(bookKey(stagingBook))
    console.log(
      `- ${bookKey(stagingBook)}${
        wasConsolidated.length > 0
          ? ` (consolidated into ${wasConsolidated})`
          : ''
      }`
    )
  }
  console.log() // nl

  // - actualy remaining

  console.log(
    `## REMAIN - Legacy books not in Staging (${actuallyRemaining.length})\n`
  )
  for (const stagingBook of actuallyRemaining) {
    console.log(`- ${bookKey(stagingBook)}`)
  }
  console.log() // nl

  console.log(`## Books already Migrated (${inBoth.length})\n`)

  for (const stagingBook of inBoth) {
    const key = bookKey(stagingBook)
    const legacyBook = legacyBooksMap.get(key)
    if (legacyBook === undefined) {
      console.error(
        `=-=- Legacy book not found: ${key}. This should not happen`
      )
    } else {
      console.log(`- ${bookKey(stagingBook)}`)
    }
  }
  console.log() // nl

  console.log(`## Staging Books with bitrate issues\n`)
  for (const book of stagingBooks) {
    const key = bookKey(book)
    // sum the audioFIles sizes
    const size = book.audioFiles.reduce((acc, file) => {
      return acc + file.fileInfo.size
    }, 0)
    const sizeInBytes = size
    const durationInSeconds = book.metadata.duration
    const kbps = (sizeInBytes * 8) / durationInSeconds / 1000.0
    if (kbps > 1000 || key.includes('atred')) {
      const duration = durationToHMS(durationInSeconds)
      console.log(
        `- ${key} dur: ${duration} size: ${sizeInBytes}b kbps: ${kbps.toFixed(
          2
        )} path: ${book.directoryPath}`
      )
    }
  }
  console.log() // nl

  console.log(`## Mtime estimates for Staging\n`)
  for (const book of stagingBooks) {
    const key = bookKey(book)
    const legacyBook = legacyBooksMap.get(key)
    // const mtime = legacyBook != null ? bookMtime(legacyBook) : bookMtime(book)
    if (legacyBook === undefined) {
      const wasSplit = legacySplit(key)
      if (wasSplit.length > 0) {
        const legacyBookFromSplit = legacyBooksMap.get(wasSplit)
        if (legacyBookFromSplit !== undefined) {
          const mtime = bookMtime(legacyBookFromSplit)
          const isoWithOffset = format(
            new Date(mtime),
            "yyyy-MM-dd'T'HH:mm:ssXXX"
          )
          console.log(
            `- ${key} mtime: ${isoWithOffset} (split from ${wasSplit})`
          )
        } else {
          console.error(
            `=-=- Legacy book not found: ${key} - ${wasSplit}. This should not happen`
          )
        }
      } else {
        console.log(`- ${key} mtime: MISSING LEGACY BOOK`)
      }
    } else {
      const mtime = bookMtime(legacyBook)
      // const iso = new Date(mtime).toISOString()
      // console.log(`- ${key} mtime: ${iso}`)
      const isoWithOffset = format(new Date(mtime), "yyyy-MM-dd'T'HH:mm:ssXXX")
      console.log(`- ${key} mtime: ${isoWithOffset}  (1:1)`)
    }
  }
  console.log() // nl
}

// function lookupLegacy(stagingBook) {
//   const wasSplit = legacySplit(bookKey(stagingBook))
//   const wasConsolidated = stagingConsolidated(bookKey(stagingBook))
//   const wasSplit = stagingSplit(bookKey(stagingBook))
// }

function bookMtime(book: AudioBook): number {
  const { audioFiles } = book
  // const hasAudioFiles = audioFiles.length > 0

  const mtimeRange = audioFiles.reduce(
    (acc, file) => {
      const mtime = file.fileInfo.mtime.getTime()
      return {
        minMtime: Math.min(acc.minMtime, mtime),
        maxMtime: Math.max(acc.maxMtime, mtime),
      }
    },
    { minMtime: Infinity, maxMtime: -Infinity }
  )
  // also add the directory mtime to the range
  const includeDirMtime = false
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (includeDirMtime) {
    const dirStat = statSync(book.directoryPath)
    // console.log('*****', audiobook.directoryPath, dirStat.mtime.getTime())
    mtimeRange.minMtime = Math.min(mtimeRange.minMtime, dirStat.mtime.getTime())
    mtimeRange.maxMtime = Math.max(mtimeRange.maxMtime, dirStat.mtime.getTime())
  }
  // ...
  // const rangeInHours =
  //   (mtimeRange.maxMtime - mtimeRange.minMtime) / (3600 * 1000)
  return mtimeRange.minMtime
}

// function bookEffectiveBitrate(book: AudioBook): string {
//   // sum the audioFIles sizes
//   const size = book.audioFiles.reduce((acc, file) => {
//     return acc + file.fileInfo.size
//   }, 0)
//   const sizeInBytes = size
//   const durationInSeconds = book.metadata.duration
//   const kbps = (sizeInBytes * 8) / durationInSeconds / 1000.0
//   // if (kbps > 1000) {
//   //   const duration = durationToHMS(durationInSeconds)
//   //   console.error('=-=-= kbps > 1000', kbps, duration, book.directoryPath)
//   // }
//   return `${kbps.toFixed(2)} kbps`
// }

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
    'Arthur Conan Doyle - A Study in Scarlet':
      'Arthur Conan Doyle - Sherlock Holmes: The Definitive Collection',
    'Arthur Conan Doyle - The Sign of Four':
      'Arthur Conan Doyle - Sherlock Holmes: The Definitive Collection',
    'Arthur Conan Doyle - The Adventures of Sherlock Holmes':
      'Arthur Conan Doyle - Sherlock Holmes: The Definitive Collection',
    'Arthur Conan Doyle - The Memoirs of Sherlock Holmes':
      'Arthur Conan Doyle - Sherlock Holmes: The Definitive Collection',
    'Arthur Conan Doyle - The Hound of the Baskervilles':
      'Arthur Conan Doyle - Sherlock Holmes: The Definitive Collection',
    'Arthur Conan Doyle - The Return of Sherlock Holmes':
      'Arthur Conan Doyle - Sherlock Holmes: The Definitive Collection',
    'Arthur Conan Doyle - The Valley of Fear':
      'Arthur Conan Doyle - Sherlock Holmes: The Definitive Collection',
    'Arthur Conan Doyle - His Last Bow':
      'Arthur Conan Doyle - Sherlock Holmes: The Definitive Collection',
    'Arthur Conan Doyle - The Casebook of Sherlock Holmes':
      'Arthur Conan Doyle - Sherlock Holmes: The Definitive Collection',

    'Brent Weeks - The Blinding Knife (1 of 3) [Dramatized Adaptation]':
      'Brent Weeks - The Blinding Knife',
    'Brent Weeks - The Blinding Knife (2 of 3) [Dramatized Adaptation]':
      'Brent Weeks - The Blinding Knife',
    'Brent Weeks - The Blinding Knife (3 of 3) [Dramatized Adaptation]':
      'Brent Weeks - The Blinding Knife',
    'Brent Weeks - The Broken Eye ( 1 of 3) [Dramatized Adaptation]':
      'Brent Weeks - The Broken Eye',
    'Brent Weeks - The Broken Eye ( 2 of 3) [Dramatized Adaptation]':
      'Brent Weeks - The Broken Eye',
    'Brent Weeks - The Broken Eye ( 3 of 3) [Dramatized Adaptation]':
      'Brent Weeks - The Broken Eye',
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
      'Brent Weeks - The Black Prism',
    'Brent Weeks - Black Prism (2 of 3) [Dramatized Adaptation]':
      'Brent Weeks - The Black Prism',
    'Brent Weeks - Black Prism (3 of 3) [Dramatized Adaptation]':
      'Brent Weeks - The Black Prism',

    'Jim Butcher - Side Jobs': 'Jim Butcher - Restoration of Faith',
    'Jim Butcher - Brief Cases': 'Jim Butcher - B is for Bigfoot',
  }
  return stagingToLegacy[stagingBookKey] ?? ''
}

// books from legacy that were consolidated into another title in staging
function stagingConsolidated(legacyBookKey: string): string {
  const legacyToStaging: Record<string, string> = {
    'Jim Butcher - Restoration of Faith': 'Jim Butcher - Side Jobs',
    'Jim Butcher - B is for Bigfoot': 'Jim Butcher - Brief Cases',
    'Jim Butcher - Vinette': 'Jim Butcher - Side Jobs',
    'Jim Butcher - Something Borrowed': 'Jim Butcher - Side Jobs',
    'Jim Butcher - I Was a Teenage Bigfoot': 'Jim Butcher - Brief Cases',
    'Jim Butcher - Its my Birthday too': 'Jim Butcher - Side Jobs',
    'Jim Butcher - Heorot': 'Jim Butcher - Side Jobs',
    'Jim Butcher - Day off': 'Jim Butcher - Side Jobs',
    'Jim Butcher - Backup': 'Jim Butcher - Side Jobs',
    'Jim Butcher - The Warrior': 'Jim Butcher - Side Jobs',
    'Jim Butcher - Last Call': 'Jim Butcher - Side Jobs',
    'Jim Butcher - Curses': 'Jim Butcher - Brief Cases',
    'Jim Butcher - Love Hurts': 'Jim Butcher - Side Jobs',
    'Jim Butcher - Even Hand': 'Jim Butcher - Brief Cases',
    'Jim Butcher - Bigfoot on Campus': 'Jim Butcher - Brief Cases',
    'Jim Butcher - Aftermath': 'Jim Butcher - Side Jobs',
    'Jim Butcher - Bombshells': 'Jim Butcher - Brief Cases',
    'Jim Butcher - Jury Duty': 'Jim Butcher - Brief Cases',
    'Jim Butcher - Cold Case': 'Jim Butcher - Brief Cases',

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

// books from legacy that were split into many another titles in staging, return the first
function stagingSplit(legacyBookKey: string): string {
  const legacyToStaging: Record<string, string> = {
    'Arthur Conan Doyle - Sherlock Holmes: The Definitive Collection':
      'Arthur Conan Doyle - A Study in Scarlet',

    'Brent Weeks - The Black Prism':
      'Brent Weeks - The Black Prism (1 of 3) [Dramatized Adaptation]',
    'Brent Weeks - The Blinding Knife':
      'Brent Weeks - The Blinding Knife (1 of 3) [Dramatized Adaptation]',
    'Brent Weeks - The Broken Eye':
      'Brent Weeks - The Broken Eye ( 1 of 3) [Dramatized Adaptation]',
    'Brent Weeks - The Blood Mirror':
      'Brent Weeks - The Blood Mirror (1 of 2) [Dramatized Adaptation]',
    'Brent Weeks - The Burning White':
      'Brent Weeks - The Burning White (1 of 5) [Dramatized Adaptation]',
  }
  return legacyToStaging[legacyBookKey] ?? ''
}
