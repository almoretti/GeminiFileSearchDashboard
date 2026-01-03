"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, FileUp, X, CheckCircle, Plus, Trash2, SplitSquareHorizontal, Settings2, ChevronDown, ChevronUp, AlertCircle, AlertTriangle, FileArchive, Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PdfQuality = "screen" | "ebook" | "printer" | "prepress";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  onUploadComplete: () => void;
}

interface MetadataEntry {
  id: string;
  key: string;
  value: string;
}

type UploadStatus = "idle" | "uploading" | "processing" | "complete" | "error";

interface UploadProgress {
  currentPart: number;
  totalParts: number;
  message: string;
}

export function UploadDialog({
  open,
  onOpenChange,
  storeId,
  onUploadComplete,
}: UploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [metadata, setMetadata] = useState<MetadataEntry[]>([]);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [useCustomChunking, setUseCustomChunking] = useState(false);
  const [maxTokensPerChunk, setMaxTokensPerChunk] = useState(200);
  const [maxOverlapTokens, setMaxOverlapTokens] = useState(20);
  const [enableSplitting, setEnableSplitting] = useState(false);
  const [numberOfParts, setNumberOfParts] = useState(2);
  // PDF processing options
  const [pdfProcessingAvailable, setPdfProcessingAvailable] = useState(false);
  const [enablePdfCompression, setEnablePdfCompression] = useState(false);
  const [pdfQuality, setPdfQuality] = useState<PdfQuality>("ebook");
  const [enablePdfSplitIfOverLimit, setEnablePdfSplitIfOverLimit] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Check if PDF processing (Ghostscript) is available
  useEffect(() => {
    async function checkPdfProcessing() {
      try {
        const response = await fetch("/api/pdf-processing/available");
        if (response.ok) {
          const data = await response.json();
          setPdfProcessingAvailable(data.available);
        }
      } catch {
        setPdfProcessingAvailable(false);
      }
    }
    checkPdfProcessing();
  }, []);

  // Check if file is text-based (can be split)
  const isTextBasedFile = (mimeType: string): boolean => {
    return (
      mimeType.startsWith("text/") ||
      mimeType === "application/json" ||
      mimeType === "application/xml"
    );
  };

  const getFileMimeType = (): string => {
    if (!file) return "";
    // Simple extension-based check for UI purposes
    const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] || "";
    const textExtensions = [".txt", ".md", ".markdown", ".json", ".xml", ".csv", ".html", ".htm", ".js", ".ts", ".py", ".css", ".sql"];
    if (textExtensions.includes(ext)) return "text/plain";
    if (file.type) return file.type;
    return "application/octet-stream";
  };

  const canSplitFile = file ? isTextBasedFile(getFileMimeType()) : false;
  const isPdfFile = file ? getFileMimeType() === "application/pdf" : false;

  // File validation constants
  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

  // Check if file type is supported by FileSearch API
  const isUnsupportedFileType = (mimeType: string): boolean => {
    return (
      mimeType.startsWith("image/") ||
      mimeType.startsWith("audio/") ||
      mimeType.startsWith("video/")
    );
  };

  // Get file validation status
  const getFileValidation = (): { valid: boolean; error: string | null; warning: string | null } => {
    if (!file) return { valid: true, error: null, warning: null };

    const mimeType = getFileMimeType();

    // Check for unsupported file types
    if (isUnsupportedFileType(mimeType)) {
      const fileType = mimeType.split("/")[0];
      return {
        valid: false,
        error: `${fileType.charAt(0).toUpperCase() + fileType.slice(1)} files are not supported. FileSearch only supports documents, text, and code files.`,
        warning: null,
      };
    }

    // Check for file size limit
    if (file.size > MAX_FILE_SIZE) {
      // If it's a PDF and PDF processing is available, allow larger files
      if (mimeType === "application/pdf" && pdfProcessingAvailable) {
        return {
          valid: true,
          error: null,
          warning: `Large PDF (${(file.size / 1024 / 1024).toFixed(1)}MB). Enable compression and/or auto-split to process.`,
        };
      }
      return {
        valid: false,
        error: `File exceeds 100MB limit (${(file.size / 1024 / 1024).toFixed(1)}MB). Please use a smaller file or split it externally.`,
        warning: null,
      };
    }

    // Warning for large files approaching limit
    if (file.size > 80 * 1024 * 1024) {
      return {
        valid: true,
        error: null,
        warning: `Large file (${(file.size / 1024 / 1024).toFixed(1)}MB). Upload may take longer.`,
      };
    }

    return { valid: true, error: null, warning: null };
  };

  const fileValidation = getFileValidation();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!displayName) {
        setDisplayName(selectedFile.name);
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      if (!displayName) {
        setDisplayName(droppedFile.name);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const addMetadataEntry = () => {
    setMetadata([
      ...metadata,
      { id: crypto.randomUUID(), key: "", value: "" },
    ]);
  };

  const updateMetadataEntry = (
    id: string,
    field: "key" | "value",
    value: string
  ) => {
    setMetadata(
      metadata.map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry
      )
    );
  };

  const removeMetadataEntry = (id: string) => {
    setMetadata(metadata.filter((entry) => entry.id !== id));
  };

  const pollOperation = async (operationName: string) => {
    // Increased timeout for large files: 150 attempts × 2s = 5 minutes
    const maxAttempts = 150;
    const intervalMs = 2000;

    console.log(`[Poll] Starting to poll operation: ${operationName}`);
    console.log(`[Poll] Max wait time: ${(maxAttempts * intervalMs) / 1000}s`);

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`/api/operations/${operationName}`);
        if (!response.ok) {
          throw new Error("Failed to check operation status");
        }

        const operation = await response.json();

        // Log every poll for debugging
        if (i === 0 || (i + 1) % 5 === 0) {
          console.log(`[Poll] Attempt ${i + 1}: done=${operation.done}, hasResponse=${!!operation.response}, hasError=${!!operation.error}`);
        }

        // Check if operation is done (done === true) OR has a response (which means it completed)
        if (operation.done === true || operation.response) {
          if (operation.error) {
            console.error(`[Poll] Operation failed:`, operation.error);
            throw new Error(operation.error.message || "Upload processing failed");
          }
          console.log(`[Poll] Operation completed successfully after ${i + 1} attempts`);
          return operation;
        }

        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      } catch (error) {
        console.error(`[Poll] Error polling operation:`, error);
        throw error;
      }
    }
    console.error(`[Poll] Operation timed out after ${maxAttempts} attempts`);
    throw new Error("Operation timed out after 5 minutes. The file may still be processing - check back later.");
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "Error",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    setStatus("uploading");
    setErrorMessage("");
    setProgress(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (displayName.trim()) {
        formData.append("displayName", displayName.trim());
      }

      // Add metadata as JSON
      const validMetadata = metadata.filter(
        (entry) => entry.key.trim() && entry.value.trim()
      );
      if (validMetadata.length > 0) {
        formData.append(
          "metadata",
          JSON.stringify(
            validMetadata.map((entry) => ({
              key: entry.key.trim(),
              stringValue: entry.value.trim(),
            }))
          )
        );
      }

      // Add chunking config if enabled
      if (useCustomChunking) {
        formData.append(
          "chunkingConfig",
          JSON.stringify({
            white_space_config: {
              max_tokens_per_chunk: maxTokensPerChunk,
              max_overlap_tokens: maxOverlapTokens,
            },
          })
        );
      }

      // Add split config if enabled (only for text-based files)
      const shouldSplit = enableSplitting && canSplitFile;
      if (shouldSplit) {
        formData.append(
          "splitConfig",
          JSON.stringify({
            enabled: true,
            numberOfParts: numberOfParts,
          })
        );
      }

      // Add PDF config if enabled
      const shouldProcessPdf = isPdfFile && pdfProcessingAvailable && (enablePdfCompression || enablePdfSplitIfOverLimit);
      if (shouldProcessPdf) {
        formData.append(
          "pdfConfig",
          JSON.stringify({
            compress: enablePdfCompression,
            quality: pdfQuality,
            splitIfOverLimit: enablePdfSplitIfOverLimit,
          })
        );
      }

      console.log(`[Client] Starting upload for file: ${file.name}, size: ${(file.size / 1024).toFixed(2)}KB, splitting: ${shouldSplit}, pdfProcessing: ${shouldProcessPdf}, customChunking: ${useCustomChunking}`);

      // Use streaming endpoint for split uploads or PDF processing
      if (shouldSplit || shouldProcessPdf) {
        // Use streaming endpoint for progress updates
        const response = await fetch(`/api/stores/${storeId}/upload-stream`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Failed to start upload");
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response stream available");
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let lastOperationName = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE messages
          const messages = buffer.split("\n\n");
          buffer = messages.pop() || ""; // Keep incomplete message in buffer

          for (const message of messages) {
            if (!message.trim()) continue;

            const eventMatch = message.match(/event: (\w+)/);
            const dataMatch = message.match(/data: (.+)/s);

            if (eventMatch && dataMatch) {
              const eventType = eventMatch[1];
              const data = JSON.parse(dataMatch[1]);

              console.log(`[Client] SSE event: ${eventType}`, data);

              switch (eventType) {
                case "info":
                  // Informational message (e.g., PDF processing unavailable)
                  setProgress(prev => ({
                    currentPart: prev?.currentPart || 0,
                    totalParts: prev?.totalParts || 1,
                    message: data.message,
                  }));
                  break;

                case "processing":
                  // PDF compression or split in progress
                  setProgress(prev => ({
                    currentPart: prev?.currentPart || 0,
                    totalParts: prev?.totalParts || 1,
                    message: data.message,
                  }));
                  break;

                case "processed":
                  // PDF compression complete
                  setProgress(prev => ({
                    currentPart: prev?.currentPart || 0,
                    totalParts: prev?.totalParts || 1,
                    message: data.message,
                  }));
                  break;

                case "splitting":
                  setProgress({
                    currentPart: 0,
                    totalParts: data.totalParts || 1,
                    message: data.message,
                  });
                  break;

                case "waiting":
                case "uploading":
                  setProgress({
                    currentPart: data.partNumber,
                    totalParts: data.totalParts,
                    message: data.message,
                  });
                  break;

                case "partComplete":
                  setProgress({
                    currentPart: data.partNumber,
                    totalParts: data.totalParts,
                    message: data.message,
                  });
                  lastOperationName = data.operationName;
                  break;

                case "partError":
                  throw new Error(data.message);

                case "complete":
                  lastOperationName = data.operationName;
                  setProgress({
                    currentPart: data.totalParts,
                    totalParts: data.totalParts,
                    message: data.message,
                  });
                  break;

                case "error":
                  throw new Error(data.message);
              }
            }
          }
        }

        // Poll for final processing if needed
        if (lastOperationName) {
          setStatus("processing");
          setProgress(prev => prev ? { ...prev, message: "Processing documents..." } : null);
          await pollOperation(lastOperationName);
        }
      } else {
        // Single file upload (original method)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minutes timeout

        let response: Response;
        try {
          response = await fetch(`/api/stores/${storeId}/upload?split=false`, {
            method: "POST",
            body: formData,
            signal: controller.signal,
          });
        } catch (fetchError) {
          clearTimeout(timeoutId);
          if (fetchError instanceof Error && fetchError.name === "AbortError") {
            throw new Error("Upload timed out. Please try again.");
          }
          throw fetchError;
        }
        clearTimeout(timeoutId);

        if (!response.ok) {
          const data = await response.json();
          console.error(`[Client] Upload failed with status ${response.status}:`, data.error);
          throw new Error(data.error || "Failed to upload file");
        }

        const operation = await response.json();
        console.log(`[Client] Upload request completed, operation: ${operation.name}, done: ${operation.done}`);

        if (!operation.done) {
          setStatus("processing");
          console.log(`[Client] File uploaded, waiting for processing to complete...`);
          await pollOperation(operation.name);
        }
      }

      setStatus("complete");
      toast({
        title: "Success",
        description: progress?.totalParts && progress.totalParts > 1
          ? `File uploaded successfully as ${progress.totalParts} parts`
          : "File uploaded successfully",
      });

      // Reset and close after a short delay
      setTimeout(() => {
        handleClose();
        onUploadComplete();
      }, 1500);
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to upload file"
      );
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload file",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setFile(null);
    setDisplayName("");
    setMetadata([]);
    setStatus("idle");
    setErrorMessage("");
    setProgress(null);
    setShowAdvanced(false);
    setUseCustomChunking(false);
    setMaxTokensPerChunk(200);
    setMaxOverlapTokens(20);
    setEnableSplitting(false);
    setNumberOfParts(2);
    setEnablePdfCompression(false);
    setPdfQuality("ebook");
    setEnablePdfSplitIfOverLimit(false);
    onOpenChange(false);
  };

  const isProcessing = status === "uploading" || status === "processing";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload File</DialogTitle>
          <DialogDescription>
            Upload a document to be processed and indexed for search.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              file
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => !isProcessing && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
              disabled={isProcessing}
            />

            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileUp className="h-8 w-8 text-primary" />
                <div className="text-left">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                {!isProcessing && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ) : (
              <>
                <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 font-medium">
                  Drop a file here or click to browse
                </p>
                <p className="text-sm text-muted-foreground">
                  Supports PDF, TXT, HTML, and more
                </p>
              </>
            )}
          </div>

          {/* File validation errors/warnings */}
          {fileValidation.error && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{fileValidation.error}</p>
            </div>
          )}

          {fileValidation.warning && (
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-600">{fileValidation.warning}</p>
            </div>
          )}

          {/* Display name input */}
          <div className="grid gap-2">
            <Label htmlFor="displayName">Display Name (optional)</Label>
            <Input
              id="displayName"
              placeholder="Document display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={isProcessing}
            />
          </div>

          {/* Custom Metadata */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Custom Metadata (optional)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addMetadataEntry}
                disabled={isProcessing || metadata.length >= 20}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>

            {metadata.length > 0 && (
              <div className="space-y-2">
                {metadata.map((entry) => (
                  <div key={entry.id} className="flex gap-2">
                    <Input
                      placeholder="Key"
                      value={entry.key}
                      onChange={(e) =>
                        updateMetadataEntry(entry.id, "key", e.target.value)
                      }
                      disabled={isProcessing}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Value"
                      value={entry.value}
                      onChange={(e) =>
                        updateMetadataEntry(entry.id, "value", e.target.value)
                      }
                      disabled={isProcessing}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMetadataEntry(entry.id)}
                      disabled={isProcessing}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {metadata.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Add key-value pairs for filtering and querying documents (max 20)
              </p>
            )}
          </div>

          {/* File Splitting Options */}
          <div className="py-2 px-3 bg-muted/50 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SplitSquareHorizontal className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="split-mode" className="text-sm font-medium cursor-pointer">
                    Split into multiple parts
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Split text files into multiple documents for upload
                  </p>
                </div>
              </div>
              <Switch
                id="split-mode"
                checked={enableSplitting}
                onCheckedChange={setEnableSplitting}
                disabled={isProcessing || (file !== null && !canSplitFile)}
              />
            </div>

            {enableSplitting && canSplitFile && (
              <div className="flex items-center gap-3 pl-6">
                <Label htmlFor="num-parts" className="text-xs whitespace-nowrap">
                  Number of parts:
                </Label>
                <Input
                  id="num-parts"
                  type="number"
                  min={2}
                  max={10}
                  value={numberOfParts}
                  onChange={(e) => setNumberOfParts(Math.min(10, Math.max(2, parseInt(e.target.value) || 2)))}
                  disabled={isProcessing}
                  className="h-8 w-20"
                />
                <span className="text-xs text-muted-foreground">(2-10)</span>
              </div>
            )}

            {file && !canSplitFile && !isPdfFile && (
              <p className="text-xs text-amber-600 pl-6">
                Binary files (images, Office docs) cannot be split. File will upload as a single document.
              </p>
            )}
          </div>

          {/* PDF Processing Options */}
          {isPdfFile && (
            <div className="py-2 px-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg space-y-3 border border-blue-200 dark:border-blue-900">
              <div className="flex items-center gap-2">
                <FileArchive className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">PDF Processing</span>
                {!pdfProcessingAvailable && (
                  <span className="text-xs bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded">
                    Docker only
                  </span>
                )}
              </div>

              {pdfProcessingAvailable ? (
                <>
                  {/* Compression toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="pdf-compress" className="text-sm font-medium cursor-pointer">
                        Compress PDF
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Reduce file size before upload
                      </p>
                    </div>
                    <Switch
                      id="pdf-compress"
                      checked={enablePdfCompression}
                      onCheckedChange={setEnablePdfCompression}
                      disabled={isProcessing}
                    />
                  </div>

                  {/* Quality selector */}
                  {enablePdfCompression && (
                    <div className="pl-1 space-y-2">
                      <Label htmlFor="pdf-quality" className="text-xs">Compression Quality</Label>
                      <Select
                        value={pdfQuality}
                        onValueChange={(value: PdfQuality) => setPdfQuality(value)}
                        disabled={isProcessing}
                      >
                        <SelectTrigger id="pdf-quality" className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="screen">Low (72 dpi) - Smallest file</SelectItem>
                          <SelectItem value="ebook">Medium (150 dpi) - Recommended</SelectItem>
                          <SelectItem value="printer">High (300 dpi) - Best quality</SelectItem>
                          <SelectItem value="prepress">Maximum - Minimal compression</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Auto-split toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="pdf-split" className="text-sm font-medium cursor-pointer">
                        Auto-split if over 100MB
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Split large PDFs by page ranges
                      </p>
                    </div>
                    <Switch
                      id="pdf-split"
                      checked={enablePdfSplitIfOverLimit}
                      onCheckedChange={setEnablePdfSplitIfOverLimit}
                      disabled={isProcessing}
                    />
                  </div>
                </>
              ) : (
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>
                    PDF compression and splitting requires Ghostscript, which is only available when running in Docker.
                    The PDF will be uploaded without processing.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Advanced Settings */}
          <div className="border rounded-lg">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              disabled={isProcessing}
              className="flex items-center justify-between w-full py-2 px-3 text-sm font-medium hover:bg-muted/50 transition-colors disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <span>Advanced Settings</span>
              </div>
              {showAdvanced ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {showAdvanced && (
              <div className="px-3 pb-3 space-y-4 border-t">
                {/* Chunking Configuration */}
                <div className="pt-3">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <Label htmlFor="custom-chunking" className="text-sm font-medium cursor-pointer">
                        Custom Chunking
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Control how documents are split for indexing
                      </p>
                    </div>
                    <Switch
                      id="custom-chunking"
                      checked={useCustomChunking}
                      onCheckedChange={setUseCustomChunking}
                      disabled={isProcessing}
                    />
                  </div>

                  {useCustomChunking && (
                    <div className="space-y-3 pl-1">
                      <div className="grid gap-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="max-tokens" className="text-xs">
                            Max tokens per chunk
                          </Label>
                          <span className="text-xs text-muted-foreground">
                            {maxTokensPerChunk}
                          </span>
                        </div>
                        <Input
                          id="max-tokens"
                          type="number"
                          min={50}
                          max={1000}
                          value={maxTokensPerChunk}
                          onChange={(e) => setMaxTokensPerChunk(Math.min(1000, Math.max(50, parseInt(e.target.value) || 200)))}
                          disabled={isProcessing}
                          className="h-8"
                        />
                        <p className="text-xs text-muted-foreground">
                          Smaller chunks (200) = precise retrieval. Larger (500+) = more context.
                        </p>
                      </div>

                      <div className="grid gap-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="overlap-tokens" className="text-xs">
                            Overlap tokens
                          </Label>
                          <span className="text-xs text-muted-foreground">
                            {maxOverlapTokens}
                          </span>
                        </div>
                        <Input
                          id="overlap-tokens"
                          type="number"
                          min={0}
                          max={100}
                          value={maxOverlapTokens}
                          onChange={(e) => setMaxOverlapTokens(Math.min(100, Math.max(0, parseInt(e.target.value) || 20)))}
                          disabled={isProcessing}
                          className="h-8"
                        />
                        <p className="text-xs text-muted-foreground">
                          Tokens shared between adjacent chunks for context continuity.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Status display */}
          {status === "uploading" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{progress?.message || "Uploading file..."}</span>
              </div>
              {/* Progress bar for multi-part uploads */}
              {progress && progress.totalParts > 1 && (
                <>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all duration-300 ease-out"
                      style={{
                        width: `${Math.max(5, (progress.currentPart / progress.totalParts) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground text-center">
                    Part {progress.currentPart} of {progress.totalParts}
                  </div>
                </>
              )}
            </div>
          )}

          {status === "processing" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {progress?.message || "Processing document... This may take a moment."}
              </div>
              {progress && progress.totalParts > 1 && (
                <div className="w-full bg-primary rounded-full h-2" />
              )}
            </div>
          )}

          {status === "complete" && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              {progress?.totalParts && progress.totalParts > 1
                ? `Upload complete! (${progress.totalParts} parts)`
                : "Upload complete!"}
            </div>
          )}

          {status === "error" && (
            <div className="text-sm text-destructive">{errorMessage}</div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!file || isProcessing || status === "complete" || !fileValidation.valid}
          >
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {status === "uploading"
              ? "Uploading..."
              : status === "processing"
              ? "Processing..."
              : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
