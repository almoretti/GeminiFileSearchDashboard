import { describe, it, expect } from 'vitest'

// MIME type map extracted from the upload route for testing
const MIME_TYPE_MAP: Record<string, string> = {
  // Text/Markdown
  '.md': 'text/plain',
  '.markdown': 'text/plain',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.html': 'text/html',
  '.htm': 'text/html',
  // Documents
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Code
  '.js': 'text/javascript',
  '.ts': 'text/typescript',
  '.py': 'text/x-python',
  '.java': 'text/x-java-source',
  '.c': 'text/x-c',
  '.cpp': 'text/x-c++',
  '.h': 'text/x-c',
  '.css': 'text/css',
  '.sql': 'application/sql',
}

// Recreate the getMimeType function for testing
function getMimeType(fileName: string, browserMimeType: string): string {
  // If browser provided a valid MIME type (not empty), use it
  if (browserMimeType && browserMimeType !== 'application/octet-stream') {
    return browserMimeType
  }

  // Fall back to extension-based detection
  const ext = fileName.toLowerCase().match(/\.[^.]+$/)?.[0] || ''
  return MIME_TYPE_MAP[ext] || 'application/octet-stream'
}

// Check if file is a text-based file that can be split
function isTextFile(mimeType: string): boolean {
  return (
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    mimeType === 'application/xml'
  )
}

describe('MIME type detection', () => {
  describe('Text formats', () => {
    it('detects .txt as text/plain', () => {
      expect(getMimeType('document.txt', '')).toBe('text/plain')
    })

    it('detects .md as text/plain', () => {
      expect(getMimeType('README.md', '')).toBe('text/plain')
    })

    it('detects .markdown as text/plain', () => {
      expect(getMimeType('notes.markdown', '')).toBe('text/plain')
    })

    it('detects .json as application/json', () => {
      expect(getMimeType('config.json', '')).toBe('application/json')
    })

    it('detects .csv as text/csv', () => {
      expect(getMimeType('data.csv', '')).toBe('text/csv')
    })

    it('detects .html as text/html', () => {
      expect(getMimeType('page.html', '')).toBe('text/html')
    })

    it('detects .htm as text/html', () => {
      expect(getMimeType('page.htm', '')).toBe('text/html')
    })

    it('detects .xml as application/xml', () => {
      expect(getMimeType('data.xml', '')).toBe('application/xml')
    })
  })

  describe('Document formats', () => {
    it('detects .pdf as application/pdf', () => {
      expect(getMimeType('document.pdf', '')).toBe('application/pdf')
    })

    it('detects .doc as application/msword', () => {
      expect(getMimeType('document.doc', '')).toBe('application/msword')
    })

    it('detects .docx as application/vnd.openxmlformats-officedocument.wordprocessingml.document', () => {
      expect(getMimeType('document.docx', '')).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
    })
  })

  describe('Presentation formats', () => {
    it('detects .ppt as application/vnd.ms-powerpoint', () => {
      expect(getMimeType('slides.ppt', '')).toBe('application/vnd.ms-powerpoint')
    })

    it('detects .pptx as application/vnd.openxmlformats-officedocument.presentationml.presentation', () => {
      expect(getMimeType('slides.pptx', '')).toBe(
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      )
    })
  })

  describe('Spreadsheet formats', () => {
    it('detects .xls as application/vnd.ms-excel', () => {
      expect(getMimeType('data.xls', '')).toBe('application/vnd.ms-excel')
    })

    it('detects .xlsx as application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', () => {
      expect(getMimeType('data.xlsx', '')).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
    })
  })

  describe('Image formats', () => {
    it('detects .png via browser MIME type', () => {
      expect(getMimeType('image.png', 'image/png')).toBe('image/png')
    })

    it('detects .jpg via browser MIME type', () => {
      expect(getMimeType('photo.jpg', 'image/jpeg')).toBe('image/jpeg')
    })

    it('detects .jpeg via browser MIME type', () => {
      expect(getMimeType('photo.jpeg', 'image/jpeg')).toBe('image/jpeg')
    })

    it('detects .gif via browser MIME type', () => {
      expect(getMimeType('animation.gif', 'image/gif')).toBe('image/gif')
    })

    it('detects .webp via browser MIME type', () => {
      expect(getMimeType('image.webp', 'image/webp')).toBe('image/webp')
    })

    it('detects .svg via browser MIME type', () => {
      expect(getMimeType('icon.svg', 'image/svg+xml')).toBe('image/svg+xml')
    })

    it('falls back to octet-stream for unknown image extension', () => {
      // If browser doesn't provide MIME type and extension is unknown
      expect(getMimeType('image.unknown', '')).toBe('application/octet-stream')
    })
  })

  describe('Code formats', () => {
    it('detects .js as text/javascript', () => {
      expect(getMimeType('script.js', '')).toBe('text/javascript')
    })

    it('detects .ts as text/typescript', () => {
      expect(getMimeType('app.ts', '')).toBe('text/typescript')
    })

    it('detects .py as text/x-python', () => {
      expect(getMimeType('script.py', '')).toBe('text/x-python')
    })

    it('detects .css as text/css', () => {
      expect(getMimeType('styles.css', '')).toBe('text/css')
    })

    it('detects .sql as application/sql', () => {
      expect(getMimeType('query.sql', '')).toBe('application/sql')
    })
  })

  describe('Browser MIME type priority', () => {
    it('uses browser MIME type when valid', () => {
      expect(getMimeType('file.unknown', 'application/pdf')).toBe('application/pdf')
    })

    it('prefers browser MIME type over extension', () => {
      // Browser says PDF, but extension says txt - trust browser
      expect(getMimeType('document.txt', 'application/pdf')).toBe('application/pdf')
    })

    it('ignores octet-stream from browser', () => {
      // Browser returns generic type, fall back to extension
      expect(getMimeType('document.json', 'application/octet-stream')).toBe(
        'application/json'
      )
    })

    it('falls back to octet-stream for unknown types', () => {
      expect(getMimeType('file.xyz', '')).toBe('application/octet-stream')
      expect(getMimeType('file', '')).toBe('application/octet-stream')
    })
  })

  describe('Case insensitivity', () => {
    it('handles uppercase extensions', () => {
      expect(getMimeType('DOCUMENT.PDF', '')).toBe('application/pdf')
    })

    it('handles mixed case extensions', () => {
      expect(getMimeType('File.Json', '')).toBe('application/json')
    })

    it('handles uppercase filenames', () => {
      expect(getMimeType('README.MD', '')).toBe('text/plain')
    })
  })
})

describe('File splitting decision', () => {
  it('text files can be split', () => {
    expect(isTextFile('text/plain')).toBe(true)
    expect(isTextFile('text/html')).toBe(true)
    expect(isTextFile('text/csv')).toBe(true)
  })

  it('JSON files can be split', () => {
    expect(isTextFile('application/json')).toBe(true)
  })

  it('XML files can be split', () => {
    expect(isTextFile('application/xml')).toBe(true)
  })

  it('binary files like images cannot be split', () => {
    expect(isTextFile('image/png')).toBe(false)
    expect(isTextFile('image/jpeg')).toBe(false)
    expect(isTextFile('image/gif')).toBe(false)
    expect(isTextFile('image/webp')).toBe(false)
  })

  it('PDF files cannot be split', () => {
    expect(isTextFile('application/pdf')).toBe(false)
  })

  it('Office documents cannot be split', () => {
    expect(isTextFile('application/msword')).toBe(false)
    expect(
      isTextFile(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
    ).toBe(false)
    expect(isTextFile('application/vnd.ms-powerpoint')).toBe(false)
    expect(
      isTextFile(
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      )
    ).toBe(false)
    expect(isTextFile('application/vnd.ms-excel')).toBe(false)
    expect(
      isTextFile(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
    ).toBe(false)
  })

  it('generic octet-stream cannot be split', () => {
    expect(isTextFile('application/octet-stream')).toBe(false)
  })
})
