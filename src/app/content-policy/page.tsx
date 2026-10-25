import type { Metadata } from "next";
import LegalShell, { CONTACT_EMAIL } from "@/components/LegalShell";

export const metadata: Metadata = { title: "Política de contenido" };

export default function ContentPolicyPage() {
  return (
    <LegalShell title="Política de contenido" updated="octubre de 2026">
      <h2>Lo que nunca permitimos</h2>
      <ul>
        <li>Cualquier contenido sexual o de desnudez que involucre a menores, o que parezca involucrarlos. Se reporta a las autoridades.</li>
        <li>Contenido grabado o compartido sin el consentimiento de quienes aparecen, incluida la distribución de imágenes íntimas.</li>
        <li>Violencia real, explotación, trata, chantaje, amenazas o acoso.</li>
        <li>Contenido ilegal en tu jurisdicción o en la del público al que va dirigido.</li>
        <li>Suplantación de identidad y publicación de datos personales de terceros.</li>
        <li>Spam, estafas y la venta de bienes o servicios prohibidos.</li>
      </ul>

      <h2>Contenido para adultos</h2>
      <p>
        Se permite contenido legal para adultos únicamente de creadores verificados, marcado como +18, y visible solo para
        cuentas que confirmaron su mayoría de edad. Todas las personas que aparecen deben ser mayores de 18 años, haber dado su
        consentimiento y poder acreditarlo cuando se les pida.
      </p>

      <h2>Cómo reportar</h2>
      <p>
        Usa el botón «Reportar» en publicaciones, perfiles, comentarios y mensajes. Los reportes de menores, contenido no
        consentido o ilegal son prioritarios: la publicación se oculta de inmediato mientras se revisa.
      </p>

      <h2>Retiro de contenido (derechos de autor y privacidad)</h2>
      <p>
        Si eres titular de derechos o aparece tu imagen sin tu permiso, escribe a{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> con el enlace al contenido y una descripción. Retiramos el
        contenido infractor y podemos suspender a quien reincida.
      </p>

      <h2>Consecuencias</h2>
      <p>Ocultar contenido, suspender o cerrar la cuenta, retener pagos relacionados y avisar a las autoridades cuando corresponda.</p>
    </LegalShell>
  );
}
