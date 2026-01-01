import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: string | number | undefined): string {
  if (!bytes) return "0 B";
  const numBytes = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
  if (isNaN(numBytes)) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let unitIndex = 0;
  let size = numBytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export function formatDate(dateString: string | undefined): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function extractStoreId(name: string): string {
  // Extract ID from "fileSearchStores/store-id"
  return name.replace("fileSearchStores/", "");
}

export function extractDocumentId(name: string): string {
  // Extract document ID from "fileSearchStores/store-id/documents/doc-id"
  const parts = name.split("/");
  return parts[parts.length - 1];
}
