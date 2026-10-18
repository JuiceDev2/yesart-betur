import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aviso de privacidad",
  description: "Cómo Yesart-betur trata tus datos personales",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-6">
          <Link href="/" className="font-serif text-xl font-semibold">
            Yesart<span className="text-accent">-betur</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12 prose-sm">
        <h1 className="font-serif text-3xl font-medium">Aviso de privacidad</h1>
        <p className="mt-4 text-sm text-muted">Última actualización: octubre 2026</p>

        <section className="mt-10 space-y-4 text-sm leading-relaxed text-muted">
          <p>
            Yesart-betur (&ldquo;nosotros&rdquo;) opera una plataforma que conecta artistas y
            personas interesadas en obras o murales. No procesamos pagos en línea.
          </p>

          <h2 className="pt-4 font-medium text-foreground">Datos que tratamos</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground">Cuenta:</strong> email, nombre, rol
              (cliente/artista/admin).
            </li>
            <li>
              <strong className="text-foreground">Solicitudes de compra:</strong> nombre
              completo y teléfono que indiques en el formulario, y notas opcionales.
              Se asocian a la obra o servicio y al artista correspondiente.
            </li>
            <li>
              <strong className="text-foreground">Seguridad técnica:</strong> dirección IP
              (solo para limitar abusos de solicitudes, no se muestra a otros usuarios).
            </li>
            <li>
              <strong className="text-foreground">Contenido de artistas:</strong> obras,
              servicios e imágenes que suben.
            </li>
          </ul>

          <h2 className="pt-4 font-medium text-foreground">Finalidad</h2>
          <p>
            Contactar sobre solicitudes de compra o contratación; operar la cuenta;
            moderar la plataforma; prevenir abuso (límites por teléfono, usuario e IP).
          </p>

          <h2 className="pt-4 font-medium text-foreground">Conservación</h2>
          <p>
            Las solicitudes se conservan mientras sean necesarias para el trato
            artista–cliente y la operación del servicio. Los registros de límites de
            frecuencia se depuran periódicamente (aprox. 48 h). Puedes solicitar la
            eliminación de tu cuenta en{" "}
            <Link href="/account/delete" className="text-accent underline">
              /account/delete
            </Link>
            .
          </p>

          <h2 className="pt-4 font-medium text-foreground">Encargados</h2>
          <p>
            Infraestructura: Vercel (hosting) y Supabase (base de datos, autenticación y
            almacenamiento). Correo transaccional opcional vía Resend si está configurado.
          </p>

          <h2 className="pt-4 font-medium text-foreground">Contacto</h2>
          <p>
            Para ejercer derechos de acceso, rectificación o eliminación, contacta al
            operador del sitio a través del correo publicado en el dominio de producción.
          </p>
        </section>

        <p className="mt-12">
          <Link href="/terms" className="text-sm text-accent underline">
            Términos de uso
          </Link>
        </p>
      </main>
    </div>
  );
}
