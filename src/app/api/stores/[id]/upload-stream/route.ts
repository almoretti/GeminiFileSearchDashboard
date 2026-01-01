import { NextRequest, NextResponse } from "next/server";
import { uploadToStore, shouldSplitFile, splitFile } from "@/lib/api";
import { auth } from "@/lib/auth";

interface CustomMetadata {
  key: string;
  stringValue?: string;
  numericValue?: number;
}

// Map of file extensions to MIME types for common document types
const MIME_TYPE_MAP: Record<string, string> = {
  ".md": "text/plain",
  ".markdown": "text/plain",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".json": "application/json",
  ".xml": "application/xml",
  ".html": "text/html",
  ".htm": "text/html",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
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
  if (browserMimeType && browserMimeType !== "application/octet-stream") {
    return browserMimeType;
  }
  const ext = fileName.toLowerCase().match(/\.[^.]+$/)?.[0] || "";
  return MIME_TYPE_MAP[ext] || "application/octet-stream";
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  // Create a TransformStream for SSE
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendEvent = async (event: string, data: Record<string, unknown>) => {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    await writer.write(encoder.encode(message));
  };

  // Process upload in background
  (async () => {
    try {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const displayName = formData.get("displayName") as string | null;
      const metadataStr = formData.get("metadata") as string | null;

      if (!file) {
        await sendEvent("error", { message: "File is required" });
        await writer.close();
        return;
      }

      let customMetadata: CustomMetadata[] | undefined;
      if (metadataStr) {
        try {
          customMetadata = JSON.parse(metadataStr);
        } catch {
          await sendEvent("error", { message: "Invalid metadata format" });
          await writer.close();
          return;
        }
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const mimeType = getMimeType(file.name, file.type);

      await sendEvent("start", {
        fileName: file.name,
        fileSize: file.size,
        mimeType,
      });

      // Check if file needs to be split
      if (shouldSplitFile(buffer.length)) {
        const parts = splitFile(buffer, file.name, mimeType);

        await sendEvent("splitting", {
          totalParts: parts.length,
          message: `Large file detected. Splitting into ${parts.length} parts for reliable upload.`,
        });

        const operations = [];
        for (const part of parts) {
          // Add delay between uploads
          if (part.partNumber > 1) {
            await sendEvent("waiting", {
              partNumber: part.partNumber,
              totalParts: part.totalParts,
              message: "Waiting before next upload...",
            });
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

          await sendEvent("uploading", {
            partNumber: part.partNumber,
            totalParts: part.totalParts,
            partSize: part.buffer.length,
            fileName: part.fileName,
            message: `Uploading part ${part.partNumber} of ${part.totalParts}...`,
          });

          const partMetadata = [
            ...(customMetadata || []),
            { key: "originalFileName", stringValue: file.name },
            { key: "partNumber", stringValue: part.partNumber.toString() },
            { key: "totalParts", stringValue: part.totalParts.toString() },
          ];

          try {
            const operation = await uploadToStore(
              id,
              part.buffer,
              part.fileName,
              mimeType,
              displayName ? `${displayName} (Part ${part.partNumber}/${part.totalParts})` : undefined,
              partMetadata
            );
            operations.push(operation);

            await sendEvent("partComplete", {
              partNumber: part.partNumber,
              totalParts: part.totalParts,
              operationName: operation.name,
              message: `Part ${part.partNumber} of ${part.totalParts} uploaded successfully`,
            });
          } catch (error) {
            await sendEvent("partError", {
              partNumber: part.partNumber,
              totalParts: part.totalParts,
              error: error instanceof Error ? error.message : "Upload failed",
              message: `Failed to upload part ${part.partNumber}. ${operations.length} parts were uploaded successfully.`,
            });
            throw error;
          }
        }

        const lastOp = operations[operations.length - 1];
        await sendEvent("complete", {
          operationName: lastOp.name,
          totalParts: parts.length,
          operations: operations.map(op => op.name),
          message: `All ${parts.length} parts uploaded successfully!`,
        });
      } else {
        // Regular upload for smaller files
        await sendEvent("uploading", {
          partNumber: 1,
          totalParts: 1,
          message: "Uploading file...",
        });

        const operation = await uploadToStore(
          id,
          buffer,
          file.name,
          mimeType,
          displayName || undefined,
          customMetadata
        );

        await sendEvent("complete", {
          operationName: operation.name,
          totalParts: 1,
          message: "File uploaded successfully!",
        });
      }
    } catch (error) {
      await sendEvent("error", {
        message: error instanceof Error ? error.message : "Upload failed",
      });
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
