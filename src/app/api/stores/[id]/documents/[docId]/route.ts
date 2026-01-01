import { NextRequest, NextResponse } from "next/server";
import { getDocument, deleteDocument } from "@/lib/api";
import { auth } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, docId } = params;
    const document = await getDocument(id, docId);
    return NextResponse.json(document);
  } catch (error) {
    console.error("Error getting document:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get document" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  try {
    const { id, docId } = params;
    const searchParams = request.nextUrl.searchParams;
    const force = searchParams.get("force") === "true";

    await deleteDocument(id, docId, force);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete document" },
      { status: 500 }
    );
  }
}
