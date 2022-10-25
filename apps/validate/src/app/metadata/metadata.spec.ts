import { describe, expect, it, beforeEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { getFiles } from '@nx-audiobook/file-walk'
import { isAudioFile } from '@nx-audiobook/validators'

import { AudioBookMetadata, getMetadataForSingleFile } from './metadata'

const assetBaseDirectory = path.resolve(
  __dirname,
  '../../../../..',
  'assets',
  'audio'
)

describe('audio assets', () => {
  it('should find assets directory', async () => {
    expect(
      (await fs.readdir(assetBaseDirectory)).filter((f) => f !== '.DS_Store')
    ).toMatchInlineSnapshot(`
      [
        "Derek Walcott - Love After Love",
        "Robert Frost - The Road not Taken",
      ]
    `)
  })
  it('should find audio files', async () => {
    expect(
      (await getFiles(assetBaseDirectory, { recurse: true, stat: false }))
        .map((fi) => fi.basename)
        .filter((basename) => basename !== '.DS_Store')
    ).toMatchInlineSnapshot(`
      [
        "Derek Walcott - Love After Love.mp3",
        "Robert Frost - The Road not Taken.mp3",
      ]
    `)
  })
})

const cacheBaseDirectory = path.join(__dirname, 'testcache')
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
  it('should find audio file metadata', async () => {
    const fileInfos = (
      await getFiles(assetBaseDirectory, { recurse: true, stat: true })
    ).filter(isAudioFile)
    expect(fileInfos).toHaveLength(2)

    // run the test twice, second time will hit the cache
    for (let iteration = 0; iteration < 2; iteration++) {
      const metas: AudioBookMetadata[] = []
      for (const fileInfo of fileInfos.filter(isAudioFile)) {
        metas.push(await getMetadataForSingleFile(fileInfo))
      }
      expect(metas).toMatchInlineSnapshot(`
      [
        {
          "author": "Jon Kabat-Zinn, American Public Media",
          "duration": 44.85224489795918,
          "title": "Speaking of Faith from American Public Media",
        },
        {
          "author": "Robert Frost",
          "duration": 76.19918367346939,
          "title": "Poem of the Day from Poetry Foundation.org",
        },
      ]
    `)
    }
  })
})
