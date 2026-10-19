import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIN_CACHE = { "Cache-Control": "no-store" };

export async function GET(_request: Request, ctx: RouteContext<"/api/toque/[id]">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) {
    return Response.json({ error: "ID inválido" }, { status: 400, headers: SIN_CACHE });
  }

  const { data, error } = await getSupabase()
    .from("toques")
    .select("respuesta")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Error al consultar el toque:", error);
    return Response.json({ error: "Error interno" }, { status: 500, headers: SIN_CACHE });
  }
  if (!data) {
    return Response.json({ error: "No encontrado" }, { status: 404, headers: SIN_CACHE });
  }

  const respuesta: string | null = data.respuesta ?? null;
  return Response.json({ respondido: respuesta !== null, respuesta }, { headers: SIN_CACHE });
}
