import * as path from 'node:path'
import * as crypto from 'node:crypto'
import * as fs from 'node:fs/promises'

// Another way to specify this:
// type CacheableFetcher<Arg, Return> = (arg: Arg) => Promise<Return>
// fetcher: CacheableFetcher<Arg, Return>,

// retrieve cached result or fetch and cache
export async function cachedFetchResult<Arg, Return>(
  fetcher: (arg: Arg) => Promise<Return>,
  arg: Arg,
  cacheSubdirectory: string,
  cacheBaseDirectory?: string
): Promise<Return> {
  // we re-evaluate this at every call, so we can change it in tests
  const defaultCacheBaseDirectory =
    process.env['CACHE_BASE_DIRECTORY'] ?? path.join(process.cwd(), 'cache')
  const cacheDirectoryPath = path.join(
    cacheBaseDirectory ?? defaultCacheBaseDirectory,
    cacheSubdirectory
  )
  const cacheKeyPath = getCacheKeyPath(arg, cacheDirectoryPath)
  try {
    const result = (await readJSON(cacheKeyPath)) as Return
    return result
  } catch (error) {}

  const result = await fetcher(arg)

  await fs.mkdir(cacheDirectoryPath, { recursive: true })
  await storeJSON(result, cacheKeyPath)
  return result
}

function getCacheKeyPath<Arg>(arg: Arg, cacheDirectoryPath: string): string {
  const cacheKey = sha256sum(JSON.stringify(arg))
  const cacheKeyPath = path.join(cacheDirectoryPath, `${cacheKey}.json`)
  return cacheKeyPath
}

// The functions below are for caching results
function sha256sum(input: string): string {
  return crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex')
}

async function storeJSON<T>(json: T, path: string): Promise<void> {
  const data = JSON.stringify(json, null, 2)
  await fs.writeFile(path, data)
}

async function readJSON<T>(path: string): Promise<T> {
  const data = await fs.readFile(path)
  const json = JSON.parse(data.toString()) as T
  return json
}
