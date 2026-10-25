import Link from "next/link";
import InstallButton from "@/components/pwa/InstallButton";

export default function SiteFooter() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>© {new Date().getFullYear()} Aura · Solo para mayores de 18 años</p>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/terms" className="hover:text-foreground">Términos</Link>
          <Link href="/privacy" className="hover:text-foreground">Privacidad</Link>
          <Link href="/content-policy" className="hover:text-foreground">Política de contenido</Link>
          <InstallButton className="text-accent hover:underline" />
          {email && (
            <a href={`mailto:${email}`} className="hover:text-foreground">
              {email}
            </a>
          )}
        </nav>
      </div>
    </footer>
  );
}
