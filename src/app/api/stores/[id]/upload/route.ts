import { NextRequest, NextResponse } from "next/server";
import { uploadToStore, shouldSplitFile, splitFile, ChunkingConfig } from "@/lib/api";
import { auth } from "@/lib/auth";

interface CustomMetadata {
  key: string;
  stringValue?: string;
  numericValue?: number;
}

// Map of file extensions to MIME types for common document types
// Note: Using text/plain for markdown files to avoid Google API parsing issues (503 errors)
const MIME_TYPE_MAP: Record<string, string> = {
  // Text/Markdown - using text/plain to avoid server-side parsing issues
  ".md": "text/plain",
  ".markdown": "text/plain",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".json": "application/json",
  ".xml": "application/xml",
  ".html": "text/html",
  ".htm": "text/html",
  // Documents
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  // Code
  ".js": "text/javascript",
  ".ts": "text/typescript",
  ".py": "text/x-python",
  ".java": "text/x-java-source",
  ".c": "text/x-c",
  ".cpp": "text/x-c++",
  ".h": "text/x-c",
  ".css": "text/css",
  ".sql": "application/sql",
};

function getMimeType(fileName: string, browserMimeType: string): string {
  // If browser provided a valid MIME type (not empty), use it
  if (browserMimeType && browserMimeType !== "application/octet-stream") {
    return browserMimeType;
  }

  // Fall back to extension-based detection
  const ext = fileName.toLowerCase().match(/\.[^.]+$/)?.[0] || "";
  return MIME_TYPE_MAP[ext] || "application/octet-stream";
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const displayName = formData.get("displayName") as string | null;
    const metadataStr = formData.get("metadata") as string | null;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    let customMetadata: CustomMetadata[] | undefined;
    if (metadataStr) {
      try {
        customMetadata = JSON.parse(metadataStr);
      } catch {
        return NextResponse.json(
          { error: "Invalid metadata format" },
          { status: 400 }
        );
      }
    }

    // Parse chunking config
    const chunkingConfigStr = formData.get("chunkingConfig") as string | null;
    let chunkingConfig: ChunkingConfig | undefined;
    if (chunkingConfigStr) {
      try {
        chunkingConfig = JSON.parse(chunkingConfigStr);
      } catch {
        return NextResponse.json(
          { error: "Invalid chunking config format" },
          { status: 400 }
        );
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = getMimeType(file.name, file.type);

    // Check if split is disabled via query param
    const url = new URL(request.url);
    const splitDisabled = url.searchParams.get("split") === "false";

    console.log(`[Route] Upload request received for store ${id}`);
    console.log(`[Route] File: ${file.name}, Size: ${(file.size / 1024).toFixed(2)}KB, Browser MIME: ${file.type}, Resolved MIME: ${mimeType}, splitDisabled: ${splitDisabled}`);

    // Check if file needs to be split due to size (to avoid 503 token counting errors)
    // Skip splitting if explicitly disabled
    if (!splitDisabled && shouldSplitFile(buffer.length)) {
      console.log(`[Route] File exceeds 500KB, splitting into smaller parts...`);
      const parts = splitFile(buffer, file.name, mimeType);
      console.log(`[Route] Split into ${parts.length} parts`);

      // Upload all parts sequentially with delay between uploads
      const operations = [];
      for (const part of parts) {
        // Add delay between uploads to avoid overwhelming the server
        if (part.partNumber > 1) {
          console.log(`[Route] Waiting 2s before next upload...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        console.log(`[Route] Uploading part ${part.partNumber}/${part.totalParts}: ${part.fileName} (${(part.buffer.length / 1024).toFixed(2)}KB)`);

        // Add part info to metadata
        const partMetadata = [
          ...(customMetadata || []),
          { key: "originalFileName", stringValue: file.name },
          { key: "partNumber", stringValue: part.partNumber.toString() },
          { key: "totalParts", stringValue: part.totalParts.toString() },
        ];

        const operation = await uploadToStore(
          id,
          part.buffer,
          part.fileName,
          mimeType,
          displayName ? `${displayName} (Part ${part.partNumber}/${part.totalParts})` : undefined,
          partMetadata,
          chunkingConfig
        );
        operations.push(operation);
        console.log(`[Route] Part ${part.partNumber} uploaded: ${operation.name}`);
      }

      // Return the last operation (client will poll this one)
      // Include info about all parts in response
      const lastOp = operations[operations.length - 1];
      console.log(`[Route] All ${parts.length} parts uploaded successfully`);
      return NextResponse.json({
        ...lastOp,
        splitInfo: {
          totalParts: parts.length,
          operations: operations.map(op => op.name),
        },
      });
    }

    // Regular upload for smaller files
    const operation = await uploadToStore(
      id,
      buffer,
      file.name,
      mimeType,
      displayName || undefined,
      customMetadata,
      chunkingConfig
    );

    console.log(`[Route] Upload operation created: ${operation.name}, done: ${operation.done}`);
    return NextResponse.json(operation);
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload file" },
      { status: 500 }
    );
  }
}
