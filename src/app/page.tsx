import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/dashboard-client";

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return <DashboardClient />;
}
