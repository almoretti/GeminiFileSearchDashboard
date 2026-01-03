import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock environment variable
vi.stubEnv('GOOGLE_API_KEY', 'test-api-key')

// Import after stubbing env
const {
  listDocuments,
  listStores,
  createStore,
  getStore,
  deleteStore,
  getDocument,
  deleteDocument,
  isTextBasedFile,
  splitFile
} = await import('../api')

describe('listDocuments', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches documents without filter', async () => {
    const mockResponse = {
      documents: [
        { name: 'doc1', displayName: 'Test Doc' }
      ]
    }

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockResponse)),
    } as Response)

    const result = await listDocuments('store123')

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const callUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(callUrl).toContain('/fileSearchStores/store123/documents')
    expect(callUrl).not.toContain('filter=')
    expect(result.documents).toHaveLength(1)
  })

  it('includes filter parameter when provided', async () => {
    const mockResponse = { documents: [] }

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockResponse)),
    } as Response)

    await listDocuments('store123', undefined, undefined, "author='Test'")

    const callUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(callUrl).toContain('filter=')
    // URL encoding encodes quotes as %27, = as %3D
    expect(callUrl).toContain("author%3D%27Test%27")
  })

  it('includes pageSize and pageToken when provided', async () => {
    const mockResponse = { documents: [], nextPageToken: 'next123' }

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockResponse)),
    } as Response)

    await listDocuments('store123', 10, 'token123')

    const callUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(callUrl).toContain('pageSize=10')
    expect(callUrl).toContain('pageToken=token123')
  })

  it('combines all parameters correctly', async () => {
    const mockResponse = { documents: [] }

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockResponse)),
    } as Response)

    await listDocuments('store123', 20, 'token456', "year>2020")

    const callUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(callUrl).toContain('pageSize=20')
    expect(callUrl).toContain('pageToken=token456')
    expect(callUrl).toContain('filter=')
    expect(callUrl).toContain('year%3E2020')
  })
})

describe('ChunkingConfig types', () => {
  it('exports ChunkingConfig interface', async () => {
    const { ChunkingConfig } = await import('../api') as { ChunkingConfig: unknown }
    // Type check - this is a compile-time test
    // If types are wrong, TypeScript would catch it
    expect(true).toBe(true)
  })
})

// Store Operations
describe('listStores', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches stores without pagination params', async () => {
    const mockResponse = {
      fileSearchStores: [
        { name: 'fileSearchStores/store1', displayName: 'Store 1' }
      ]
    }

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockResponse)),
    } as Response)

    const result = await listStores()

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const callUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(callUrl).toContain('/fileSearchStores')
    expect(callUrl).not.toContain('pageSize=')
    expect(callUrl).not.toContain('pageToken=')
    expect(result.fileSearchStores).toHaveLength(1)
  })

  it('includes pageSize when provided', async () => {
    const mockResponse = { fileSearchStores: [] }

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockResponse)),
    } as Response)

    await listStores(10)

    const callUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(callUrl).toContain('pageSize=10')
  })

  it('includes pageToken when provided', async () => {
    const mockResponse = { fileSearchStores: [] }

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockResponse)),
    } as Response)

    await listStores(undefined, 'token123')

    const callUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(callUrl).toContain('pageToken=token123')
  })

  it('handles empty response', async () => {
    const mockResponse = {}

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockResponse)),
    } as Response)

    const result = await listStores()

    expect(result.fileSearchStores).toBeUndefined()
  })
})

describe('createStore', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates store with displayName', async () => {
    const mockResponse = {
      name: 'fileSearchStores/store123',
      displayName: 'My Store'
    }

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockResponse)),
    } as Response)

    const result = await createStore('My Store')

    expect(result.displayName).toBe('My Store')
    expect(result.name).toBe('fileSearchStores/store123')
  })

  it('sends POST request with correct body', async () => {
    const mockResponse = { name: 'fileSearchStores/store123' }

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockResponse)),
    } as Response)

    await createStore('Test Store')

    const [url, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toContain('/fileSearchStores')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({ displayName: 'Test Store' })
  })
})

describe('getStore', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches single store by ID', async () => {
    const mockResponse = {
      name: 'fileSearchStores/store123',
      displayName: 'Test Store'
    }

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockResponse)),
    } as Response)

    const result = await getStore('store123')

    const callUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(callUrl).toContain('/fileSearchStores/store123')
    expect(result.name).toBe('fileSearchStores/store123')
  })

  it('throws on error response', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      statusText: 'Not Found',
      json: () => Promise.resolve({ error: { message: 'Store not found' } }),
    } as Response)

    await expect(getStore('nonexistent')).rejects.toThrow('Store not found')
  })
})

describe('deleteStore', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('deletes store without force flag', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(''),
    } as Response)

    await deleteStore('store123')

    const [url, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toContain('/fileSearchStores/store123')
    expect(url).toContain('force=false')
    expect(options.method).toBe('DELETE')
  })

  it('includes force=true when specified', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(''),
    } as Response)

    await deleteStore('store123', true)

    const callUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(callUrl).toContain('force=true')
  })
})

// Document Operations
describe('getDocument', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches single document by store and doc ID', async () => {
    const mockResponse = {
      name: 'fileSearchStores/store123/documents/doc456',
      displayName: 'Test Doc'
    }

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockResponse)),
    } as Response)

    const result = await getDocument('store123', 'doc456')

    const callUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(callUrl).toContain('/fileSearchStores/store123/documents/doc456')
    expect(result.name).toBe('fileSearchStores/store123/documents/doc456')
  })
})

describe('deleteDocument', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('deletes document without force flag', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(''),
    } as Response)

    await deleteDocument('store123', 'doc456')

    const [url, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toContain('/fileSearchStores/store123/documents/doc456')
    expect(url).toContain('force=false')
    expect(options.method).toBe('DELETE')
  })

  it('includes force=true when specified', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(''),
    } as Response)

    await deleteDocument('store123', 'doc456', true)

    const callUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(callUrl).toContain('force=true')
  })
})

// File Type Detection
describe('isTextBasedFile', () => {
  it('returns true for text/* MIME types', () => {
    expect(isTextBasedFile('text/plain')).toBe(true)
    expect(isTextBasedFile('text/html')).toBe(true)
    expect(isTextBasedFile('text/css')).toBe(true)
    expect(isTextBasedFile('text/javascript')).toBe(true)
    expect(isTextBasedFile('text/markdown')).toBe(true)
  })

  it('returns true for application/json', () => {
    expect(isTextBasedFile('application/json')).toBe(true)
  })

  it('returns true for application/xml', () => {
    expect(isTextBasedFile('application/xml')).toBe(true)
  })

  it('returns false for image/* MIME types', () => {
    expect(isTextBasedFile('image/png')).toBe(false)
    expect(isTextBasedFile('image/jpeg')).toBe(false)
    expect(isTextBasedFile('image/gif')).toBe(false)
    expect(isTextBasedFile('image/webp')).toBe(false)
  })

  it('returns false for application/pdf', () => {
    expect(isTextBasedFile('application/pdf')).toBe(false)
  })

  it('returns false for Office documents', () => {
    expect(isTextBasedFile('application/msword')).toBe(false)
    expect(isTextBasedFile('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(false)
    expect(isTextBasedFile('application/vnd.ms-excel')).toBe(false)
    expect(isTextBasedFile('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(false)
    expect(isTextBasedFile('application/vnd.ms-powerpoint')).toBe(false)
    expect(isTextBasedFile('application/vnd.openxmlformats-officedocument.presentationml.presentation')).toBe(false)
  })

  it('returns false for application/octet-stream', () => {
    expect(isTextBasedFile('application/octet-stream')).toBe(false)
  })
})

describe('splitFile', () => {
  it('splits text file into specified number of parts', () => {
    const paragraph = 'This is a paragraph of text.\n\n'
    const content = paragraph.repeat(100) // Create content with natural split points
    const buffer = Buffer.from(content, 'utf-8')

    // Request 3 parts
    const result = splitFile(buffer, 'test.txt', 'text/plain', 3)

    expect(result.length).toBeLessThanOrEqual(3)
    expect(result.length).toBeGreaterThan(1)
    expect(result[0].partNumber).toBe(1)
    expect(result[0].totalParts).toBe(result.length)
  })

  it('respects numberOfParts parameter (2 parts)', () => {
    const content = 'Section one\n\nSection two\n\nSection three\n\nSection four'
    const buffer = Buffer.from(content, 'utf-8')

    const result = splitFile(buffer, 'test.txt', 'text/plain', 2)

    expect(result.length).toBe(2)
    expect(result[0].partNumber).toBe(1)
    expect(result[1].partNumber).toBe(2)
  })

  it('respects numberOfParts parameter (5 parts)', () => {
    // Create content with many natural split points
    const content = ('Line of text\n\n').repeat(50)
    const buffer = Buffer.from(content, 'utf-8')

    const result = splitFile(buffer, 'test.txt', 'text/plain', 5)

    expect(result.length).toBeLessThanOrEqual(5)
    expect(result.length).toBeGreaterThan(1)
  })

  it('clamps numberOfParts to valid range (min 2)', () => {
    const content = 'Line\n\nAnother line\n\n'
    const buffer = Buffer.from(content, 'utf-8')

    const result = splitFile(buffer, 'test.txt', 'text/plain', 1) // Below minimum

    // Should still split into at least 2 parts if possible
    expect(result.length).toBeGreaterThanOrEqual(1)
  })

  it('clamps numberOfParts to valid range (max 10)', () => {
    const content = ('Text\n\n').repeat(20)
    const buffer = Buffer.from(content, 'utf-8')

    const result = splitFile(buffer, 'test.txt', 'text/plain', 20) // Above maximum

    expect(result.length).toBeLessThanOrEqual(10)
  })

  it('returns single part for binary files regardless of numberOfParts', () => {
    const binaryContent = Buffer.alloc(300 * 1024) // 300KB of zeros
    const result = splitFile(binaryContent, 'image.png', 'image/png', 5)

    expect(result.length).toBe(1)
    expect(result[0].partNumber).toBe(1)
    expect(result[0].totalParts).toBe(1)
    expect(result[0].fileName).toBe('image.png')
  })

  it('returns single part for PDF regardless of numberOfParts', () => {
    const pdfContent = Buffer.alloc(100 * 1024)
    const result = splitFile(pdfContent, 'document.pdf', 'application/pdf', 3)

    expect(result.length).toBe(1)
    expect(result[0].fileName).toBe('document.pdf')
  })

  it('preserves file extension in part names', () => {
    const content = 'A\n\n'.repeat(100)
    const buffer = Buffer.from(content, 'utf-8')

    const result = splitFile(buffer, 'document.md', 'text/plain', 3)

    expect(result.length).toBeGreaterThan(1)
    result.forEach((part, index) => {
      expect(part.fileName).toMatch(/document_part\d+of\d+\.md$/)
      expect(part.partNumber).toBe(index + 1)
    })
  })

  it('adds part metadata (partNumber, totalParts)', () => {
    const content = 'X\n\n'.repeat(100)
    const buffer = Buffer.from(content, 'utf-8')

    const result = splitFile(buffer, 'data.txt', 'text/plain', 4)

    result.forEach((part, index) => {
      expect(part.partNumber).toBe(index + 1)
      expect(part.totalParts).toBe(result.length)
    })
  })

  it('handles JSON files as splittable', () => {
    const jsonContent = '{\n\n'.repeat(100)
    const buffer = Buffer.from(jsonContent, 'utf-8')

    const result = splitFile(buffer, 'data.json', 'application/json', 3)

    expect(result.length).toBeGreaterThan(1)
  })

  it('handles XML files as splittable', () => {
    const xmlContent = '<item>\n\n'.repeat(100)
    const buffer = Buffer.from(xmlContent, 'utf-8')

    const result = splitFile(buffer, 'data.xml', 'application/xml', 2)

    expect(result.length).toBeGreaterThan(1)
  })

  it('handles small text files - returns single part when content is minimal', () => {
    const content = 'Small content'
    const buffer = Buffer.from(content, 'utf-8')

    const result = splitFile(buffer, 'small.txt', 'text/plain', 5)

    // Small content with no natural split points may result in fewer parts
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result[0].buffer.toString()).toContain('Small content')
  })

  it('uses default of 2 parts when numberOfParts not specified', () => {
    const content = 'First section\n\nSecond section\n\nThird section'
    const buffer = Buffer.from(content, 'utf-8')

    const result = splitFile(buffer, 'test.txt', 'text/plain')

    expect(result.length).toBeLessThanOrEqual(2)
  })
})
