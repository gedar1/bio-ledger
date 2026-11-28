import { describe, it, expect } from "vitest";
import {
  CLIENT_NOT_ALLOWED,
  clientsContextText,
  tenantScopeGuard,
} from "../../src/atoms/accountantScope.js";

describe("alcance del contador", () => {
  const guard = tenantScopeGuard(["cliente-a", "cliente-b"]);

  it("deja pasar un tenantId de un cliente de la cuenta", () => {
    expect(guard("list_pending_expenses", { tenantId: "cliente-a" })).toBeNull();
  });

  it("bloquea un tenantId que no es de la cuenta", () => {
    expect(guard("list_pending_expenses", { tenantId: "ajeno" })).toBe(CLIENT_NOT_ALLOWED);
  });

  it("bloquea un tenantId que no es texto", () => {
    expect(guard("get_client_statement", { tenantId: 7 })).toBe(CLIENT_NOT_ALLOWED);
  });

  it("no toca herramientas sin tenantId", () => {
    expect(guard("list_my_expenses", {})).toBeNull();
    expect(guard("list_my_expenses", undefined)).toBeNull();
  });

  it("una cuenta sin clientes no deja pasar ningún tenantId", () => {
    const empty = tenantScopeGuard([]);
    expect(empty("list_pending_expenses", { tenantId: "cliente-a" })).toBe(CLIENT_NOT_ALLOWED);
  });
});

describe("contexto de clientes para el modelo", () => {
  it("lista cada cliente con su nombre y su tenantId", () => {
    expect(
      clientsContextText([
        { tenant_id: "cliente-235", display_name: "Juan Pérez" },
        { tenant_id: "cliente-vivo", display_name: "Cliente vivo" },
      ]),
    ).toBe(
      [
        "Clientes del contador:",
        "- Juan Pérez (tenantId: cliente-235)",
        "- Cliente vivo (tenantId: cliente-vivo)",
      ].join("\n"),
    );
  });

  it("indica cuando la cuenta no tiene clientes", () => {
    expect(clientsContextText([])).toBe("Clientes del contador: ninguno.");
  });
});
