import "server-only";
import { getSupabase, type Toque } from "./supabase";
import {
  editMessageText,
  escaparHtml,
  esNoModificado,
  type InlineKeyboardMarkup,
} from "./telegram";
import { RESPUESTAS, type CodigoRespuesta } from "./textos";

export const VIGENCIA_MS = 24 * 60 * 60 * 1000;

const formatoHora = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Cordoba",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function teclado(toqueId: string): InlineKeyboardMarkup {
  const boton = (codigo: CodigoRespuesta) => ({
    text: RESPUESTAS[codigo],
    callback_data: `r:${toqueId}:${codigo}`,
  });
  return {
    inline_keyboard: [[boton("y"), boton("e")], [boton("p")], [boton("n")]],
  };
}

// El texto se arma siempre a partir del toque, así al editar queda igual al original.
export function textoAviso(toque: Toque) {
  const lineas = [
    "🔔 <b>¡Están tocando el timbre!</b>",
    "",
    `👤 Nombre: ${toque.nombre ? escaparHtml(toque.nombre) : "<i>No dejó nombre</i>"}`,
  ];
  if (toque.motivo) lineas.push(`💬 Motivo: ${escaparHtml(toque.motivo)}`);
  lineas.push(`🕐 ${formatoHora.format(new Date(toque.created_at))}`);
  lineas.push("", "<i>Respondé con un botón o contestá este mensaje con un texto.</i>");
  if (toque.respuesta) {
    lineas.push("", `✅ <b>Respondido:</b> ${escaparHtml(toque.respuesta)}`);
  }
  return lineas.join("\n");
}

export function estaVigente(toque: Toque) {
  return Date.now() - new Date(toque.created_at).getTime() < VIGENCIA_MS;
}

export async function esDestinatarioActivo(chatId: number) {
  const { data, error } = await getSupabase()
    .from("destinatarios")
    .select("id")
    .eq("chat_id", chatId)
    .eq("activo", true)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

export async function buscarToque(id: string) {
  const { data, error } = await getSupabase()
    .from("toques")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Toque | null;
}

// Si responden varios, queda la más reciente.
export async function guardarRespuesta(toqueId: string, respuesta: string) {
  const { error } = await getSupabase()
    .from("toques")
    .update({ respuesta, respondido_at: new Date().toISOString() })
    .eq("id", toqueId);
  if (error) throw error;
}

// Edita los mensajes de todos los destinatarios agregando la respuesta.
export async function actualizarMensajes(toqueId: string) {
  // Releemos para editar con la respuesta vigente si dos personas respondieron casi a la vez.
  const toque = await buscarToque(toqueId);
  if (!toque) return;

  const { data: mensajes, error: errMensajes } = await getSupabase()
    .from("mensajes")
    .select("chat_id, message_id")
    .eq("toque_id", toqueId);
  if (errMensajes) throw errMensajes;

  const texto = textoAviso(toque);
  const markup = teclado(toqueId);
  const resultados = await Promise.allSettled(
    (mensajes ?? []).map((m) =>
      editMessageText(Number(m.chat_id), Number(m.message_id), texto, markup),
    ),
  );
  resultados.forEach((r) => {
    if (r.status === "rejected" && !esNoModificado(r.reason)) {
      console.error("No se pudo editar un mensaje:", r.reason);
    }
  });
}
