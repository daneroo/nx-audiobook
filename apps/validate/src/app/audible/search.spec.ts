import { describe, expect, it, beforeEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { fetchResult, searchAudible, urlHrefForSearch } from './search'

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

describe('happy path', () => {
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
