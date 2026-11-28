import type { ReactNode } from "react";

export type AlertVariant = "info" | "success" | "warning" | "error";

const VARIANT_CLASS: Record<AlertVariant, string> = {
  info: "border-beige-deep bg-cream-light text-ink",
  success: "border-hairline-strong bg-surface text-ink",
  warning: "border-beige-deep bg-cream text-ink",
  error: "border-primary-deep bg-cream-light text-primary-deep",
};

export interface AlertProps {
  /** Tono del aviso. Por defecto, "info". */
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  /** Acción opcional, por ejemplo reintentar. */
  action?: { label: string; onClick: () => void; disabled?: boolean };
}

/** Aviso de estado: errores, advertencias o información que el usuario debe ver. */
export const Alert = ({
  variant = "info",
  title,
  children,
  action,
}: Readonly<AlertProps>) => (
  <div
    role={variant === "error" ? "alert" : "status"}
    className={`flex flex-col gap-2 rounded-lg border p-4 text-sm ${VARIANT_CLASS[variant]}`}
  >
    {title && <p className="font-medium">{title}</p>}
    <div>{children}</div>
    {action && (
      <button
        type="button"
        onClick={action.onClick}
        disabled={action.disabled}
        className="self-start text-xs font-medium underline disabled:opacity-50"
      >
        {action.label}
      </button>
    )}
  </div>
);
