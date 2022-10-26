import { describe, expect, it, beforeEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { getFiles } from '@nx-audiobook/file-walk'
import { isAudioFile } from '@nx-audiobook/validators'

import {
  AudioBookMetadata,
  getMetadataForSingleFile,
  fetchResult,
} from './music-metadata'

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
  it('should find audio file metadata', async () => {
    const fileInfos = (
      await getFiles(assetBaseDirectory, { recurse: true, stat: true })
    ).filter(isAudioFile)
    expect(fileInfos).toHaveLength(2)

    const metas: AudioBookMetadata[] = []
    for (const fileInfo of fileInfos.filter(isAudioFile)) {
      metas.push(await getMetadataForSingleFile(fileInfo))
    }
    expect(metas).toMatchSnapshot()
  })
  it('should find audio file metadata (no cache)', async () => {
    const fileInfos = (
      await getFiles(assetBaseDirectory, { recurse: true, stat: true })
    ).filter(isAudioFile)
    expect(fileInfos).toHaveLength(2)

    const metas: AudioBookMetadata[] = []
    for (const fileInfo of fileInfos.filter(isAudioFile)) {
      metas.push(
        await fetchResult({
          fileInfo,
          options: {
            duration: false,
            includeChapters: false,
          },
        })
      )
    }
    expect(metas).toMatchSnapshot()
  })
})
