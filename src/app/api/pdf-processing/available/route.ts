import { NextResponse } from "next/server";
import { isGhostscriptAvailable } from "@/lib/pdf-processor";

export async function GET() {
  try {
    const available = await isGhostscriptAvailable();
    return NextResponse.json({ available });
  } catch (error) {
    console.error("Error checking Ghostscript availability:", error);
    return NextResponse.json({ available: false });
  }
}
