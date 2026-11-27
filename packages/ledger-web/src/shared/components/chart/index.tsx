import { formatValue } from "@/shared/helpers/helpers";
import { LOCALE, type ChartData, type ChartKind } from "@/shared/utils";
import { useTranslation } from "react-i18next";

interface ChartProps {
  kind: ChartKind;
  data: ChartData;
  /** Título accesible del gráfico. */
  title: string;
}

const WIDTH = 480;
const HEIGHT = 200;
const PAD_X = 16;
const LABEL_HEIGHT = 24;
const PLOT_HEIGHT = HEIGHT - LABEL_HEIGHT;

/** Colores de los sectores: tonos repartidos por el círculo cromático. */
const sliceColor = (index: number, count: number) =>
  `hsl(${Math.round((index * 360) / count)} 70% 55%)`;

/**
 * Gráfico en SVG propio, sin dependencias. Dibuja los mismos datos de una tabla
 * como barras, línea o circular. Cada punto muestra su valor al pasar el ratón.
 */
const Chart = ({ kind, data, title }: Readonly<ChartProps>) => {
  const { i18n } = useTranslation();
  const locale = LOCALE[i18n.language] ?? "nl-NL";
  const { series, dimensionFormat } = data;
  const labelOf = (label: string) =>
    formatValue(label, dimensionFormat, locale);
  const money = (cents: number) => formatValue(cents, "cents", locale);
  const max = Math.max(0, ...series.map((s) => s.cents));
  const step = (WIDTH - 2 * PAD_X) / series.length;

  if (kind === "pie") {
    const total = series.reduce((sum, s) => sum + s.cents, 0);
    const cx = 100;
    const cy = 100;
    const r = 90;
    let angle = -Math.PI / 2;
    const slices = series.map((s, index) => {
      const sweep = (s.cents / total) * 2 * Math.PI;
      const start = angle;
      angle += sweep;
      const large = sweep > Math.PI ? 1 : 0;
      const d =
        series.length === 1
          ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r}`
          : `M ${cx} ${cy} L ${cx + r * Math.cos(start)} ${cy + r * Math.sin(start)} A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(angle)} ${cy + r * Math.sin(angle)} Z`;
      return { s, d, color: sliceColor(index, series.length) };
    });
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <svg
          role="img"
          aria-label={title}
          viewBox="0 0 200 200"
          className="h-48 w-48 shrink-0"
        >
          {slices.map(({ s, d, color }) => (
            <path key={s.label} d={d} fill={color}>
              <title>{`${labelOf(s.label)}: ${money(s.cents)}`}</title>
            </path>
          ))}
        </svg>
        <ul className="flex flex-col gap-1 text-sm">
          {slices.map(({ s, color }) => (
            <li key={s.label} className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ backgroundColor: color }}
              />
              <span>{labelOf(s.label)}</span>
              <span className="ml-auto pl-4 font-medium">{money(s.cents)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <svg
      role="img"
      aria-label={title}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-auto w-full"
    >
      {kind === "bar" &&
        series.map((point, index) => {
          const barWidth = step * 0.6;
          const x = PAD_X + index * step + (step - barWidth) / 2;
          const barHeight = max > 0 ? (point.cents / max) * PLOT_HEIGHT : 0;
          return (
            <g key={point.label}>
              <title>{`${labelOf(point.label)}: ${money(point.cents)}`}</title>
              <rect
                x={x}
                y={PLOT_HEIGHT - barHeight}
                width={barWidth}
                height={barHeight}
                rx={3}
                className="fill-primary"
              />
              <text
                x={x + barWidth / 2}
                y={HEIGHT - 6}
                textAnchor="middle"
                className="fill-steel text-[10px]"
              >
                {labelOf(point.label)}
              </text>
            </g>
          );
        })}
      {kind === "line" && (
        <>
          <polyline
            fill="none"
            strokeWidth={2}
            className="stroke-primary"
            points={series
              .map((point, index) => {
                const x = PAD_X + index * step + step / 2;
                const y =
                  max > 0
                    ? PLOT_HEIGHT - (point.cents / max) * PLOT_HEIGHT
                    : PLOT_HEIGHT;
                return `${x},${y}`;
              })
              .join(" ")}
          />
          {series.map((point, index) => {
            const x = PAD_X + index * step + step / 2;
            const y =
              max > 0
                ? PLOT_HEIGHT - (point.cents / max) * PLOT_HEIGHT
                : PLOT_HEIGHT;
            return (
              <g key={point.label}>
                <title>{`${labelOf(point.label)}: ${money(point.cents)}`}</title>
                <circle cx={x} cy={y} r={3.5} className="fill-primary" />
                <text
                  x={x}
                  y={HEIGHT - 6}
                  textAnchor="middle"
                  className="fill-steel text-[10px]"
                >
                  {labelOf(point.label)}
                </text>
              </g>
            );
          })}
        </>
      )}
    </svg>
  );
};

export default Chart;
