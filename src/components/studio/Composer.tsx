"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { postSchema, extensionForType, isAllowedMediaType, mediaKind } from "@/lib/validation";
import { parseMoneyToCents } from "@/lib/money";
import {
  ALLOWED_MEDIA_TYPES,
  MAX_IMAGE_BYTES,
  MAX_MEDIA_BYTES,
  MAX_MEDIA_PER_POST,
} from "@/lib/constants";

const field =
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/40";

export default function Composer({
  creatorId,
  creatorIsNsfw,
  onPublished,
}: {
  creatorId: string;
  creatorIsNsfw: boolean;
  onPublished: () => void;
}) {
  const [body, setBody] = useState("");
  const [teaser, setTeaser] = useState("");
  const [visibility, setVisibility] = useState<"free" | "subscribers" | "ppv">("subscribers");
  const [price, setPrice] = useState("100");
  const [nsfw, setNsfw] = useState(creatorIsNsfw);
  const [publishAt, setPublishAt] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!isAllowedMediaType(f.type)) {
        setError(`«${f.name}»: formato no permitido`);
        continue;
      }
      const limit = mediaKind(f.type) === "video" ? MAX_MEDIA_BYTES : MAX_IMAGE_BYTES;
      if (f.size > limit) {
        setError(`«${f.name}»: supera el tamaño máximo (${Math.round(limit / 1024 / 1024)} MB)`);
        continue;
      }
      if (next.length >= MAX_MEDIA_PER_POST) {
        setError(`Máximo ${MAX_MEDIA_PER_POST} archivos por publicación`);
        break;
      }
      next.push(f);
    }
    setFiles(next);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);

    const priceCents = visibility === "ppv" ? parseMoneyToCents(price) : null;
    let publishIso: string | null = null;
    if (publishAt) {
      const d = new Date(publishAt);
      if (Number.isNaN(d.getTime()) || d.getTime() < Date.now() - 60_000) {
        setError("La fecha de programación debe estar en el futuro");
        return;
      }
      publishIso = d.toISOString();
    }

    const parsed = postSchema.safeParse({
      body,
      teaser: teaser || null,
      visibility,
      priceCents,
      isNsfw: nsfw,
      publishAt: publishIso,
      mediaCount: files.length,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }

    const supabase = createClient();
    const postId = crypto.randomUUID();
    const uploaded: Array<{ path: string; kind: "image" | "video" }> = [];

    const rollback = async () => {
      if (uploaded.length) await supabase.storage.from("media").remove(uploaded.map((u) => u.path));
    };

    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setBusy(`Subiendo archivo ${i + 1} de ${files.length}…`);
        const path = `${creatorId}/${postId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extensionForType(f.type)}`;
        const { error: upErr } = await supabase.storage.from("media").upload(path, f, {
          contentType: f.type,
          cacheControl: "3600",
          upsert: false,
        });
        if (upErr) throw new Error("No se pudo subir un archivo. Revisa tu conexión e intenta de nuevo.");
        uploaded.push({ path, kind: mediaKind(f.type) });
      }

      setBusy("Publicando…");
      const { error: postErr } = await supabase.from("posts").insert({
        id: postId,
        creator_id: creatorId,
        body: parsed.data.body,
        teaser: parsed.data.teaser || null,
        visibility: parsed.data.visibility,
        price_cents: parsed.data.visibility === "ppv" ? parsed.data.priceCents : null,
        is_nsfw: parsed.data.isNsfw,
        published_at: parsed.data.publishAt || new Date().toISOString(),
      });
      if (postErr) throw new Error(postErr.message.includes("programar") ? postErr.message : "No se pudo publicar");

      if (uploaded.length > 0) {
        const { error: mediaErr } = await supabase.from("post_media").insert(
          uploaded.map((u, position) => ({
            post_id: postId,
            creator_id: creatorId,
            path: u.path,
            kind: u.kind,
            position,
          }))
        );
        if (mediaErr) {
          await supabase.from("posts").delete().eq("id", postId);
          throw new Error("No se pudieron adjuntar los archivos");
        }
      }

      setBody("");
      setTeaser("");
      setFiles([]);
      setPublishAt("");
      setOk(true);
      onPublished();
    } catch (err) {
      await rollback();
      setError(err instanceof Error ? err.message : "Error al publicar");
    } finally {
      setBusy(null);
    }
  }

  return (
    <form onSubmit={publish} className="space-y-4" noValidate>
      <div>
        <label htmlFor="body" className="mb-1.5 block text-sm font-medium">Texto</label>
        <textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={5000}
          rows={5}
          placeholder="¿Qué quieres compartir?"
          className={field}
        />
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium">Archivos ({files.length}/{MAX_MEDIA_PER_POST})</p>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={ALLOWED_MEDIA_TYPES.join(",")}
          aria-label="Adjuntar archivos"
          onChange={(e) => addFiles(e.target.files)}
          className="block w-full text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-accent-soft file:px-4 file:py-2 file:text-sm file:text-accent"
        />
        {files.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded-lg bg-card px-3 py-1.5">
                <span className="truncate">{f.name}</span>
                <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="ml-3 text-muted hover:text-red-300">
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">¿Quién puede verlo?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {([
            ["free", "Todos", "Gratis, visible para cualquiera"],
            ["subscribers", "Suscriptores", "Solo quien esté suscrito"],
            ["ppv", "De pago", "Se desbloquea comprándolo"],
          ] as const).map(([v, t, d]) => (
            <label
              key={v}
              className={`cursor-pointer rounded-2xl border p-3 text-sm ${visibility === v ? "border-accent bg-accent-soft" : "border-border bg-card"}`}
            >
              <input type="radio" name="visibility" value={v} checked={visibility === v} onChange={() => setVisibility(v)} className="sr-only" />
              <span className="block font-medium">{t}</span>
              <span className="text-xs text-muted">{d}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {visibility === "ppv" && (
        <div>
          <label htmlFor="price" className="mb-1.5 block text-sm font-medium">Precio (MXN, entre 10 y 5,000)</label>
          <input id="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className={`${field} h-11 py-0`} />
        </div>
      )}

      {visibility !== "free" && (
        <div>
          <label htmlFor="teaser" className="mb-1.5 block text-sm font-medium">Vista previa pública (opcional)</label>
          <input
            id="teaser"
            value={teaser}
            onChange={(e) => setTeaser(e.target.value)}
            maxLength={200}
            placeholder="Una frase que verá todo el mundo, incluso sin acceso"
            className={`${field} h-11 py-0`}
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="publishAt" className="mb-1.5 block text-sm font-medium">Programar (opcional)</label>
          <input id="publishAt" type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} className={`${field} h-11 py-0`} />
        </div>
        <label className="flex items-center gap-3 self-end rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <input
            type="checkbox"
            checked={nsfw || creatorIsNsfw}
            disabled={creatorIsNsfw}
            onChange={(e) => setNsfw(e.target.checked)}
            className="h-4 w-4"
          />
          <span>Contenido para adultos (+18){creatorIsNsfw ? " · siempre activo en tu cuenta" : ""}</span>
        </label>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}
      {ok && (
        <p role="status" className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          ¡Publicado!
        </p>
      )}
      <button
        type="submit"
        disabled={!!busy}
        className="h-11 rounded-full bg-accent px-8 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60"
      >
        {busy ?? (publishAt ? "Programar publicación" : "Publicar")}
      </button>
    </form>
  );
}
