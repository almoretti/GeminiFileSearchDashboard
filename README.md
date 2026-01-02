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
