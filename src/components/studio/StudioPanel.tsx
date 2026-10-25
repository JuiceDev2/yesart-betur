"use client";

import Link from "next/link";
import { useState } from "react";
import Composer from "./Composer";
import StudioPosts from "./StudioPosts";
import StudioSubscribers from "./StudioSubscribers";
import StudioEarnings from "./StudioEarnings";
import StudioSettings from "./StudioSettings";
import type { CreatorSettings, Profile } from "@/types";

const TABS = [
  ["new", "Publicar"],
  ["posts", "Publicaciones"],
  ["subs", "Suscriptores"],
  ["earn", "Ganancias"],
  ["settings", "Ajustes"],
] as const;
type Tab = (typeof TABS)[number][0];

export default function StudioPanel({
  profile,
  settings,
  currency,
}: {
  profile: Profile;
  settings: CreatorSettings;
  currency: string;
}) {
  const [tab, setTab] = useState<Tab>("new");
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Estudio</h1>
        <Link href={`/c/${profile.username}`} className="text-sm text-accent hover:underline">
          Ver mi perfil público →
        </Link>
      </div>

      <div role="tablist" aria-label="Secciones del estudio" className="mb-6 flex gap-1 overflow-x-auto rounded-full border border-border bg-card p-1">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            onClick={() => setTab(id)}
            className={`h-9 shrink-0 rounded-full px-4 text-sm ${tab === id ? "bg-accent font-semibold text-accent-ink" : "text-muted hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "new" && (
          <Composer
            creatorId={profile.id}
            creatorIsNsfw={settings.is_nsfw}
            onPublished={() => setRefreshKey((k) => k + 1)}
          />
        )}
        {tab === "posts" && <StudioPosts creatorId={profile.id} currency={currency} refreshKey={refreshKey} />}
        {tab === "subs" && <StudioSubscribers currency={currency} />}
        {tab === "earn" && <StudioEarnings />}
        {tab === "settings" && <StudioSettings profile={profile} settings={settings} />}
      </div>
    </div>
  );
}
