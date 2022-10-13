import { describe, expect, it } from 'vitest'
import { metadata } from './metadata'

describe('metadata', () => {
  it('should work', () => {
    expect(metadata()).toEqual('metadata')
  })
})
