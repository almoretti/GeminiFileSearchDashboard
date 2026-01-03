# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/claude-code) when working with this codebase.

## Project Overview

File Search Store Manager is a Next.js web application for managing Google Generative AI File Search stores. It provides a dashboard to create stores, upload documents with optional file splitting, and manage document metadata.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + Radix UI components
- **Auth:** NextAuth.js v5 (Google OAuth)
- **API:** Google Generative AI File Search API
- **Testing:** Vitest + React Testing Library

## Common Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run test         # Run tests in watch mode
npm run test:run     # Run tests once
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Dashboard (lists stores)
│   ├── login/             # Login page
│   ├── stores/[id]/       # Store detail page
│   └── api/               # API routes
│       ├── stores/        # Store CRUD + upload endpoints
│       └── operations/    # Long-running operation polling
├── components/            # React components
│   ├── ui/               # Radix UI primitives
│   ├── dashboard-client.tsx
│   ├── store-detail-client.tsx
│   ├── upload-dialog.tsx
│   └── metadata-filter.tsx
├── lib/
│   ├── api.ts            # Google File Search API client
│   ├── auth.ts           # NextAuth configuration
│   └── utils.ts          # Helper functions
└── test/
    └── setup.ts          # Vitest setup
```

## Google File Search API Limitations

**Supported file types:**
- Documents: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX
- Text: TXT, MD, CSV, JSON, XML, HTML, RTF
- Code: JS, TS, PY, JAVA, C, CPP, GO, RUST, CSS, SQL

**Not supported:**
- Images (PNG, JPG, GIF) - FileSearch is text-based, cannot index images
- Audio/Video (MP3, MP4) - No transcription support
- Files over 100MB - API hard limit

**Chunking config:** Only applies to text-based files (text/*, application/json, application/xml). Binary files (PDF, DOCX) use API default chunking.

## Key Architecture Decisions

### File Upload Flow
1. Files are uploaded via resumable upload API (`/api/stores/[id]/upload-stream`)
2. File splitting is **opt-in** - user can choose to split text files into 2-10 parts
3. Binary files (PDFs, Office docs) cannot be split
4. `isTextBasedFile()` helper determines if chunking config can be applied
5. Each upload creates an async operation that must be polled for completion

### MIME Type Detection
Located in `src/app/api/stores/[id]/upload/route.ts`:
- Browser-provided MIME type is preferred when valid
- Falls back to extension-based detection for common types
- Markdown files use `text/plain` to avoid server-side parsing issues

### Metadata Filtering
- Uses Google's AIP-160 filter syntax (e.g., `author='John' AND year>2020`)
- Filter component in `src/components/metadata-filter.tsx`
- Numeric values don't require quotes, strings do

### Chunking Configuration
Upload supports custom chunking via `ChunkingConfig`:
- `max_tokens_per_chunk`: 200 (default)
- `max_overlap_tokens`: 20 (optional)

## Environment Variables

Required in `.env.local`:
- `GOOGLE_API_KEY` - Google Generative AI API key
- `NEXTAUTH_URL` - Base URL (e.g., http://localhost:3000)
- `AUTH_SECRET` - NextAuth secret (generate with `openssl rand -base64 32`)
- `GOOGLE_CLIENT_ID` - OAuth client ID
- `GOOGLE_CLIENT_SECRET` - OAuth client secret
- `ALLOWED_DOMAIN` - Optional domain restriction for login

## Testing

Tests are in `__tests__` directories adjacent to source files:
- `src/lib/__tests__/api.test.ts` - API client tests
- `src/lib/__tests__/utils.test.ts` - Utility function tests
- `src/components/__tests__/` - Component tests
- `src/app/api/__tests__/` - API route tests (MIME detection)

Run tests: `npm run test:run`

## API Client (`src/lib/api.ts`)

Key exports:
- `listStores()`, `createStore()`, `getStore()`, `deleteStore()`
- `listDocuments()`, `getDocument()`, `deleteDocument()`
- `uploadToStore()` - Resumable upload with retry logic
- `isTextBasedFile()` - Check if MIME type supports chunking/splitting
- `splitFile(buffer, fileName, mimeType, numberOfParts)` - Split text files into N parts
- `pollOperation()` - Wait for async operations to complete
