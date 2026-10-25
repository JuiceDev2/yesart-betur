"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProfileForm from "@/components/ProfileForm";
import { createClient } from "@/lib/supabase/client";
import { creatorSettingsSchema, payoutAccountSchema } from "@/lib/validation";
import { parseMoneyToCents } from "@/lib/money";
import { CATEGORIES } from "@/lib/constants";
import type { CreatorSettings, Profile } from "@/types";

const input =
  "h-11 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-accent/40";

type Msg = { ok: boolean; text: string } | null;

function Note({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>
      {msg.text}
    </p>
  );
}

export default function StudioSettings({ profile, settings }: { profile: Profile; settings: CreatorSettings }) {
  const router = useRouter();
  const [price, setPrice] = useState(String(settings.price_cents / 100));
  const [category, setCategory] = useState(settings.category ?? "");
  const [nsfw, setNsfw] = useState(settings.is_nsfw);
  const [welcome, setWelcome] = useState(settings.welcome_message ?? "");
  const [msg, setMsg] = useState<Msg>(null);
  const [saving, setSaving] = useState(false);

  const [holder, setHolder] = useState("");
  const [ref, setRef] = useState("");
  const [bank, setBank] = useState("");
  const [hasAccount, setHasAccount] = useState(false);
  const [accMsg, setAccMsg] = useState<Msg>(null);
  const [savingAcc, setSavingAcc] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await createClient()
        .from("creator_payout_accounts")
        .select("holder_name, account_ref, bank_name")
        .eq("user_id", profile.id)
        .maybeSingle();
      if (data) {
        setHolder(data.holder_name);
        setRef(data.account_ref);
        setBank(data.bank_name ?? "");
        setHasAccount(true);
      }
    })();
  }, [profile.id]);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const cents = parseMoneyToCents(price);
    const parsed = creatorSettingsSchema.safeParse({
      priceCents: cents ?? -1,
      category: category || null,
      isNsfw: nsfw,
      welcomeMessage: welcome || null,
    });
    if (!parsed.success) {
      setMsg({ ok: false, text: parsed.error.issues[0]?.message ?? "Datos inválidos" });
      return;
    }
    setSaving(true);
    const { error } = await createClient()
      .from("creators")
      .update({
        price_cents: parsed.data.priceCents,
        category: parsed.data.category,
        is_nsfw: parsed.data.isNsfw,
        welcome_message: parsed.data.welcomeMessage || null,
      })
      .eq("user_id", profile.id);
    setSaving(false);
    if (error) {
      setMsg({ ok: false, text: "No se pudieron guardar los ajustes" });
      return;
    }
    setMsg({ ok: true, text: "Ajustes guardados. El nuevo precio aplica a nuevas suscripciones." });
    router.refresh();
  }

  async function saveAccount(e: React.FormEvent) {
    e.preventDefault();
    setAccMsg(null);
    const parsed = payoutAccountSchema.safeParse({ holderName: holder, accountRef: ref, bankName: bank || null });
    if (!parsed.success) {
      setAccMsg({ ok: false, text: parsed.error.issues[0]?.message ?? "Datos inválidos" });
      return;
    }
    setSavingAcc(true);
    const { error } = await createClient()
      .from("creator_payout_accounts")
      .upsert({
        user_id: profile.id,
        holder_name: parsed.data.holderName,
        account_ref: parsed.data.accountRef,
        bank_name: parsed.data.bankName || null,
      });
    setSavingAcc(false);
    if (error) {
      setAccMsg({ ok: false, text: "No se pudo guardar la cuenta" });
      return;
    }
    setHasAccount(true);
    setAccMsg({ ok: true, text: "Cuenta de cobro guardada" });
  }

  return (
    <div className="space-y-10">
      <section aria-labelledby="s-sub">
        <h2 id="s-sub" className="mb-3 font-semibold">Tu suscripción</h2>
        <form onSubmit={saveSettings} className="space-y-4 rounded-3xl border border-border bg-card p-5" noValidate>
          <div>
            <label htmlFor="price" className="mb-1.5 block text-sm font-medium">
              Precio mensual (MXN) — 0 para perfil gratuito, o entre 10 y 5,000
            </label>
            <input id="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className={input} />
          </div>
          <div>
            <label htmlFor="cat" className="mb-1.5 block text-sm font-medium">Categoría</label>
            <select id="cat" value={category} onChange={(e) => setCategory(e.target.value)} className={input}>
              <option value="">Sin categoría</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="welcome" className="mb-1.5 block text-sm font-medium">Mensaje de bienvenida (se envía a quien se suscribe)</label>
            <textarea
              id="welcome"
              value={welcome}
              onChange={(e) => setWelcome(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={nsfw} onChange={(e) => setNsfw(e.target.checked)} className="h-4 w-4" />
            Mi perfil contiene contenido para adultos (+18)
          </label>
          <Note msg={msg} />
          <button disabled={saving} className="h-11 rounded-full bg-accent px-6 text-sm font-semibold text-accent-ink disabled:opacity-60">
            {saving ? "Guardando…" : "Guardar ajustes"}
          </button>
        </form>
      </section>

      <section aria-labelledby="s-pay">
        <h2 id="s-pay" className="mb-3 font-semibold">Cuenta de cobro</h2>
        <form onSubmit={saveAccount} className="space-y-4 rounded-3xl border border-border bg-card p-5" noValidate>
          <p className="text-xs text-muted">
            Los retiros se pagan por transferencia a esta cuenta. Solo tú y el equipo de administración pueden verla.
            {hasAccount ? " Ya tienes una cuenta guardada." : ""}
          </p>
          <div>
            <label htmlFor="holder" className="mb-1.5 block text-sm font-medium">Titular</label>
            <input id="holder" value={holder} onChange={(e) => setHolder(e.target.value)} maxLength={120} className={input} autoComplete="off" />
          </div>
          <div>
            <label htmlFor="ref" className="mb-1.5 block text-sm font-medium">CLABE o IBAN</label>
            <input id="ref" value={ref} onChange={(e) => setRef(e.target.value)} maxLength={34} className={input} autoComplete="off" inputMode="text" />
          </div>
          <div>
            <label htmlFor="bank" className="mb-1.5 block text-sm font-medium">Banco (opcional)</label>
            <input id="bank" value={bank} onChange={(e) => setBank(e.target.value)} maxLength={80} className={input} autoComplete="off" />
          </div>
          <Note msg={accMsg} />
          <button disabled={savingAcc} className="h-11 rounded-full bg-accent px-6 text-sm font-semibold text-accent-ink disabled:opacity-60">
            {savingAcc ? "Guardando…" : "Guardar cuenta"}
          </button>
        </form>
      </section>

      <section aria-labelledby="s-prof">
        <h2 id="s-prof" className="mb-3 font-semibold">Perfil público</h2>
        <ProfileForm profile={profile} />
      </section>
    </div>
  );
}
