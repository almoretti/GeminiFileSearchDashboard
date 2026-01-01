import { NextRequest, NextResponse } from "next/server";
import { listDocuments } from "@/lib/api";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const searchParams = request.nextUrl.searchParams;
    const pageSize = searchParams.get("pageSize");
    const pageToken = searchParams.get("pageToken");

    const data = await listDocuments(
      id,
      pageSize ? parseInt(pageSize) : undefined,
      pageToken || undefined
    );

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error listing documents:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list documents" },
      { status: 500 }
    );
  }
}
