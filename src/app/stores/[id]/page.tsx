import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { StoreDetailClient } from "@/components/store-detail-client";

export default async function StoreDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return <StoreDetailClient id={params.id} />;
}
