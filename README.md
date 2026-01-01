# File Search Store Manager

A web application for managing Google Generative AI File Search stores. Create stores, upload documents, and manage your file search data through an intuitive dashboard.

## Features

- **Store Management** - Create, list, and delete file search stores
- **Document Upload** - Upload documents with automatic large file splitting (>200KB)
- **Document Management** - View status, metadata, and delete documents
- **Resumable Uploads** - Chunked uploads with retry logic for reliability
- **Custom Metadata** - Add key-value metadata to documents
- **Google OAuth** - Secure authentication with optional domain restriction

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

Create a `.env.local` file:

```env
# Google Generative AI API Key
# Get from: https://aistudio.google.com/app/apikey
GOOGLE_API_KEY=your_api_key

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=generate_with_openssl_rand_base64_32

# Google OAuth Credentials
# Create at: https://console.cloud.google.com/apis/credentials
# Add redirect URI: {NEXTAUTH_URL}/api/auth/callback/google
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret

# Optional: Restrict login to specific email domain
# Remove or leave empty to allow all domains
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
│       ├── stores/              # Store CRUD endpoints
│       ├── operations/          # Long-running operation polling
│       └── auth/                # NextAuth handler
├── components/
│   ├── dashboard-client.tsx     # Main dashboard
│   ├── store-detail-client.tsx  # Store documents view
│   ├── upload-dialog.tsx        # File upload with splitting
│   └── ui/                      # Radix UI components
└── lib/
    ├── auth.ts                  # NextAuth config
    ├── api.ts                   # Google File Search API client
    └── utils.ts                 # Helpers
```

## Supported File Types

**Documents:** PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX
**Text:** MD, TXT, CSV, JSON, XML, HTML
**Code:** JS, TS, PY, JAVA, C, CPP, CSS, SQL

## License

MIT
