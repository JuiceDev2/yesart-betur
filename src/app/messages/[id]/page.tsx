import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Avatar from "@/components/Avatar";
import Thread from "@/components/Thread";
import ReportButton from "@/components/ReportButton";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

export const metadata: Metadata = { title: "Conversación", robots: { index: false } };

interface Counterpart {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_creator: boolean;
  can_message: boolean;
}

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireAuth();
  if (!isUuid(id) || id === me.id) notFound();

  const supabase = await createClient();
  const { data } = await supabase.rpc("counterpart", { p_other: id });
  const other = ((data as Counterpart[] | null) ?? [])[0];
  if (!other) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-4 flex items-center gap-3">
          <Link href="/messages" className="text-sm text-muted hover:text-foreground" aria-label="Volver a mensajes">
            ←
          </Link>
          <Avatar url={other.avatar_url} name={other.display_name || other.username} size={40} />
          <div className="min-w-0 flex-1">
            {other.is_creator ? (
              <Link href={`/c/${other.username}`} className="block truncate font-medium hover:text-accent">
                {other.display_name || other.username}
              </Link>
            ) : (
              <p className="truncate font-medium">{other.display_name || other.username}</p>
            )}
            <p className="text-xs text-muted">@{other.username}</p>
          </div>
          {other.is_creator && (
            <ReportButton targetType="creator" targetId={other.id} viewerId={me.id} label="Reportar" />
          )}
        </div>
        <Thread meId={me.id} otherId={other.id} canReply={other.can_message} />
      </main>
      <SiteFooter />
    </div>
  );
}
