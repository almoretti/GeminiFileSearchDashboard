"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DocumentsTable } from "@/components/documents-table";
import { UploadDialog } from "@/components/upload-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatBytes, formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  RefreshCw,
  Upload,
  Database,
  FileText,
  Clock,
  HardDrive,
  Copy,
  Check,
} from "lucide-react";
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

interface Document {
  name: string;
  displayName?: string;
  state?: string;
  sizeBytes?: string;
  mimeType?: string;
  createTime?: string;
  updateTime?: string;
  customMetadata?: Array<{
    key: string;
    stringValue?: string;
    numericValue?: number;
  }>;
}

interface StoreDetailClientProps {
  id: string;
}

export function StoreDetailClient({ id }: StoreDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [store, setStore] = useState<FileSearchStore | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingStore, setLoadingStore] = useState(true);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const storeResourceName = store?.name || `fileSearchStores/${id}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(storeResourceName);
      setCopied(true);
      toast({
        title: "Copied",
        description: "Store name copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const fetchStore = async () => {
    try {
      const response = await fetch(`/api/stores/${id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch store");
      }
      const data = await response.json();
      setStore(data);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load store",
        variant: "destructive",
      });
    } finally {
      setLoadingStore(false);
    }
  };

  const fetchDocuments = async () => {
    setLoadingDocuments(true);
    try {
      const response = await fetch(`/api/stores/${id}/documents`);
      if (!response.ok) {
        throw new Error("Failed to fetch documents");
      }
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to load documents",
        variant: "destructive",
      });
    } finally {
      setLoadingDocuments(false);
    }
  };

  useEffect(() => {
    fetchStore();
    fetchDocuments();
  }, [id]);

  const handleRefresh = () => {
    fetchStore();
    fetchDocuments();
  };

  const handleUploadComplete = () => {
    setUploadDialogOpen(false);
    fetchStore();
    fetchDocuments();
  };

  const activeCount = parseInt(store?.activeDocumentsCount || "0");
  const pendingCount = parseInt(store?.pendingDocumentsCount || "0");
  const failedCount = parseInt(store?.failedDocumentsCount || "0");
  const totalDocs = activeCount + pendingCount + failedCount;

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Database className="h-8 w-8" />
            <div>
              <h1 className="text-3xl font-bold">
                {loadingStore ? "Loading..." : store?.displayName || id}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-xs bg-muted px-2 py-1 rounded font-mono text-muted-foreground">
                  {storeResourceName}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={copyToClipboard}
                  title="Copy store name"
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={loadingDocuments}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${loadingDocuments ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button onClick={() => setUploadDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload File
            </Button>
          </div>
          <div className="border-l pl-4">
            <UserNav />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDocs}</div>
            <div className="flex gap-1 mt-1">
              {activeCount > 0 && (
                <Badge variant="success" className="text-xs">
                  {activeCount} active
                </Badge>
              )}
              {pendingCount > 0 && (
                <Badge variant="warning" className="text-xs">
                  {pendingCount} pending
                </Badge>
              )}
              {failedCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {failedCount} failed
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBytes(store?.sizeBytes)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Created</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {formatDate(store?.createTime)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Updated</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {formatDate(store?.updateTime)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Documents Table */}
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-4">Documents</h2>
      </div>

      <DocumentsTable
        storeId={id}
        documents={documents}
        loading={loadingDocuments}
        onDocumentDeleted={handleRefresh}
      />

      {/* Upload Dialog */}
      <UploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        storeId={id}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  );
}
