import type { Metadata } from "next";
import LegalShell, { CONTACT_EMAIL } from "@/components/LegalShell";

export const metadata: Metadata = { title: "Aviso de privacidad" };

export default function PrivacyPage() {
  return (
    <LegalShell title="Aviso de privacidad" updated="octubre de 2026">
      <p>
        Este aviso explica qué datos trata Aura, para qué y cuáles son tus derechos. Responsable: el operador de la plataforma
        (contacto: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>).
      </p>

      <h2>Datos que tratamos</h2>
      <ul>
        <li><strong>Cuenta:</strong> correo, nombre de usuario, nombre para mostrar, foto, biografía y la confirmación de mayoría de edad.</li>
        <li><strong>Actividad:</strong> suscripciones, compras, propinas, mensajes, comentarios, reportes y bloqueos.</li>
        <li><strong>Creadores:</strong> nombre legal, fecha de nacimiento, país, identificación y selfie de verificación, y datos de la cuenta de cobro.</li>
        <li><strong>Pagos:</strong> los procesa un proveedor externo; nosotros no almacenamos números de tarjeta.</li>
        <li><strong>Técnicos:</strong> registros de seguridad y límites de uso para prevenir abuso.</li>
      </ul>

      <h2>Para qué los usamos</h2>
      <ul>
        <li>Operar la plataforma, cobrar y pagar a los creadores.</li>
        <li>Verificar la edad y la identidad de los creadores y moderar contenido.</li>
        <li>Prevenir fraude y abuso, y cumplir obligaciones legales y fiscales.</li>
      </ul>

      <h2>Verificación de identidad</h2>
      <p>
        Los documentos de verificación se guardan en almacenamiento privado, solo los ve el equipo de administración y se
        eliminan automáticamente a los 30 días de resolver la solicitud. Conservamos únicamente el resultado de la revisión.
      </p>

      <h2>Con quién los compartimos</h2>
      <p>
        Proveedores que nos prestan servicio (alojamiento, base de datos, correo y pagos) y autoridades cuando la ley lo exija.
        No vendemos tus datos.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Puedes acceder, rectificar, cancelar u oponerte al tratamiento de tus datos. Puedes eliminar tu cuenta desde{" "}
        <a href="/account/delete">Eliminar cuenta</a>; los registros de pagos se conservan sin datos personales por obligación
        contable. Para otras solicitudes escribe a <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>Cookies</h2>
      <p>
        Usamos cookies estrictamente necesarias: sesión y la confirmación de que eres mayor de edad. No usamos cookies de publicidad.
      </p>
    </LegalShell>
  );
}
