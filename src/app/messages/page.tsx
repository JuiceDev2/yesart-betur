import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Avatar from "@/components/Avatar";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/utils";
import type { ConversationRow } from "@/types";

export const metadata: Metadata = { title: "Mensajes", robots: { index: false } };

export default async function MessagesPage() {
  await requireAuth();
  const supabase = await createClient();
  const { data } = await supabase.rpc("conversations");
  const rows = (data as ConversationRow[] | null) ?? [];

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="font-serif text-3xl font-medium">Mensajes</h1>
        <p className="mt-1 mb-6 text-sm text-muted">
          Puedes escribirle a los creadores a los que estás suscrito. Los creadores escriben a sus suscriptores.
        </p>
        {rows.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-border py-16 text-center text-sm text-muted">
            Aún no tienes conversaciones.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-3xl border border-border bg-card">
            {rows.map((c) => (
              <li key={c.other_id}>
                <Link href={`/messages/${c.other_id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5">
                  <Avatar url={c.avatar_url} name={c.display_name || c.username} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.display_name || c.username}</p>
                    <p className="truncate text-xs text-muted">
                      {c.last_from_me ? "Tú: " : ""}
                      {c.last_body}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-muted">{timeAgo(c.last_at)}</p>
                    {c.unread > 0 && (
                      <span className="mt-1 inline-flex min-w-5 justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-ink">
                        {c.unread}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
