import { NextRequest, NextResponse } from "next/server";
import { getStore, deleteStore } from "@/lib/api";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const store = await getStore(id);
    return NextResponse.json(store);
  } catch (error) {
    console.error("Error getting store:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get store" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const searchParams = request.nextUrl.searchParams;
    const force = searchParams.get("force") === "true";

    await deleteStore(id, force);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting store:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete store" },
      { status: 500 }
    );
  }
}
