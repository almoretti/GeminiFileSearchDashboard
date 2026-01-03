import { NextRequest, NextResponse } from "next/server";
import { uploadToStore, splitFile, ChunkingConfig, isTextBasedFile } from "@/lib/api";
import { auth } from "@/lib/auth";
import {
  isGhostscriptAvailable,
  compressPdf,
  splitPdfByPages,
  getPdfPageCount,
  getFileSizeMB,
  PdfQuality,
} from "@/lib/pdf-processor";

interface CustomMetadata {
  key: string;
  stringValue?: string;
  numericValue?: number;
}

interface SplitConfig {
  enabled: boolean;
  numberOfParts: number;
}

interface PdfConfig {
  compress: boolean;
  quality: PdfQuality;
  splitIfOverLimit: boolean;
  pagesPerPart?: number;
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

      // Parse chunking config
      const chunkingConfigStr = formData.get("chunkingConfig") as string | null;
      let chunkingConfig: ChunkingConfig | undefined;
      if (chunkingConfigStr) {
        try {
          chunkingConfig = JSON.parse(chunkingConfigStr);
        } catch {
          await sendEvent("error", { message: "Invalid chunking config format" });
          await writer.close();
          return;
        }
      }

      // Parse split config (opt-in file splitting)
      const splitConfigStr = formData.get("splitConfig") as string | null;
      let splitConfig: SplitConfig | undefined;
      if (splitConfigStr) {
        try {
          splitConfig = JSON.parse(splitConfigStr);
        } catch {
          await sendEvent("error", { message: "Invalid split config format" });
          await writer.close();
          return;
        }
      }

      // Parse PDF config (compression and page splitting)
      const pdfConfigStr = formData.get("pdfConfig") as string | null;
      let pdfConfig: PdfConfig | undefined;
      if (pdfConfigStr) {
        try {
          pdfConfig = JSON.parse(pdfConfigStr);
        } catch {
          await sendEvent("error", { message: "Invalid PDF config format" });
          await writer.close();
          return;
        }
      }

      let buffer = Buffer.from(await file.arrayBuffer());
      const mimeType = getMimeType(file.name, file.type);

      await sendEvent("start", {
        fileName: file.name,
        fileSize: file.size,
        mimeType,
      });

      // PDF processing (compression and/or page splitting)
      if (mimeType === "application/pdf" && pdfConfig) {
        const gsAvailable = await isGhostscriptAvailable();

        if (!gsAvailable) {
          await sendEvent("info", {
            message: "PDF processing unavailable (Ghostscript not installed). Uploading original file.",
          });
        } else {
          const originalSizeMB = getFileSizeMB(buffer);

          // Compress PDF if requested
          if (pdfConfig.compress) {
            await sendEvent("processing", {
              type: "compress",
              message: `Compressing PDF (${originalSizeMB.toFixed(1)}MB) with ${pdfConfig.quality} quality...`,
            });

            buffer = await compressPdf(buffer, { quality: pdfConfig.quality });
            const newSizeMB = getFileSizeMB(buffer);
            const reduction = ((1 - newSizeMB / originalSizeMB) * 100).toFixed(1);

            await sendEvent("processed", {
              type: "compress",
              originalSizeMB: originalSizeMB.toFixed(2),
              newSizeMB: newSizeMB.toFixed(2),
              reduction: `${reduction}%`,
              message: `Compressed: ${originalSizeMB.toFixed(1)}MB → ${newSizeMB.toFixed(1)}MB (${reduction}% reduction)`,
            });
          }

          // Split PDF by pages if still over 100MB and splitting is enabled
          const currentSizeMB = getFileSizeMB(buffer);
          if (pdfConfig.splitIfOverLimit && currentSizeMB > 100) {
            await sendEvent("processing", {
              type: "split",
              message: `PDF still over 100MB (${currentSizeMB.toFixed(1)}MB). Splitting by pages...`,
            });

            const pageCount = await getPdfPageCount(buffer);
            const pagesPerPart = pdfConfig.pagesPerPart || Math.ceil(pageCount / Math.ceil(currentSizeMB / 90));

            await sendEvent("splitting", {
              totalPages: pageCount,
              pagesPerPart,
              message: `Splitting ${pageCount} pages into parts of ${pagesPerPart} pages each...`,
            });

            const parts = await splitPdfByPages(buffer, pagesPerPart, file.name);

            const operations = [];
            for (let i = 0; i < parts.length; i++) {
              const part = parts[i];

              if (i > 0) {
                await sendEvent("waiting", {
                  partNumber: i + 1,
                  totalParts: parts.length,
                  message: "Waiting before next upload...",
                });
                await new Promise(resolve => setTimeout(resolve, 2000));
              }

              await sendEvent("uploading", {
                partNumber: i + 1,
                totalParts: parts.length,
                partSize: part.buffer.length,
                fileName: part.filename,
                pageRange: `${part.pageStart}-${part.pageEnd}`,
                message: `Uploading part ${i + 1}/${parts.length} (pages ${part.pageStart}-${part.pageEnd})...`,
              });

              const partMetadata = [
                ...(customMetadata || []),
                { key: "originalFileName", stringValue: file.name },
                { key: "partNumber", stringValue: (i + 1).toString() },
                { key: "totalParts", stringValue: parts.length.toString() },
                { key: "pageStart", stringValue: part.pageStart.toString() },
                { key: "pageEnd", stringValue: part.pageEnd.toString() },
              ];

              try {
                const operation = await uploadToStore(
                  id,
                  part.buffer,
                  part.filename,
                  mimeType,
                  displayName ? `${displayName} (Part ${i + 1}/${parts.length})` : undefined,
                  partMetadata,
                  undefined // No chunking config for PDFs
                );
                operations.push(operation);

                await sendEvent("partComplete", {
                  partNumber: i + 1,
                  totalParts: parts.length,
                  operationName: operation.name,
                  message: `Part ${i + 1}/${parts.length} uploaded successfully`,
                });
              } catch (error) {
                await sendEvent("partError", {
                  partNumber: i + 1,
                  totalParts: parts.length,
                  error: error instanceof Error ? error.message : "Upload failed",
                  message: `Failed to upload part ${i + 1}. ${operations.length} parts uploaded successfully.`,
                });
                throw error;
              }
            }

            const lastOp = operations[operations.length - 1];
            await sendEvent("complete", {
              operationName: lastOp.name,
              totalParts: parts.length,
              operations: operations.map(op => op.name),
              compressionApplied: pdfConfig.compress,
              message: `All ${parts.length} PDF parts uploaded successfully!`,
            });

            // Writer will be closed in finally block
            return;
          }
        }
      }

      // Opt-in file splitting (only for text-based files)
      if (splitConfig?.enabled && isTextBasedFile(mimeType)) {
        const parts = splitFile(buffer, file.name, mimeType, splitConfig.numberOfParts);

        await sendEvent("splitting", {
          totalParts: parts.length,
          message: `Splitting into ${parts.length} parts as requested.`,
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
              partMetadata,
              chunkingConfig
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
        // Regular upload (no splitting)
        if (splitConfig?.enabled && !isTextBasedFile(mimeType)) {
          await sendEvent("info", {
            message: "Split requested but file is binary. Uploading as single file.",
          });
        }

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
          customMetadata,
          chunkingConfig
        );

        await sendEvent("complete", {
          operationName: operation.name,
          totalParts: 1,
          message: "File uploaded successfully!",
        });
      }
    } catch (error) {
      try {
        await sendEvent("error", {
          message: error instanceof Error ? error.message : "Upload failed",
        });
      } catch {
        // Ignore errors when sending error event (stream may already be closed)
      }
    } finally {
      try {
        await writer.close();
      } catch {
        // Ignore close errors (stream may already be closed)
      }
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
