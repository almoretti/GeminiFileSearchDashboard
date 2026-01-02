"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, Plus, Trash2, X, Search } from "lucide-react";

interface FilterCondition {
  id: string;
  key: string;
  operator: string;
  value: string;
  conjunction: "AND" | "OR";
}

interface CustomMetadata {
  key: string;
  stringValue?: string;
  numericValue?: number;
}

interface Document {
  customMetadata?: CustomMetadata[];
}

interface MetadataFilterProps {
  documents: Document[];
  onFilterChange: (filter: string) => void;
  currentFilter: string;
}

const OPERATORS = [
  { value: "=", label: "equals" },
  { value: "!=", label: "not equals" },
  { value: ">", label: "greater than" },
  { value: ">=", label: "greater or equal" },
  { value: "<", label: "less than" },
  { value: "<=", label: "less or equal" },
];

export function MetadataFilter({
  documents,
  onFilterChange,
  currentFilter,
}: MetadataFilterProps) {
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  // Extract unique metadata keys from documents
  const availableKeys = useMemo(() => {
    const keys = new Set<string>();
    documents.forEach((doc) => {
      doc.customMetadata?.forEach((meta) => {
        keys.add(meta.key);
      });
    });
    return Array.from(keys).sort();
  }, [documents]);

  const addCondition = () => {
    setConditions([
      ...conditions,
      {
        id: crypto.randomUUID(),
        key: "",
        operator: "=",
        value: "",
        conjunction: "AND",
      },
    ]);
    setIsExpanded(true);
  };

  const updateCondition = (
    id: string,
    field: keyof FilterCondition,
    value: string
  ) => {
    setConditions(
      conditions.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const removeCondition = (id: string) => {
    setConditions(conditions.filter((c) => c.id !== id));
  };

  const generateFilterString = (): string => {
    const validConditions = conditions.filter(
      (c) => c.key.trim() && c.value.trim()
    );
    if (validConditions.length === 0) return "";

    return validConditions
      .map((c, index) => {
        // Determine if value is numeric
        const isNumeric = !isNaN(Number(c.value)) && c.value.trim() !== "";
        const formattedValue = isNumeric ? c.value : `'${c.value}'`;
        const condition = `${c.key}${c.operator}${formattedValue}`;

        if (index === 0) return condition;
        return `${c.conjunction} ${condition}`;
      })
      .join(" ");
  };

  const applyFilter = () => {
    const filter = generateFilterString();
    onFilterChange(filter);
  };

  const clearFilter = () => {
    setConditions([]);
    onFilterChange("");
    setIsExpanded(false);
  };

  const previewFilter = generateFilterString();
  const hasActiveFilter = currentFilter !== "";

  return (
    <div className="space-y-3">
      {/* Header with filter button */}
      <div className="flex items-center gap-2">
        <Button
          variant={hasActiveFilter ? "default" : "outline"}
          size="sm"
          onClick={() => {
            if (conditions.length === 0) {
              addCondition();
            } else {
              setIsExpanded(!isExpanded);
            }
          }}
        >
          <Filter className="h-4 w-4 mr-2" />
          {hasActiveFilter ? "Filter Active" : "Filter by Metadata"}
        </Button>

        {hasActiveFilter && (
          <Badge variant="secondary" className="gap-1">
            <code className="text-xs">{currentFilter}</code>
            <button
              onClick={clearFilter}
              className="ml-1 hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}
      </div>

      {/* Filter builder */}
      {isExpanded && (
        <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
          <div className="space-y-3">
            {conditions.map((condition, index) => (
              <div key={condition.id} className="flex items-center gap-2">
                {/* Conjunction (AND/OR) for subsequent conditions */}
                {index > 0 && (
                  <Select
                    value={condition.conjunction}
                    onValueChange={(value) =>
                      updateCondition(condition.id, "conjunction", value)
                    }
                  >
                    <SelectTrigger className="w-20 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AND">AND</SelectItem>
                      <SelectItem value="OR">OR</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {/* Key input with datalist for suggestions */}
                <div className="flex-1 min-w-[120px]">
                  <Input
                    placeholder="Key"
                    value={condition.key}
                    onChange={(e) =>
                      updateCondition(condition.id, "key", e.target.value)
                    }
                    list={`keys-${condition.id}`}
                    className="h-8"
                  />
                  <datalist id={`keys-${condition.id}`}>
                    {availableKeys.map((key) => (
                      <option key={key} value={key} />
                    ))}
                  </datalist>
                </div>

                {/* Operator select */}
                <Select
                  value={condition.operator}
                  onValueChange={(value) =>
                    updateCondition(condition.id, "operator", value)
                  }
                >
                  <SelectTrigger className="w-24 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Value input */}
                <div className="flex-1 min-w-[120px]">
                  <Input
                    placeholder="Value"
                    value={condition.value}
                    onChange={(e) =>
                      updateCondition(condition.id, "value", e.target.value)
                    }
                    className="h-8"
                  />
                </div>

                {/* Remove button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => removeCondition(condition.id)}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>

          {/* Add condition button */}
          <Button
            variant="outline"
            size="sm"
            onClick={addCondition}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Condition
          </Button>

          {/* Filter preview */}
          {previewFilter && (
            <div className="pt-2 border-t">
              <Label className="text-xs text-muted-foreground">
                Filter Query (AIP-160)
              </Label>
              <code className="block mt-1 text-xs bg-muted p-2 rounded font-mono break-all">
                {previewFilter}
              </code>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <Button onClick={applyFilter} size="sm" className="flex-1">
              <Search className="h-4 w-4 mr-2" />
              Apply Filter
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilter}
            >
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
