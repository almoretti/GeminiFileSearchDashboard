"use client";

import { useState, useRef } from "react";
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
import { Loader2, Upload, FileUp, X, CheckCircle, Plus, Trash2, SplitSquareHorizontal, FileBox, Settings2, ChevronDown, ChevronUp } from "lucide-react";
import { Switch } from "@/components/ui/switch";

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
  const [useSplitUpload, setUseSplitUpload] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [useCustomChunking, setUseCustomChunking] = useState(false);
  const [maxTokensPerChunk, setMaxTokensPerChunk] = useState(200);
  const [maxOverlapTokens, setMaxOverlapTokens] = useState(20);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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

      console.log(`[Client] Starting upload for file: ${file.name}, size: ${(file.size / 1024).toFixed(2)}KB, splitMode: ${useSplitUpload}, customChunking: ${useCustomChunking}`);

      if (useSplitUpload) {
        // Use streaming endpoint for progress updates (split upload)
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
                case "splitting":
                  setProgress({
                    currentPart: 0,
                    totalParts: data.totalParts,
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
    setUseSplitUpload(true);
    setShowAdvanced(false);
    setUseCustomChunking(false);
    setMaxTokensPerChunk(200);
    setMaxOverlapTokens(20);
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

          {/* Upload Method Toggle */}
          <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              {useSplitUpload ? (
                <SplitSquareHorizontal className="h-4 w-4 text-muted-foreground" />
              ) : (
                <FileBox className="h-4 w-4 text-muted-foreground" />
              )}
              <div>
                <Label htmlFor="split-mode" className="text-sm font-medium cursor-pointer">
                  {useSplitUpload ? "Split large files" : "Single file upload"}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {useSplitUpload
                    ? "Splits files >200KB into parts (more reliable)"
                    : "Upload as single file (may fail for large files)"}
                </p>
              </div>
            </div>
            <Switch
              id="split-mode"
              checked={useSplitUpload}
              onCheckedChange={setUseSplitUpload}
              disabled={isProcessing}
            />
          </div>

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
          {status === "uploading" && progress && progress.totalParts > 1 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{progress.message}</span>
              </div>
              {/* Progress bar */}
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
            </div>
          )}

          {status === "uploading" && (!progress || progress.totalParts === 1) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading file...
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
            disabled={!file || isProcessing || status === "complete"}
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
