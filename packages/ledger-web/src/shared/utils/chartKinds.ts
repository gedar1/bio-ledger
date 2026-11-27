import type { ChatCell, ValueFormat } from "@/types";

/** Tipos de gráfico que el front puede dibujar a partir de una tabla. */
export type ChartKind = "bar" | "line" | "pie";

export interface ChartData {
  /** Formato de la primera columna: "month" (serie temporal) o "text" (categorías). */
  dimensionFormat: ValueFormat;
  series: { label: string; cents: number }[];
}

const MAX_POINTS = 24;
const MAX_PIE_SLICES = 8;

/**
 * Datos de gráfico de una tabla: la primera columna es la dimensión y la primera columna de
 * importe es la medida. Devuelve null si la tabla no tiene esa forma.
 */
export function chartDataOf(
  columns: { key: string; format: ValueFormat }[],
  rows: ChatCell[][],
): ChartData | null {
  const dimensionFormat = columns[0]?.format;
  if (dimensionFormat !== "month" && dimensionFormat !== "text") return null;
  const amountIndex = columns.findIndex((c) => c.format === "cents");
  if (amountIndex < 1 || rows.length < 2 || rows.length > MAX_POINTS) return null;
  return {
    dimensionFormat,
    series: rows.map((row) => ({
      label: String(row[0]),
      cents: Number(row[amountIndex]),
    })),
  };
}

/**
 * Tipos de gráfico que tienen sentido para esos datos. Una serie por mes admite barras y línea.
 * Las categorías admiten barras y, si todos los importes son positivos y hay pocas, circular.
 */
export function chartKindsOf(data: ChartData | null): ChartKind[] {
  if (!data) return [];
  if (data.dimensionFormat === "month") return ["bar", "line"];
  const total = data.series.reduce((sum, s) => sum + s.cents, 0);
  const canPie =
    total > 0 &&
    data.series.every((s) => s.cents >= 0) &&
    data.series.length <= MAX_PIE_SLICES;
  return canPie ? ["bar", "pie"] : ["bar"];
}
