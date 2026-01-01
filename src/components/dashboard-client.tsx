"use client";

import { useEffect, useState } from "react";
import { StoresTable } from "@/components/stores-table";
import { CreateStoreDialog } from "@/components/create-store-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plus, RefreshCw, Database, ExternalLink } from "lucide-react";
import { UserNav } from "@/components/user-nav";

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

export function DashboardClient() {
  const [stores, setStores] = useState<FileSearchStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { toast } = useToast();

  const fetchStores = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/stores");
      if (!response.ok) {
        throw new Error("Failed to fetch stores");
      }
      const data = await response.json();
      setStores(data.fileSearchStores || []);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load stores",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const handleStoreCreated = () => {
    setCreateDialogOpen(false);
    fetchStores();
    toast({
      title: "Success",
      description: "Store created successfully",
    });
  };

  const handleStoreDeleted = () => {
    fetchStores();
    toast({
      title: "Success",
      description: "Store deleted successfully",
    });
  };

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Quick Links Bar */}
      <div className="flex items-center justify-end gap-4 mb-4 text-sm">
        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          API Keys
        </a>
        <a
          href="https://ai.google.dev/gemini-api/docs/file-search"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Documentation
        </a>
        <a
          href="https://aistudio.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Google AI Studio
        </a>
        <div className="border-l pl-4 ml-2">
          <UserNav />
        </div>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Database className="h-8 w-8" />
          <div>
            <h1 className="text-3xl font-bold">File Search Stores</h1>
            <p className="text-muted-foreground">
              Manage your Google File Search API stores and documents
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchStores} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Store
          </Button>
        </div>
      </div>

      <StoresTable
        stores={stores}
        loading={loading}
        onStoreDeleted={handleStoreDeleted}
      />

      <CreateStoreDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onStoreCreated={handleStoreCreated}
      />
    </div>
  );
}
