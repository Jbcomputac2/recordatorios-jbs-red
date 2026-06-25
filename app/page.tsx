import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RecordatoriosApp from "@/components/RecordatoriosApp";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <RecordatoriosApp userEmail={user.email ?? ""} userId={user.id} />;
}
