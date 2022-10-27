// remove duplicates from array

export function dedupArray<T>(ary: T[]): T[] {
  const dedup = [...new Set(ary)]
  return dedup
}
