export interface Category {
  id: number;
  nombre: string;
  deducible?: boolean | null;
}

export interface Expense {
  id: number;
  fecha: string;
  importe_cents: number;
  tasa_btw: 0 | 9 | 21;
  concepto: string;
  categoria_id?: number;
  creado_por?: "CLIENT" | "ACCOUNTANT";
  con_soporte?: boolean;
  estado: "PENDIENTE" | "APROBADO" | "RECHAZADO" | "ANULADO";
  nota_rechazo: string | null;
  nota_anulacion: string | null;
}

export interface ExpenseForm {
  fecha: string;
  amount: string;
  tasa_btw: 0 | 9 | 21;
  concepto: string;
  categoria_id: number | "";
  con_soporte: boolean;
}

export interface ChangePasswordData {
  token: string;
}
