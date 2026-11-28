import { describe, it, expect } from "vitest";
import { extractCliente } from "../../src/atoms/clienteExtraction.js";
import { EXTRACTORS } from "../../src/atoms/chainSpec.js";

const juan = { tenant_id: "cliente-235", display_name: "Juan Pérez" };
const ana = { tenant_id: "cliente-23", display_name: "Ana López" };

describe("extractor de cliente", () => {
  it("reconoce el ID completo del cliente en el texto", () => {
    expect(extractCliente("gastos pendientes de cliente-235", [juan, ana])).toBe("cliente-235");
  });

  it("no toma un ID que es solo prefijo de otro", () => {
    expect(extractCliente("gastos de cliente-2", [juan, ana])).toBeNull();
  });

  it("reconoce el nombre completo sin tildes ni mayúsculas", () => {
    expect(extractCliente("gastos de juan perez", [juan, ana])).toBe("cliente-235");
  });

  it("acepta un nombre parcial si identifica un único cliente", () => {
    expect(extractCliente("gastos de Juan", [juan, ana])).toBe("cliente-235");
  });

  it("devuelve null si un nombre parcial coincide con varios clientes", () => {
    const juanGarcia = { tenant_id: "cliente-77", display_name: "Juan García" };
    expect(extractCliente("gastos de Juan", [juan, juanGarcia, ana])).toBeNull();
  });

  it("devuelve null si el cliente no existe en la cuenta", () => {
    expect(extractCliente("gastos de cliente-99", [juan, ana])).toBeNull();
  });

  it("devuelve null si la cuenta no tiene clientes", () => {
    expect(extractCliente("gastos de Juan", [])).toBeNull();
  });

  it("con nombres repetidos, pide el ID en vez de elegir", () => {
    const juanOtro = { tenant_id: "cliente-240", display_name: "Juan Pérez" };
    expect(extractCliente("gastos de Juan Pérez", [juan, juanOtro])).toBeNull();
    expect(extractCliente("gastos de cliente-240", [juan, juanOtro])).toBe("cliente-240");
  });
});

describe("extractor cliente en el registro de cadenas", () => {
  it("lee los clientes del contexto de la cuenta", () => {
    const context = { clientes: [juan, ana] };
    expect(EXTRACTORS.cliente("gastos de Juan", context)).toBe("cliente-235");
    expect(EXTRACTORS.cliente("gastos de Juan", { clientes: [] })).toBeNull();
  });
});
