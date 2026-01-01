"use client";

import { useState } from "react";
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
import { Loader2 } from "lucide-react";

interface CreateStoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStoreCreated: () => void;
}

export function CreateStoreDialog({
  open,
  onOpenChange,
  onStoreCreated,
}: CreateStoreDialogProps) {
  const [displayName, setDisplayName] = useState("");
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!displayName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a display name",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create store");
      }

      setDisplayName("");
      onStoreCreated();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create store",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Store</DialogTitle>
          <DialogDescription>
            Create a new file search store to organize and search your documents.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              placeholder="My Document Store"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !creating) {
                  handleCreate();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              A human-readable name for your store (max 512 characters)
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={creating}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={creating}>
            {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Store
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
