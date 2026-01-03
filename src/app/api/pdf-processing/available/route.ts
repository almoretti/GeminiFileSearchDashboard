import { NextResponse } from "next/server";
import { isGhostscriptAvailable } from "@/lib/pdf-processor";

// Force dynamic - must check at runtime, not build time
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const available = await isGhostscriptAvailable();
    return NextResponse.json({ available });
  } catch (error) {
    console.error("Error checking Ghostscript availability:", error);
    return NextResponse.json({ available: false });
  }
}
