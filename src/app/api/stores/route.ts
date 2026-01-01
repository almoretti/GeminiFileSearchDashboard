import { NextRequest, NextResponse } from "next/server";
import { listStores, createStore } from "@/lib/api";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const pageSize = searchParams.get("pageSize");
    const pageToken = searchParams.get("pageToken");

    const data = await listStores(
      pageSize ? parseInt(pageSize) : undefined,
      pageToken || undefined
    );

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error listing stores:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list stores" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { displayName } = body;

    if (!displayName) {
      return NextResponse.json(
        { error: "displayName is required" },
        { status: 400 }
      );
    }

    const store = await createStore(displayName);
    return NextResponse.json(store);
  } catch (error) {
    console.error("Error creating store:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create store" },
      { status: 500 }
    );
  }
}
