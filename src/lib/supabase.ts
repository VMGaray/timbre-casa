import "server-only";
import { createClient } from "@supabase/supabase-js";

export type Toque = {
  id: string;
  nombre: string | null;
  motivo: string | null;
  respuesta: string | null;
  respondido_at: string | null;
  created_at: string;
};

function crearCliente() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, {
    db: { schema: "timbre" },
    auth: { persistSession: false },
  });
}

let cliente: ReturnType<typeof crearCliente> | null = null;

// Se crea recién cuando se usa, así el build no necesita las variables.
export function getSupabase() {
  if (!cliente) cliente = crearCliente();
  return cliente;
}
