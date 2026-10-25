import Link from "next/link";
import Avatar from "@/components/Avatar";
import { formatMoney } from "@/lib/money";
import { categoryLabel } from "@/lib/constants";
import type { PublicCreator } from "@/types";

export default function CreatorCard({ c, currency = "MXN" }: { c: PublicCreator; currency?: string }) {
  return (
    <Link
      href={`/c/${c.username}`}
      className="card-lift group block overflow-hidden rounded-3xl border border-border bg-card"
    >
      <div className="relative h-28 bg-accent-soft">
        {c.banner_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.banner_url} alt="" loading="lazy" className="h-full w-full object-cover" />
        )}
        {c.is_nsfw && (
          <span className="absolute right-3 top-3 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-accent">
            +18
          </span>
        )}
      </div>
      <div className="px-4 pb-4">
        <div className="-mt-8 mb-2">
          <Avatar
            url={c.avatar_url}
            name={c.display_name || c.username}
            size={64}
            className="border-4 border-card"
          />
        </div>
        <p className="truncate font-semibold group-hover:text-accent">{c.display_name || c.username}</p>
        <p className="truncate text-xs text-muted">@{c.username}</p>
        {c.bio && <p className="mt-2 line-clamp-2 text-sm text-muted">{c.bio}</p>}
        <div className="mt-3 flex items-center justify-between text-xs text-muted">
          <span>{categoryLabel(c.category)}</span>
          <span className="font-medium text-foreground">
            {c.price_cents > 0 ? `${formatMoney(c.price_cents, currency)}/mes` : "Gratis"}
          </span>
        </div>
      </div>
    </Link>
  );
}
