import { describe, expect, test, it, beforeEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import {
  fetchResult,
  searchAudible,
  sortAudibleBooks,
  urlHrefForSearch,
} from './search'

// This adds the proper type for process.env.CACHE_BASE_DIRECTORY, so we can use the dot notation and delete operator
declare let process: { env: { CACHE_BASE_DIRECTORY?: string } }

const cacheBaseDirectory = path.join(__dirname, 'test_cache')
beforeEach(async () => {
  try {
    await fs.rm(cacheBaseDirectory, { recursive: true })
    process.env.CACHE_BASE_DIRECTORY = cacheBaseDirectory
  } catch (error) {}

  // clean up function, called once after each test run
  return async () => {
    try {
      await fs.rm(cacheBaseDirectory, { recursive: true })
      delete process.env.CACHE_BASE_DIRECTORY
    } catch (error) {}
  }
})

describe('searchAudible - happy path', () => {
  // cSpell:disable
  it('should find Nick Bostrom/Superintelligence', async () => {
    const books = await searchAudible({
      author: 'Nick Bostrom',
      title: 'Superintelligence',
    })
    expect(books).toMatchSnapshot()
    // cSpell:enable
  })
  it('should find Barry Lopez/Of Wolves and Men', async () => {
    const books = await searchAudible({
      author: 'Barry Lopez',
      title: 'Of Wolves and Men',
    })
    expect(books).toMatchSnapshot()
  })
  it('should find Barry Lopez/Of Wolves and Men (No Cache)', async () => {
    const urlHref = urlHrefForSearch({
      author: 'Barry Lopez',
      title: 'Of Wolves and Men',
    })
    const books = await fetchResult(urlHref)
    expect(books).toMatchSnapshot()
  })
})

describe('sortAudibleBooks', () => {
  const base = {
    authors: ['Daniel Lauzon'],
    title: 'Testing the things',
    series: 'Saga',
    seriesPosition: '1',
    narrators: ['Talker Tom'],
  }
  const books = [
    { asin: 'A001', ...base, duration: 1000 },
    { asin: 'A002', ...base, duration: 1200 },
    { asin: 'A003', ...base, duration: 1400 },
  ]
  it('should sort books by duration around a reference duration', () => {
    const referenceDuration = 1050
    const sortedBooks = sortAudibleBooks(books, referenceDuration)
    expect(sortedBooks.map((b) => b.asin)).toEqual(['A001', 'A002', 'A003'])
    expect(sortedBooks.map((b) => b.duration)).toEqual([1000, 1200, 1400])
  })
  test.each([
    [1050, ['A001', 'A002', 'A003'], [1000, 1200, 1400]],
    [1350, ['A003', 'A002', 'A001'], [1400, 1200, 1000]],
    [1250, ['A002', 'A003', 'A001'], [1200, 1400, 1000]],
  ])(
    '%# sortAudibleBooks %p',
    (referenceDuration, expectedAsins, expectedDurations) => {
      const sortedBooks = sortAudibleBooks(books, referenceDuration)
      expect(sortedBooks.map((b) => b.asin)).toEqual(expectedAsins)
      expect(sortedBooks.map((b) => b.duration)).toEqual(expectedDurations)
    }
  )
})
