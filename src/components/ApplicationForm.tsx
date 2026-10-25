"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { applicationSchema, extensionForType } from "@/lib/validation";
import { ALLOWED_KYC_TYPES, MAX_KYC_BYTES } from "@/lib/constants";

const input =
  "h-11 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-accent/40";

function validateFile(f: File | null, label: string): string | null {
  if (!f) return `Adjunta ${label}`;
  if (!(ALLOWED_KYC_TYPES as readonly string[]).includes(f.type)) return `${label}: formato no permitido (JPG, PNG, WebP o PDF)`;
  if (f.size > MAX_KYC_BYTES) return `${label}: máximo 8 MB`;
  return null;
}

export default function ApplicationForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [legalName, setLegalName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [country, setCountry] = useState("MX");
  const [message, setMessage] = useState("");
  const [idDoc, setIdDoc] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [rights, setRights] = useState(false);
  const [adults, setAdults] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = applicationSchema.safeParse({
      legalName, birthDate, country, message: message || null,
      confirmsRights: rights ? true : undefined,
      confirmsAdults: adults ? true : undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    const fileError = validateFile(idDoc, "tu identificación oficial") ?? validateFile(selfie, "tu selfie con la identificación");
    if (fileError) {
      setError(fileError);
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const idPath = `${userId}/id-${stamp}.${extensionForType(idDoc!.type)}`;
    const selfiePath = `${userId}/selfie-${stamp}.${extensionForType(selfie!.type)}`;

    const up1 = await supabase.storage.from("kyc").upload(idPath, idDoc!, { contentType: idDoc!.type });
    const up2 = up1.error ? up1 : await supabase.storage.from("kyc").upload(selfiePath, selfie!, { contentType: selfie!.type });
    if (up1.error || up2.error) {
      await supabase.storage.from("kyc").remove([idPath, selfiePath]);
      setError("No se pudieron subir los documentos. Intenta de nuevo.");
      setBusy(false);
      return;
    }

    const { error: insErr } = await supabase.from("creator_applications").insert({
      user_id: userId,
      legal_name: parsed.data.legalName,
      birth_date: parsed.data.birthDate,
      country: parsed.data.country,
      id_doc_path: idPath,
      selfie_path: selfiePath,
      message: parsed.data.message || null,
      confirms_rights: true,
      confirms_adults: true,
    });
    if (insErr) {
      await supabase.storage.from("kyc").remove([idPath, selfiePath]);
      setError(
        insErr.message.includes("18 años")
          ? "Debes tener al menos 18 años para ser creador."
          : insErr.code === "23505"
            ? "Ya tienes una solicitud pendiente."
            : insErr.message.includes("mayor de edad")
              ? "Primero confirma tu mayoría de edad en Ajustes."
              : "No se pudo enviar la solicitud."
      );
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="legalName" className="mb-1.5 block text-sm font-medium">Nombre legal completo</label>
        <input id="legalName" value={legalName} onChange={(e) => setLegalName(e.target.value)} autoComplete="name" className={input} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="birthDate" className="mb-1.5 block text-sm font-medium">Fecha de nacimiento</label>
          <input id="birthDate" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} autoComplete="bday" className={input} />
        </div>
        <div>
          <label htmlFor="country" className="mb-1.5 block text-sm font-medium">País (código de 2 letras)</label>
          <input id="country" value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} maxLength={2} className={input} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="idDoc" className="mb-1.5 block text-sm font-medium">Identificación oficial (frente)</label>
          <input id="idDoc" type="file" accept={ALLOWED_KYC_TYPES.join(",")} onChange={(e) => setIdDoc(e.target.files?.[0] ?? null)} className="block w-full text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-accent-soft file:px-4 file:py-2 file:text-sm file:text-accent" />
        </div>
        <div>
          <label htmlFor="selfie" className="mb-1.5 block text-sm font-medium">Selfie sosteniendo tu identificación</label>
          <input id="selfie" type="file" accept={ALLOWED_KYC_TYPES.join(",")} onChange={(e) => setSelfie(e.target.files?.[0] ?? null)} className="block w-full text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-accent-soft file:px-4 file:py-2 file:text-sm file:text-accent" />
        </div>
      </div>
      <p className="text-xs text-muted">
        Solo un administrador puede ver estos documentos y se eliminan 30 días después de resolver tu solicitud.
      </p>
      <div>
        <label htmlFor="message" className="mb-1.5 block text-sm font-medium">Cuéntanos qué contenido vas a publicar (opcional)</label>
        <textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} rows={3} className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/40" />
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-1 h-4 w-4" />
        <span>Soy el autor o tengo todos los derechos del contenido que publicaré.</span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={adults} onChange={(e) => setAdults(e.target.checked)} className="mt-1 h-4 w-4" />
        <span>Todas las personas que aparezcan son mayores de 18 años y dieron su consentimiento expreso para aparecer y para su publicación.</span>
      </label>

      {error && (
        <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="h-11 rounded-full bg-accent px-8 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60"
      >
        {busy ? "Enviando…" : "Enviar solicitud"}
      </button>
    </form>
  );
}
