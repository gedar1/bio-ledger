// export interface Expense {
//   id: number;
//   fecha: string;
//   importe_cents: number;
//   tasa_btw: 0 | 9 | 21;
//   concepto: string;
//   categoria_id?: number;
//   creado_por?: "CLIENT" | "ACCOUNTANT";
//   con_soporte?: boolean;
//   estado: "PENDIENTE" | "APROBADO" | "RECHAZADO" | "ANULADO";
//   nota_rechazo: string | null;
//   nota_anulacion: string | null;
// }

// interface Expense {

//   tasa_btw: 0 | 9 | 21;
//   categoria_id?: number;
//   creado_por?: "CLIENT" | "ACCOUNTANT";
//   con_soporte?: boolean;
// }

export interface ClientLoginData {
  token: string;
  tenant_id: string;
  must_change_password: boolean;
}

export interface ClientRow {
  tenant_id: string;
  display_name: string;
  status: string;
  must_change_password: boolean;
}

export interface ClientsData {
  clients: ClientRow[];
}

export interface CreatedClient {
  tenant_id: string;
  temp_password: string;
}
