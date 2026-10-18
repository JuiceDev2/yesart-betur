import { describe, it, expect } from "vitest";
import { auditActionLabel, orderStatusLabel, ORDER_STATUS_ORDER } from "./labels";

describe("orderStatusLabel", () => {
  it("traduce todos los estados al español", () => {
    expect(ORDER_STATUS_ORDER.map(orderStatusLabel)).toEqual([
      "Pendiente",
      "Contactado",
      "Completado",
      "Cancelado",
    ]);
  });

  it("devuelve el valor original si no lo conoce", () => {
    expect(orderStatusLabel("otro")).toBe("otro");
  });
});

describe("auditActionLabel", () => {
  it("traduce acciones conocidas y conserva las desconocidas", () => {
    expect(auditActionLabel("disable_artist")).toBe("Deshabilitó artista");
    expect(auditActionLabel("algo_nuevo")).toBe("algo_nuevo");
  });
});
