import { GoogleGenAI } from "@google/genai";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

function getApiKey(): string {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY environment variable is not set");
  }
  return apiKey;
}

function getGenAI(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: getApiKey() });
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = getApiKey();
  const url = `${BASE_URL}${endpoint}${endpoint.includes("?") ? "&" : "?"}key=${apiKey}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error?.message || `API request failed: ${response.statusText}`
    );
  }

  // Handle empty responses (like DELETE)
  const text = await response.text();
  if (!text) return {} as T;
  return JSON.parse(text);
}

// FileSearchStore types
export interface FileSearchStore {
  name: string;
  displayName?: string;
  createTime?: string;
  updateTime?: string;
  activeDocumentsCount?: string;
  pendingDocumentsCount?: string;
  failedDocumentsCount?: string;
  sizeBytes?: string;
}

export interface ListStoresResponse {
  fileSearchStores?: FileSearchStore[];
  nextPageToken?: string;
}

export interface Document {
  name: string;
  displayName?: string;
  customMetadata?: Array<{
    key: string;
    stringValue?: string;
    numericValue?: number;
  }>;
  updateTime?: string;
  createTime?: string;
  state?: "STATE_UNSPECIFIED" | "STATE_PENDING" | "STATE_ACTIVE" | "STATE_FAILED";
  sizeBytes?: string;
  mimeType?: string;
}

export interface ListDocumentsResponse {
  documents?: Document[];
  nextPageToken?: string;
}

export interface Operation {
  name: string;
  metadata?: Record<string, unknown>;
  done: boolean;
  error?: {
    code: number;
    message: string;
  };
  response?: Record<string, unknown>;
}

// Store operations
export async function listStores(
  pageSize?: number,
  pageToken?: string
): Promise<ListStoresResponse> {
  const params = new URLSearchParams();
  if (pageSize) params.set("pageSize", pageSize.toString());
  if (pageToken) params.set("pageToken", pageToken);
  const query = params.toString();
  return apiRequest<ListStoresResponse>(
    `/fileSearchStores${query ? `?${query}` : ""}`
  );
}

export async function createStore(
  displayName: string
): Promise<FileSearchStore> {
  return apiRequest<FileSearchStore>("/fileSearchStores", {
    method: "POST",
    body: JSON.stringify({ displayName }),
  });
}

export async function getStore(storeId: string): Promise<FileSearchStore> {
  return apiRequest<FileSearchStore>(`/fileSearchStores/${storeId}`);
}

export async function deleteStore(
  storeId: string,
  force: boolean = false
): Promise<void> {
  await apiRequest<Record<string, never>>(
    `/fileSearchStores/${storeId}?force=${force}`,
    { method: "DELETE" }
  );
}

// Document operations
export async function listDocuments(
  storeId: string,
  pageSize?: number,
  pageToken?: string,
  filter?: string
): Promise<ListDocumentsResponse> {
  const params = new URLSearchParams();
  if (pageSize) params.set("pageSize", pageSize.toString());
  if (pageToken) params.set("pageToken", pageToken);
  if (filter) params.set("filter", filter);
  const query = params.toString();
  return apiRequest<ListDocumentsResponse>(
    `/fileSearchStores/${storeId}/documents${query ? `?${query}` : ""}`
  );
}

export async function getDocument(
  storeId: string,
  documentId: string
): Promise<Document> {
  return apiRequest<Document>(
    `/fileSearchStores/${storeId}/documents/${documentId}`
  );
}

export async function deleteDocument(
  storeId: string,
  documentId: string,
  force: boolean = false
): Promise<void> {
  await apiRequest<Record<string, never>>(
    `/fileSearchStores/${storeId}/documents/${documentId}?force=${force}`,
    { method: "DELETE" }
  );
}

// Custom metadata type
export interface CustomMetadata {
  key: string;
  stringValue?: string;
  stringListValue?: { values: string[] };
  numericValue?: number;
}

// Chunking configuration types
export interface WhiteSpaceConfig {
  max_tokens_per_chunk: number;
  max_overlap_tokens?: number;
}

export interface ChunkingConfig {
  white_space_config?: WhiteSpaceConfig;
}

// Helper for timeout wrapper
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`${operation} timed out after ${timeoutMs / 1000}s`)),
      timeoutMs
    )
  );
  return Promise.race([promise, timeout]);
}

// Helper for retry with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if it's a retryable error (503, 429, network errors)
      const isRetryable =
        lastError.message.includes("503") ||
        lastError.message.includes("Service Unavailable") ||
        lastError.message.includes("429") ||
        lastError.message.includes("Too Many Requests") ||
        lastError.message.includes("ECONNRESET") ||
        lastError.message.includes("ETIMEDOUT");

      if (!isRetryable || attempt === maxRetries) {
        throw lastError;
      }

      // Exponential backoff with jitter
      const delay = initialDelayMs * Math.pow(2, attempt) + Math.random() * 500;
      console.log(`Upload attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

// Upload operation using resumable upload API (matching SDK implementation)
const UPLOAD_BASE_URL = "https://generativelanguage.googleapis.com/upload/v1beta";
const MAX_CHUNK_SIZE = 8 * 1024 * 1024; // 8MB chunks like the SDK
const MAX_UPLOAD_RETRIES = 3;
// Max file size before splitting (200KB to avoid 503 token counting errors)
const MAX_FILE_SIZE_BEFORE_SPLIT = 200 * 1024;
// Target size for each split part (~150KB - smaller to avoid server overload)
const SPLIT_PART_SIZE = 150 * 1024;

// Helper to split text content at natural boundaries (paragraphs/sections)
function splitTextContent(content: string, maxPartSize: number): string[] {
  const parts: string[] = [];
  let currentPart = "";

  // Split by double newlines (paragraphs) or markdown headers
  const sections = content.split(/(\n\n+|\n(?=#{1,6}\s))/);

  for (const section of sections) {
    // If adding this section would exceed max size, start a new part
    if (currentPart.length + section.length > maxPartSize && currentPart.length > 0) {
      parts.push(currentPart.trim());
      currentPart = section;
    } else {
      currentPart += section;
    }
  }

  // Add the last part if not empty
  if (currentPart.trim()) {
    parts.push(currentPart.trim());
  }

  return parts;
}

// Check if file should be split based on size
export function shouldSplitFile(fileSize: number): boolean {
  return fileSize > MAX_FILE_SIZE_BEFORE_SPLIT;
}

// Split a text file into multiple parts
export function splitFile(
  content: Buffer,
  fileName: string,
  mimeType: string
): Array<{ buffer: Buffer; fileName: string; partNumber: number; totalParts: number }> {
  // Only split text-based files
  const isTextFile = mimeType.startsWith("text/") ||
                     mimeType === "application/json" ||
                     mimeType === "application/xml";

  if (!isTextFile) {
    // Can't split binary files, return as-is
    return [{ buffer: content, fileName, partNumber: 1, totalParts: 1 }];
  }

  const textContent = content.toString("utf-8");
  const parts = splitTextContent(textContent, SPLIT_PART_SIZE);

  // Get file extension and base name
  const lastDotIndex = fileName.lastIndexOf(".");
  const baseName = lastDotIndex > 0 ? fileName.slice(0, lastDotIndex) : fileName;
  const extension = lastDotIndex > 0 ? fileName.slice(lastDotIndex) : "";

  return parts.map((part, index) => ({
    buffer: Buffer.from(part, "utf-8"),
    fileName: `${baseName}_part${index + 1}of${parts.length}${extension}`,
    partNumber: index + 1,
    totalParts: parts.length,
  }));
}

export async function uploadToStore(
  storeId: string,
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  displayName?: string,
  customMetadata?: CustomMetadata[],
  chunkingConfig?: ChunkingConfig
): Promise<Operation> {
  const apiKey = getApiKey();
  const fileSizeKB = (fileBuffer.length / 1024).toFixed(2);
  const fileSizeMB = (fileBuffer.length / (1024 * 1024)).toFixed(2);
  const fileSize = fileBuffer.length;

  console.log(`[Upload] Starting upload to store ${storeId}`);
  console.log(`[Upload] File: ${fileName}, Size: ${fileSizeKB}KB (${fileSizeMB}MB), MimeType: ${mimeType}`);
  if (chunkingConfig?.white_space_config) {
    console.log(`[Upload] Chunking config: max_tokens=${chunkingConfig.white_space_config.max_tokens_per_chunk}, overlap=${chunkingConfig.white_space_config.max_overlap_tokens || 0}`);
  }

  // Build the request body with metadata
  const requestBody: Record<string, unknown> = {};

  if (displayName) {
    requestBody.displayName = displayName;
  }

  if (customMetadata && customMetadata.length > 0) {
    requestBody.customMetadata = customMetadata;
  }

  if (chunkingConfig) {
    requestBody.chunking_config = chunkingConfig;
  }

  const uploadStartTime = Date.now();

  // Retry the entire upload process (init + upload) on transient errors
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_UPLOAD_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = 2000 * Math.pow(2, attempt - 1); // 2s, 4s, 8s
      console.log(`[Upload] Retry attempt ${attempt + 1}/${MAX_UPLOAD_RETRIES} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    try {
      // Step 1: Initiate resumable upload session
      console.log(`[Upload] Step 1: Initiating resumable upload session...`);
      const initUrl = `${UPLOAD_BASE_URL}/fileSearchStores/${storeId}:uploadToFileSearchStore?key=${apiKey}`;

      const initResponse = await fetch(initUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Upload-Protocol": "resumable",
          "X-Goog-Upload-Command": "start",
          "X-Goog-Upload-Header-Content-Length": fileSize.toString(),
          "X-Goog-Upload-Header-Content-Type": mimeType,
          "X-Goog-Upload-File-Name": fileName,
        },
        body: JSON.stringify(requestBody),
      });

      if (!initResponse.ok) {
        const errorText = await initResponse.text();
        let errorMessage: string;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorText;
        } catch {
          errorMessage = errorText;
        }
        throw new Error(`Failed to initiate upload (${initResponse.status}): ${errorMessage}`);
      }

      // Get the upload URL from the response header
      const uploadUrl = initResponse.headers.get("X-Goog-Upload-URL") ||
                        initResponse.headers.get("x-goog-upload-url");
      if (!uploadUrl) {
        console.log(`[Upload] Response headers:`, Object.fromEntries(initResponse.headers.entries()));
        throw new Error("No upload URL returned from initiation request");
      }
      console.log(`[Upload] Got resumable upload URL`);

      // Step 2: Upload the file content in chunks (matching SDK behavior)
      let offset = 0;
      let response: Response | null = null;

      while (offset < fileSize) {
        const chunkSize = Math.min(MAX_CHUNK_SIZE, fileSize - offset);
        const isLastChunk = offset + chunkSize >= fileSize;
        const uploadCommand = isLastChunk ? "upload, finalize" : "upload";

        console.log(`[Upload] Uploading chunk: offset=${offset}, size=${chunkSize}, isLast=${isLastChunk}`);

        // Extract chunk from buffer
        const chunk = fileBuffer.slice(offset, offset + chunkSize);

        // Convert to Blob like SDK does
        const blob = new Blob([chunk], { type: mimeType });

        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "X-Goog-Upload-Command": uploadCommand,
            "X-Goog-Upload-Offset": offset.toString(),
            "Content-Length": chunkSize.toString(),
            "X-Goog-Upload-File-Name": fileName,
          },
          body: blob,
        });

        // Check for upload status header
        const uploadStatus = res.headers.get("x-goog-upload-status");
        console.log(`[Upload] Chunk response status: ${res.status}, upload-status: ${uploadStatus}`);

        if (!res.ok) {
          const errorText = await res.text();
          let errorMessage: string;
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error?.message || errorText;
          } catch {
            errorMessage = errorText;
          }
          // On 503 or other transient errors, throw to retry the whole upload
          throw new Error(`Upload chunk failed (${res.status}): ${errorMessage}`);
        }

        response = res;
        offset += chunkSize;
      }

      if (!response) {
        throw new Error("No response received from upload");
      }

      const uploadDuration = ((Date.now() - uploadStartTime) / 1000).toFixed(2);
      console.log(`[Upload] Upload completed in ${uploadDuration}s`);

      // Check final status
      const finalStatus = response.headers.get("x-goog-upload-status");
      if (finalStatus !== "final") {
        console.warn(`[Upload] Warning: Upload status is '${finalStatus}', expected 'final'`);
      }

      const result = await response.json();
      console.log(`[Upload] Operation created: ${result.name}, done: ${result.done}`);

      return {
        name: result.name || "",
        done: result.done || false,
        metadata: result.metadata,
        error: result.error
          ? {
              code: typeof result.error.code === 'number' ? result.error.code : 0,
              message: typeof result.error.message === 'string' ? result.error.message : ""
            }
          : undefined,
        response: result.response,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = lastError.message;

      // Check if it's a retryable error
      const isRetryable =
        errorMessage.includes("503") ||
        errorMessage.includes("502") ||
        errorMessage.includes("500") ||
        errorMessage.includes("Service Unavailable") ||
        errorMessage.includes("ECONNRESET") ||
        errorMessage.includes("ETIMEDOUT") ||
        errorMessage.includes("terminated");

      if (!isRetryable || attempt === MAX_UPLOAD_RETRIES - 1) {
        console.error(`[Upload] Upload failed for ${fileName}: ${errorMessage}`);
        throw lastError;
      }

      console.warn(`[Upload] Transient error, will retry: ${errorMessage}`);
    }
  }

  throw lastError || new Error("Upload failed after all retries");
}

// Operation polling
export async function getOperation(operationName: string): Promise<Operation> {
  return apiRequest<Operation>(`/${operationName}`);
}

export async function pollOperation(
  operationName: string,
  maxAttempts: number = 60,
  intervalMs: number = 2000
): Promise<Operation> {
  for (let i = 0; i < maxAttempts; i++) {
    const operation = await getOperation(operationName);
    if (operation.done) {
      return operation;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("Operation timed out");
}
