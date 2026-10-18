import type { Order } from "@/types";

export type OrderStatus = Order["status"];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pendiente",
  contacted: "Contactado",
  completed: "Completado",
  cancelled: "Cancelado",
};

export const ORDER_STATUS_ORDER: OrderStatus[] = [
  "pending",
  "contacted",
  "completed",
  "cancelled",
];

export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABEL[status as OrderStatus] ?? status;
}

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  approve_artist: "Aprobó solicitud de artista",
  reject_artist: "Rechazó solicitud de artista",
  enable_artist: "Habilitó artista",
  disable_artist: "Deshabilitó artista",
  hide_item: "Ocultó un ítem",
  unhide_item: "Volvió a mostrar un ítem",
  admin_reset_password: "Envió restablecimiento de contraseña",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABEL[action] ?? action;
}
