"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { formatBytes, formatDate, extractDocumentId } from "@/lib/utils";
import { Trash2, FileText } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface CustomMetadata {
  key: string;
  stringValue?: string;
  numericValue?: number;
}

interface Document {
  name: string;
  displayName?: string;
  state?: string;
  sizeBytes?: string;
  mimeType?: string;
  createTime?: string;
  updateTime?: string;
  customMetadata?: CustomMetadata[];
}

interface DocumentsTableProps {
  storeId: string;
  documents: Document[];
  loading: boolean;
  onDocumentDeleted: () => void;
}

function getStateBadge(state?: string) {
  switch (state) {
    case "STATE_ACTIVE":
      return <Badge variant="success">Active</Badge>;
    case "STATE_PENDING":
      return <Badge variant="warning">Processing</Badge>;
    case "STATE_FAILED":
      return <Badge variant="destructive">Failed</Badge>;
    default:
      return <Badge variant="secondary">Unknown</Badge>;
  }
}

export function DocumentsTable({
  storeId,
  documents,
  loading,
  onDocumentDeleted,
}: DocumentsTableProps) {
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<Document | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!docToDelete) return;

    setDeleting(true);
    try {
      const docId = extractDocumentId(docToDelete.name);
      const response = await fetch(
        `/api/stores/${storeId}/documents/${docId}?force=true`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete document");
      }

      onDocumentDeleted();
      setDeleteDialogOpen(false);
      toast({
        title: "Success",
        description: "Document deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete document",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Metadata</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(3)].map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-[200px]" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-[70px]" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-[100px]" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-[60px]" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-[80px]" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-[120px]" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-8 w-8" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-md border p-12 text-center">
        <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No documents found</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Upload your first document to this store.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Metadata</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => {
                const docId = extractDocumentId(doc.name);
                const hasMetadata = doc.customMetadata && doc.customMetadata.length > 0;

                return (
                  <TableRow key={doc.name}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {doc.displayName || docId}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {docId}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{getStateBadge(doc.state)}</TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {doc.mimeType || "Unknown"}
                      </span>
                    </TableCell>
                    <TableCell>{formatBytes(doc.sizeBytes)}</TableCell>
                    <TableCell>
                      {hasMetadata ? (
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {doc.customMetadata!.map((meta, idx) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className="text-xs font-normal"
                            >
                              <span className="font-medium">{meta.key}:</span>
                              <span className="ml-1 truncate max-w-[100px]">
                                {meta.stringValue ?? meta.numericValue}
                              </span>
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(doc.createTime)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDocToDelete(doc);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
      </div>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Document"
        description={`Are you sure you want to delete "${docToDelete?.displayName || extractDocumentId(docToDelete?.name || "")}"? This action cannot be undone.`}
      />
    </>
  );
}
