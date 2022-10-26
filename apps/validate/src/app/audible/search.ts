import fetch from 'node-fetch'
import { sleep } from '@nx-audiobook/time'
import { cachedFetchResult } from '../cache/cache'

// see Unofficial docs for audible API
// https://audible.readthedocs.io/en/latest/misc/external_api.html#products

// Constants
// don't overwhelm audible's api server (10/s seems reasonable)
const delayForAudibleAPIms = 100

export interface AudibleBook {
  asin: string
  authors: string[]
  title: string
  series: string
  seriesPosition: string
  narrators: string[]
  duration: number
}

// Search audible for books with {author,title}
export async function searchAudible({
  author,
  title,
}: {
  author: string
  title: string
}): Promise<AudibleBook[]> {
  const urlHref = urlHrefForSearch({ author, title })
  return await cachedFetchResult<string, AudibleBook[]>(
    fetchResult,
    urlHref,
    'audible'
  )
}

// Sorts Audible books by duration (in seconds)
//   - The list is sorted with respect to a reference duration
//   - if this reference duration is not defined, it is set to 0
// This amounts to sorting a list of audible books by their distance (in duration) to a reference duration
export function sortAudibleBooks(
  books: AudibleBook[],
  duration = 0
): AudibleBook[] {
  // console.error('Sorting around', { duration })
  //  we must be careful, as the duration is not always defined on incoming books (default to a large value in this case)
  const largeDuration = 1e7 // 115 days! - we use || because NaN is falsy, Nullish coalescing will not do.
  const sortedAudible = [...books].sort((b1, b2) => {
    const d1 = Math.abs(
      (b1.duration > 0 ? b1.duration : largeDuration) - duration
    )
    const d2 = Math.abs(
      (b2.duration > 0 ? b2.duration : largeDuration) - duration
    )
    return d1 - d2
  })
  return sortedAudible
}

// The part of the search result I rely on. (not complete)
interface AudibleProduct {
  asin: string
  authors: Array<{ name: string; asin: string }>
  title: string
  narrators?: Array<{ name: string }>
  series?: Array<{ title: string; sequence: string }>
  runtime_length_min: number
}

// casts and renames fields for use as an AudibleBook
// TODO handle multiple series
function audibleBook(book: AudibleProduct): AudibleBook {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const { asin, authors, title, narrators, series, runtime_length_min } = book

  return {
    asin,
    authors: authors.map((author) => author.name),
    title,
    series: series?.[0]?.title ?? '',
    seriesPosition: series?.[0]?.sequence ?? '',
    narrators: narrators?.map((author) => author.name) ?? [],
    // this preserves null for duration, but we might want to omit the member altogether
    duration:
      runtime_length_min > 0 ? runtime_length_min * 60 : runtime_length_min,
  }
}

interface AudibleRawResult {
  // product_filters: [] // string[]?
  products: AudibleProduct[]
  response_groups: string[]
  total_results: number
}
export async function fetchResult(urlHref: string): Promise<AudibleBook[]> {
  // don't overwhelm audible's api server (10/s seems reasonable)
  await sleep(delayForAudibleAPIms)

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
  const response = await fetch(urlHref)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  const results: AudibleRawResult = (await response.json()) as AudibleRawResult
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const books = results.products.map(audibleBook)

  return books
}

// Return the GET URL for search params
export function urlHrefForSearch({
  author,
  title,
}: {
  author: string
  title: string
}): string {
  const AUDIBLE_ENDPOINT = 'https://api.audible.com/1.0/catalog/products'

  const url = new URL(AUDIBLE_ENDPOINT)
  const params = {
    response_groups:
      'contributors,product_attrs,product_desc,product_extended_attrs,series',
    // response_groups – [contributors, media, price, product_attrs, product_desc, product_extended_attrs, product_plan_details, product_plans, rating, review_attrs, reviews, sample, series, sku]
    num_results: '10',
    products_sort_by: 'Relevance',
    author,
    title,
  }
  //  map params object to url's searchParams
  for (const [key, value] of Object.entries(params)) {
    // set is equivalent to append since we are iterating over the params (no multiple values)
    url.searchParams.set(key, value)
  }
  return url.href
}
