import { getSupabase, type Toque } from "@/lib/supabase";
import { sendMessage } from "@/lib/telegram";
import { teclado, textoAviso } from "@/lib/avisos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ESPERA_ENTRE_TOQUES_MS = 60 * 1000;

// Recorta por caracteres (no por unidades UTF-16) para no partir emojis.
function limpiar(valor: unknown, max: number): string | null {
  if (typeof valor !== "string") return null;
  const texto = Array.from(valor.replace(/\s+/g, " ").trim()).slice(0, max).join("").trim();
  return texto === "" ? null : texto;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown> | null;
  const datos = body && typeof body === "object" ? body : {};

  // Honeypot: un humano nunca completa este campo.
  if (typeof datos.website === "string" && datos.website.trim() !== "") {
    return Response.json({ ok: true });
  }

  const nombre = limpiar(datos.nombre, 40);
  const motivo = limpiar(datos.motivo, 120);
  const supabase = getSupabase();

  try {
    const { data: ultimo, error: errUltimo } = await supabase
      .from("toques")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (errUltimo) throw errUltimo;

    if (ultimo && Date.now() - new Date(ultimo.created_at).getTime() < ESPERA_ENTRE_TOQUES_MS) {
      return Response.json(
        { error: "Ya avisamos hace un momento. Esperá un minuto antes de volver a tocar." },
        { status: 429 },
      );
    }

    const { data: toque, error: errToque } = await supabase
      .from("toques")
      .insert({ nombre, motivo })
      .select("*")
      .single();
    if (errToque) throw errToque;
    const nuevo = toque as Toque;

    const { data: destinatarios, error: errDest } = await supabase
      .from("destinatarios")
      .select("chat_id")
      .eq("activo", true);
    if (errDest) throw errDest;

    const texto = textoAviso(nuevo);
    const markup = teclado(nuevo.id);
    const chatIds = (destinatarios ?? []).map((d) => Number(d.chat_id));
    const envios = await Promise.allSettled(
      chatIds.map((chatId) => sendMessage(chatId, texto, { reply_markup: markup })),
    );

    const enviados = envios.flatMap((r, i) =>
      r.status === "fulfilled"
        ? [{ toque_id: nuevo.id, chat_id: chatIds[i], message_id: r.value.message_id }]
        : [],
    );
    envios.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(`No se pudo avisar al chat ${chatIds[i]}:`, r.reason);
      }
    });

    if (enviados.length === 0) {
      console.error(`El toque ${nuevo.id} no le llegó a nadie (${chatIds.length} destinatarios activos).`);
    } else {
      const { error: errMensajes } = await supabase.from("mensajes").insert(enviados);
      if (errMensajes) console.error("No se pudieron guardar los mensajes:", errMensajes);
    }

    return Response.json({ id: nuevo.id });
  } catch (err) {
    console.error("Error al tocar el timbre:", err);
    return Response.json(
      { error: "Uy, no pudimos avisar. Probá de nuevo en un ratito." },
      { status: 500 },
    );
  }
}
