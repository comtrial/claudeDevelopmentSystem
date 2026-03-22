import { redirect } from "next/navigation";

export default async function MonitorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/pipelines/${id}`);
}
