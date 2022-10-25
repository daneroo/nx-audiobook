import { describe, expect, it, beforeEach } from 'vitest'
import { cachedFetchResult } from './cache'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

// eslint-disable-next-line @typescript-eslint/require-await
async function fetcher(arg: string): Promise<string> {
  return arg + arg
}
// eslint-disable-next-line @typescript-eslint/require-await
async function fibonacci(n: number): Promise<number> {
  if (n <= 1) return 1
  return (await fibonacci(n - 1)) + (await fibonacci(n - 2))
}

const cacheBaseDirectory = path.join(__dirname, 'testcache')

beforeEach(async () => {
  // delete cacheBaseDirectory before and after each test
  try {
    await fs.rm(cacheBaseDirectory, { recursive: true })
  } catch (error) {}

  // clean up function, called once after each test run
  return async () => {
    try {
      await fs.rm(cacheBaseDirectory, { recursive: true })
    } catch (error) {}
  }
})

describe('baseline', () => {
  it('should work with strings', async () => {
    expect(await fetcher('ha')).toEqual('haha')
  })
  it('should work with numbers and recursion', async () => {
    expect(await fibonacci(5)).toEqual(8)
    expect(await fibonacci(8)).toEqual(34)
  })
})

describe('cached', () => {
  it('should work with strings', async () => {
    {
      // store to cache
      const result = await cachedFetchResult(
        fetcher,
        'ha',
        'teststr',
        cacheBaseDirectory
      )
      expect(result).toEqual('haha')
    }
    {
      // read from cache
      const result = await cachedFetchResult(
        fetcher,
        'ha',
        'teststr',
        cacheBaseDirectory
      )
      expect(result).toEqual('haha')
    }
    expect(await fs.readdir(cacheBaseDirectory)).toMatchInlineSnapshot(`
      [
        "teststr",
      ]
    `)
    expect(await fs.readdir(path.join(cacheBaseDirectory, 'teststr')))
      .toMatchInlineSnapshot(`
      [
        "62a6dbce9cdcce60f48e0902985d9ebfa571bb33b621cfe2f7e62384c1971a8f.json",
      ]
    `)
  })
  it('should work with numbers and recursion', async () => {
    {
      const result = await cachedFetchResult(
        fibonacci,
        5,
        'testnum',
        cacheBaseDirectory
      )
      expect(result).toEqual(8)
      // does not cache intermediate results from recursion
      expect(await fs.readdir(path.join(cacheBaseDirectory, 'testnum')))
        .toMatchInlineSnapshot(`
        [
          "d10a4bc9e0c1fa4e8f3d7ce2512b8756e47ca5fa451f373c39a1431bb88db49f.json",
        ]
      `)
    }
    {
      const result = await cachedFetchResult(
        fibonacci,
        8,
        'testnum',
        cacheBaseDirectory
      )
      expect(result).toEqual(34)
      // does not cache intermediate results from recursion
      expect(await fs.readdir(path.join(cacheBaseDirectory, 'testnum')))
        .toMatchInlineSnapshot(`
        [
          "ade1a1c2a61af0f279a4978dfddcdb6acd33f5a8b61e62c5fd881e8a88a387bc.json",
          "d10a4bc9e0c1fa4e8f3d7ce2512b8756e47ca5fa451f373c39a1431bb88db49f.json",
        ]
      `)
    }
  })
})
