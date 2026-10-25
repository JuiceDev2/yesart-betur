import type { Metadata } from "next";
import LegalShell, { CONTACT_EMAIL } from "@/components/LegalShell";

export const metadata: Metadata = { title: "Términos de uso" };

export default function TermsPage() {
  return (
    <LegalShell title="Términos de uso" updated="octubre de 2026">
      <p>
        Aura es una plataforma donde creadores verificados publican contenido y sus seguidores pueden suscribirse,
        comprar publicaciones individuales y enviar propinas. Al crear una cuenta aceptas estos términos, la{" "}
        <a href="/content-policy">política de contenido</a> y el <a href="/privacy">aviso de privacidad</a>.
      </p>

      <h2>1. Edad y cuenta</h2>
      <ul>
        <li>Debes tener 18 años o más para usar Aura. Podemos pedirte que lo acredites.</li>
        <li>Eres responsable de tu contraseña y de lo que ocurra en tu cuenta.</li>
        <li>Podemos suspender o cerrar cuentas que incumplan estos términos o la ley.</li>
      </ul>

      <h2>2. Creadores</h2>
      <ul>
        <li>Para publicar debes ser aprobado tras verificar tu identidad y tu edad.</li>
        <li>Conservas los derechos de tu contenido y nos otorgas una licencia limitada para alojarlo y mostrarlo dentro de la plataforma.</li>
        <li>Declaras tener los derechos sobre todo lo que publicas y que toda persona que aparece es mayor de 18 años y dio su consentimiento.</li>
        <li>Eres responsable de tus obligaciones fiscales sobre tus ingresos.</li>
      </ul>

      <h2>3. Pagos</h2>
      <ul>
        <li>Las suscripciones se renuevan cada mes hasta que las canceles; conservas el acceso hasta el fin del periodo pagado.</li>
        <li>Las compras de publicaciones y las propinas son definitivas, salvo lo que exija la ley o decidamos reembolsar.</li>
        <li>La plataforma retiene una comisión sobre cada cobro. El porcentaje vigente se muestra en tu estudio.</li>
        <li>Los retiros de los creadores se revisan y se pagan manualmente una vez cumplido el periodo de retención y el mínimo.</li>
        <li>Un contracargo o reembolso reduce el saldo del creador por el mismo importe.</li>
      </ul>

      <h2>4. Conducta</h2>
      <ul>
        <li>Prohibido el contenido ilegal, el que involucre a menores, el no consentido, el acoso y la suplantación de identidad.</li>
        <li>Prohibido copiar, redistribuir o publicar fuera de Aura el contenido de pago de otros usuarios.</li>
        <li>Podemos ocultar contenido y suspender cuentas mientras se revisa un reporte.</li>
      </ul>

      <h2>5. Responsabilidad</h2>
      <p>
        Aura es una plataforma de alojamiento y cobro; no es parte de la relación entre creador y suscriptor y no garantiza el
        contenido. En la medida permitida por la ley, nuestra responsabilidad se limita a lo que hayas pagado en los últimos 12 meses.
      </p>

      <h2>6. Contacto</h2>
      <p>
        Dudas, reclamos o avisos legales: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalShell>
  );
}
