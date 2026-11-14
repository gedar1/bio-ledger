import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import {
  ensureTenantRecord,
  initializePlatformSchema,
} from "../../src/server/services/platformSchema.js";
import { UsageMetricsCollector } from "../../src/server/services/UsageMetricsCollector.js";

describe("UsageMetricsCollector con tenants sin registro", () => {
  let db: InstanceType<typeof Database>;
  let collector: UsageMetricsCollector;

  const countEvents = (tenantId: string): number =>
    (
      db
        .prepare("SELECT COUNT(*) AS n FROM platform_metrics WHERE tenant_id = ?")
        .get(tenantId) as { n: number }
    ).n;

  beforeEach(() => {
    db = new Database(":memory:");
    initializePlatformSchema(db);
    collector = new UsageMetricsCollector();
    collector.initialize(db);
  });

  afterEach(() => {
    collector.dispose();
    db.close();
  });

  it("registra eventos de un tenant registrado", () => {
    ensureTenantRecord(db, "cliente-a", "domain");

    collector.record("cliente-a", "tokens", 120);

    expect(countEvents("cliente-a")).toBe(1);
  });

  it("omite el evento de un tenant sin registro sin lanzar error", () => {
    expect(() => collector.record("default", "tokens", 50)).not.toThrow();
    expect(countEvents("default")).toBe(0);
  });
});
