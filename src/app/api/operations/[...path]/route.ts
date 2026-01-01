import { NextRequest, NextResponse } from "next/server";
import { getOperation } from "@/lib/api";
import { auth } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { path } = params;
    const operationName = path.join("/");
    const operation = await getOperation(operationName);
    console.log(`[Operations] ${operationName} -> RAW:`, JSON.stringify(operation));
    return NextResponse.json(operation);
  } catch (error) {
    console.error("Error getting operation:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get operation" },
      { status: 500 }
    );
  }
}
