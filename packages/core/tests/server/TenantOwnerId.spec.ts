import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePlatformSchema } from "../../src/server/services/platformSchema.js";
import { TenantRegistryService } from "../../src/server/services/TenantRegistryService.js";

describe("platform_tenants.owner_id", () => {
  let dir: string;
  let db: InstanceType<typeof Database>;
  let registry: TenantRegistryService;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "owner-id-"));
    db = new Database(":memory:");
    initializePlatformSchema(db);
    registry = new TenantRegistryService(join(dir, "tenants"));
    registry.initialize(db);
  });

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("guarda y devuelve el owner_id del tenant", () => {
    const created = registry.create({
      tenant_id: "cliente-a",
      display_name: "Cliente A",
      profile: "domain",
      owner_id: "contador-1",
    });

    expect(created.owner_id).toBe("contador-1");
    expect(registry.getById("cliente-a")?.owner_id).toBe("contador-1");
    expect(registry.list().find((t) => t.tenant_id === "cliente-a")?.owner_id).toBe(
      "contador-1",
    );
  });

  it("deja owner_id en null cuando no se indica", () => {
    registry.create({
      tenant_id: "sin-dueno",
      display_name: "Sin dueño",
      profile: "domain",
    });

    expect(registry.getById("sin-dueno")?.owner_id).toBeNull();
  });

  it("rechaza un owner_id vacío", () => {
    expect(() =>
      registry.create({
        tenant_id: "cliente-b",
        display_name: "Cliente B",
        profile: "domain",
        owner_id: "",
      }),
    ).toThrow();
  });

  it("agrega owner_id a una base antigua y conserva sus tenants al reconstruir la tabla", () => {
    const legacy = new Database(":memory:");
    // Esquema anterior: el CHECK de profile acepta 'domain' y 'restaurant', sin owner_id.
    legacy.exec(`
      CREATE TABLE platform_tenants (
        tenant_id     TEXT PRIMARY KEY,
        display_name  TEXT NOT NULL,
        profile       TEXT NOT NULL CHECK(profile IN ('domain', 'restaurant')),
        status        TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'degraded')),
        token_limit   INTEGER NOT NULL DEFAULT 0,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
        last_activity TEXT
      )
    `);
    legacy
      .prepare(
        "INSERT INTO platform_tenants (tenant_id, display_name, profile) VALUES ('viejo', 'Viejo', 'domain')",
      )
      .run();

    initializePlatformSchema(legacy);

    const columns = legacy
      .prepare("PRAGMA table_info(platform_tenants)")
      .all()
      .map((c) => (c as { name: string }).name);
    expect(columns).toContain("owner_id");

    const row = legacy
      .prepare("SELECT tenant_id, owner_id FROM platform_tenants WHERE tenant_id = 'viejo'")
      .get() as { tenant_id: string; owner_id: string | null } | undefined;
    expect(row).toEqual({ tenant_id: "viejo", owner_id: null });
    legacy.close();
  });

  it("initializePlatformSchema es idempotente", () => {
    expect(() => initializePlatformSchema(db)).not.toThrow();
  });
});
