import { describe, it, expect } from 'vitest'
import { formatBytes, formatDate, extractStoreId, extractDocumentId } from '../utils'

describe('formatBytes', () => {
  it('formats bytes correctly', () => {
    expect(formatBytes(500)).toBe('500.0 B')
  })

  it('formats kilobytes correctly', () => {
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
  })

  it('formats megabytes correctly', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })

  it('formats gigabytes correctly', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB')
    expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB')
  })

  it('handles string input', () => {
    expect(formatBytes('1024')).toBe('1.0 KB')
    expect(formatBytes('1048576')).toBe('1.0 MB')
  })

  it('handles undefined', () => {
    expect(formatBytes(undefined)).toBe('0 B')
  })

  it('handles zero', () => {
    // formatBytes returns '0 B' for falsy values
    expect(formatBytes(0)).toBe('0 B')
    // String '0' is truthy, so it goes through formatting
    expect(formatBytes('0')).toBe('0.0 B')
  })

  it('handles invalid string', () => {
    expect(formatBytes('invalid')).toBe('0 B')
  })
})

describe('formatDate', () => {
  it('formats ISO date string', () => {
    const date = '2024-03-15T10:30:00Z'
    const result = formatDate(date)
    // The exact format depends on locale, but should contain the date parts
    expect(result).toContain('2024')
    expect(result).toContain('Mar')
    expect(result).toContain('15')
  })

  it('handles undefined', () => {
    expect(formatDate(undefined)).toBe('-')
  })

  it('handles empty string', () => {
    // Empty string creates Invalid Date
    const result = formatDate('')
    expect(result).toBe('-')
  })
})

describe('extractStoreId', () => {
  it('extracts ID from "fileSearchStores/store-123"', () => {
    expect(extractStoreId('fileSearchStores/store-123')).toBe('store-123')
  })

  it('extracts ID from longer store names', () => {
    expect(extractStoreId('fileSearchStores/abc123xyz')).toBe('abc123xyz')
  })

  it('handles ID-only input (no prefix)', () => {
    expect(extractStoreId('just-an-id')).toBe('just-an-id')
  })

  it('extracts ID with special characters', () => {
    expect(extractStoreId('fileSearchStores/store_v2-test')).toBe('store_v2-test')
  })
})

describe('extractDocumentId', () => {
  it('extracts ID from full document path', () => {
    const path = 'fileSearchStores/store-123/documents/doc-456'
    expect(extractDocumentId(path)).toBe('doc-456')
  })

  it('extracts ID from simple path', () => {
    expect(extractDocumentId('documents/doc-abc')).toBe('doc-abc')
  })

  it('handles ID-only input', () => {
    expect(extractDocumentId('doc-only')).toBe('doc-only')
  })

  it('extracts last segment regardless of path depth', () => {
    const path = 'a/b/c/d/final-id'
    expect(extractDocumentId(path)).toBe('final-id')
  })
})
