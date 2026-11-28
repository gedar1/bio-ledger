import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const configDir = new URL("../../../src/config/", import.meta.url);
const read = (file: string) => readFileSync(new URL(file, configDir), "utf-8");

const registry = JSON.parse(read("domain-registry.json")) as {
  cells: Array<{ type: string; tools?: string[] }>;
};

function toolsOf(cellType: string): string[] {
  return registry.cells.filter((c) => c.type === cellType).flatMap((c) => c.tools ?? []);
}

/** Nombres de herramienta que el prompt cita entre comillas invertidas, por ejemplo `list_my_expenses`. */
function toolsMentioned(prompt: string): string[] {
  return [...prompt.matchAll(/`((?:list|get)_[a-z_]+)`/g)].map((m) => m[1]);
}

const cases = [
  { cell: "ledger_cliente", prompt: "ledger-agent-cliente.md" },
  { cell: "ledger_contador", prompt: "ledger-agent-contador.md" },
];

describe.each(cases)("prompt de $prompt sincronizado con $cell", ({ cell, prompt }) => {
  const text = read(prompt);
  const registered = toolsOf(cell);

  it("menciona cada herramienta registrada en la célula", () => {
    const missing = registered.filter((tool) => !text.includes(`\`${tool}\``));
    expect(missing).toEqual([]);
  });

  it("no cita herramientas que ya no existen", () => {
    const unknown = toolsMentioned(text).filter((tool) => !registered.includes(tool));
    expect(unknown).toEqual([]);
  });
});
