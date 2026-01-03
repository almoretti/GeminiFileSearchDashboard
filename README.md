# File Search Store Manager

A web application for managing Google Generative AI File Search stores. Create stores, upload documents, and manage your file search data through an intuitive dashboard.

## Why This Tool?

Google's Gemini File Search API provides powerful RAG (Retrieval-Augmented Generation) capabilities, allowing you to ground AI responses in your own documents. However, **there is currently no official visual interface** to manage File Search stores - you can only interact with them via API calls or SDKs.

This tool fills that gap by providing:
- A visual dashboard to see all your stores at a glance
- Easy document upload with drag-and-drop support
- Real-time upload progress and status tracking
- Document metadata management and filtering
- No need to write code or use curl commands

## Features

- **Store Management** - Create, list, and delete file search stores
- **Document Upload** - Upload documents with optional file splitting
- **Document Management** - View status, metadata, and delete documents
- **Resumable Uploads** - Chunked uploads with retry logic for reliability
- **Custom Metadata** - Add key-value metadata to documents
- **Google OAuth** - Secure authentication with optional domain restriction
- **PDF Processing** - Compress and auto-split large PDFs using Ghostscript (requires Docker or local Ghostscript install)

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS + Radix UI
- NextAuth.js (Google OAuth)
- Google Generative AI SDK

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env.local` file with the following variables:

```env
# ===========================================
# Google Generative AI API Key (Required)
# ===========================================
# This key is used to interact with the Gemini File Search API.
# Get your API key from: https://aistudio.google.com/app/apikey
# Note: Ensure the API key has access to the Generative Language API
GOOGLE_API_KEY=your_api_key

# ===========================================
# NextAuth Configuration (Required)
# ===========================================
# NEXTAUTH_URL: The base URL of your application
# - Use http://localhost:3000 for local development
# - Use your production URL when deployed (e.g., https://myapp.vercel.app)
NEXTAUTH_URL=http://localhost:3000

# AUTH_SECRET: A random string used to encrypt session tokens
# Generate with: openssl rand -base64 32
# Keep this secret and never commit it to version control
AUTH_SECRET=generate_a_random_32_byte_string

# ===========================================
# Google OAuth Credentials (Required)
# ===========================================
# These credentials enable "Sign in with Google" functionality.
#
# To create OAuth credentials:
# 1. Go to https://console.cloud.google.com/apis/credentials
# 2. Create a new OAuth 2.0 Client ID (Web application type)
# 3. Add authorized redirect URI: {NEXTAUTH_URL}/api/auth/callback/google
#    For local dev: http://localhost:3000/api/auth/callback/google
# 4. Copy the Client ID and Client Secret below
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret

# ===========================================
# Optional Settings
# ===========================================
# ALLOWED_DOMAIN: Restrict login to a specific email domain
# - Leave empty to allow any Google account
# - Set to your company domain to restrict access (e.g., "mycompany.com")
# - Users with emails outside this domain will be denied access
ALLOWED_DOMAIN=
```

Generate `AUTH_SECRET`:
```bash
openssl rand -base64 32
```

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/
│   ├── page.tsx                 # Dashboard
│   ├── login/page.tsx           # Login page
│   ├── stores/[id]/page.tsx     # Store detail
│   └── api/
│       ├── stores/              # Store CRUD + upload endpoints
│       ├── operations/          # Long-running operation polling
│       ├── pdf-processing/      # PDF processing availability
│       └── auth/                # NextAuth handler
├── components/
│   ├── dashboard-client.tsx     # Main dashboard
│   ├── store-detail-client.tsx  # Store documents view
│   ├── upload-dialog.tsx        # File upload with PDF options
│   └── ui/                      # Radix UI components
└── lib/
    ├── auth.ts                  # NextAuth config
    ├── api.ts                   # Google File Search API client
    ├── pdf-processor.ts         # Ghostscript PDF compression
    └── utils.ts                 # Helpers

# Docker deployment files
Dockerfile                       # Multi-stage build with Ghostscript
docker-compose.yml               # Easy deployment config
```

## Supported File Types & Limitations

Google's File Search API has specific requirements for uploaded files:

### Supported Formats
| Category | Extensions |
|----------|------------|
| **Documents** | PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX |
| **Text** | TXT, MD, CSV, JSON, XML, HTML, RTF |
| **Code** | JS, TS, PY, JAVA, C, CPP, GO, RUST, CSS, SQL |
| **Data** | JSON, XML, YAML, LaTeX, Jupyter notebooks |

### Not Supported
| Category | Why |
|----------|-----|
| **Images** (PNG, JPG, GIF, WebP) | FileSearch is text-based; cannot extract/index image content |
| **Audio/Video** (MP3, MP4, WAV) | No audio/video transcription support |
| **Archives** (ZIP contents) | Only the archive file itself, not extracted contents |

### Size Limits
- **Maximum file size:** 100 MB per file
- **Recommendation:** For files approaching 100MB, use Docker deployment with PDF compression enabled

### Chunking Configuration
Custom chunking is only applied to text-based files (TXT, MD, JSON, XML, code files). Binary documents (PDF, DOCX, etc.) use the API's default chunking.

### File Splitting
Text files can be optionally split into multiple parts (2-10) for:
- Better granularity in search results
- Working around token limits

## Docker Deployment

Docker deployment includes **Ghostscript** for PDF compression and auto-splitting. These features also work locally if you have Ghostscript installed (`brew install ghostscript` on macOS).

### PDF Processing Features
- **PDF Compression**: Reduce PDF file sizes by 30-80% before upload
- **Auto-Split Large PDFs**: Automatically split PDFs over 100MB into smaller parts by page ranges
- **Quality Options**: Choose from screen (72 dpi), ebook (150 dpi), printer (300 dpi), or prepress quality

### Quick Start with Docker Compose

1. Create a `.env` file (or use `.env.local`):
```env
GOOGLE_API_KEY=your_api_key
NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=your_secret
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
```

2. Build and run:
```bash
docker-compose up --build
```

3. Open [http://localhost:3000](http://localhost:3000)

### Build Docker Image Manually

```bash
# Build the image
docker build -t filesearch-manager .

# Run the container
docker run -p 3000:3000 \
  -e GOOGLE_API_KEY=your_api_key \
  -e NEXTAUTH_URL=http://localhost:3000 \
  -e AUTH_SECRET=your_secret \
  -e GOOGLE_CLIENT_ID=your_client_id \
  -e GOOGLE_CLIENT_SECRET=your_client_secret \
  filesearch-manager
```

### PDF Compression Quality Settings

| Setting | DPI | Use Case | Compression |
|---------|-----|----------|-------------|
| **Screen** | 72 | Web viewing | Highest (smallest file) |
| **Ebook** | 150 | E-readers, general use | Medium (recommended) |
| **Printer** | 300 | Print quality | Low |
| **Prepress** | 300 | Professional print | Minimal |

## License

MIT
