"use client";

import { useRouter } from "next/navigation";
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
import { formatBytes, formatDate, extractStoreId } from "@/lib/utils";
import { Trash2, ExternalLink, FolderOpen } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface FileSearchStore {
  name: string;
  displayName?: string;
  createTime?: string;
  updateTime?: string;
  activeDocumentsCount?: string;
  pendingDocumentsCount?: string;
  failedDocumentsCount?: string;
  sizeBytes?: string;
}

interface StoresTableProps {
  stores: FileSearchStore[];
  loading: boolean;
  onStoreDeleted: () => void;
}

export function StoresTable({
  stores,
  loading,
  onStoreDeleted,
}: StoresTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<FileSearchStore | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!storeToDelete) return;

    setDeleting(true);
    try {
      const storeId = extractStoreId(storeToDelete.name);
      const response = await fetch(`/api/stores/${storeId}?force=true`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete store");
      }

      onStoreDeleted();
      setDeleteDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete store",
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
              <TableHead>Documents</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(3)].map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-[200px]" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-[100px]" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-[60px]" />
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

  if (stores.length === 0) {
    return (
      <div className="rounded-md border p-12 text-center">
        <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No stores found</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Create your first file search store to get started.
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
              <TableHead>Documents</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stores.map((store) => {
              const storeId = extractStoreId(store.name);
              const activeCount = parseInt(store.activeDocumentsCount || "0");
              const pendingCount = parseInt(store.pendingDocumentsCount || "0");
              const failedCount = parseInt(store.failedDocumentsCount || "0");

              return (
                <TableRow
                  key={store.name}
                  className="cursor-pointer"
                  onClick={() => router.push(`/stores/${storeId}`)}
                >
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {store.displayName || storeId}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {storeId}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {activeCount > 0 && (
                        <Badge variant="success">{activeCount} active</Badge>
                      )}
                      {pendingCount > 0 && (
                        <Badge variant="warning">{pendingCount} pending</Badge>
                      )}
                      {failedCount > 0 && (
                        <Badge variant="destructive">{failedCount} failed</Badge>
                      )}
                      {activeCount === 0 && pendingCount === 0 && failedCount === 0 && (
                        <Badge variant="secondary">0 docs</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{formatBytes(store.sizeBytes)}</TableCell>
                  <TableCell>{formatDate(store.createTime)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/stores/${storeId}`);
                        }}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStoreToDelete(store);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
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
        title="Delete Store"
        description={`Are you sure you want to delete "${storeToDelete?.displayName || extractStoreId(storeToDelete?.name || "")}"? This will also delete all documents in the store. This action cannot be undone.`}
      />
    </>
  );
}
