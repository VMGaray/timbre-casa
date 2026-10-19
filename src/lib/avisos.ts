import "server-only";
import { getSupabase, type Toque } from "./supabase";
import {
  editMessageText,
  escaparHtml,
  esNoModificado,
  sendMessage,
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

export type Destinatario = { chat_id: number; nombre: string | null };

function nombreDe(destinatario: Destinatario) {
  return destinatario.nombre?.trim() || "alguien";
}

// El texto se arma siempre a partir del toque, así al editar queda igual al original.
// `respondio` es quien respondió: solo se muestra en Telegram, nunca se guarda en el toque.
export function textoAviso(toque: Toque, respondio?: Destinatario) {
  const lineas = [
    "🔔 <b>¡Están tocando el timbre!</b>",
    "",
    `👤 Nombre: ${toque.nombre ? escaparHtml(toque.nombre) : "<i>No dejó nombre</i>"}`,
  ];
  if (toque.motivo) lineas.push(`💬 Motivo: ${escaparHtml(toque.motivo)}`);
  lineas.push(`🕐 ${formatoHora.format(new Date(toque.created_at))}`);
  lineas.push("", "<i>Respondé con un botón o contestá este mensaje con un texto.</i>");
  if (toque.respuesta) {
    const encabezado = respondio ? `Respondió ${escaparHtml(nombreDe(respondio))}:` : "Respondido:";
    lineas.push("", `✅ <b>${encabezado}</b> ${escaparHtml(toque.respuesta)}`);
  }
  return lineas.join("\n");
}

export function estaVigente(toque: Toque) {
  return Date.now() - new Date(toque.created_at).getTime() < VIGENCIA_MS;
}

export async function buscarDestinatarioActivo(chatId: number) {
  const { data, error } = await getSupabase()
    .from("destinatarios")
    .select("chat_id, nombre")
    .eq("chat_id", chatId)
    .eq("activo", true)
    .maybeSingle();
  if (error) throw error;
  return data ? { chat_id: Number(data.chat_id), nombre: data.nombre as string | null } : null;
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

// El toque más reciente, si se creó hace menos de `maxMs`.
export async function buscarToqueReciente(maxMs: number) {
  const desde = new Date(Date.now() - maxMs).toISOString();
  const { data, error } = await getSupabase()
    .from("toques")
    .select("*")
    .gt("created_at", desde)
    .order("created_at", { ascending: false })
    .limit(1)
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

// Edita los mensajes originales de todos y avisa a los demás destinatarios quién respondió.
// Respuesta y nombre van juntos para que cada edición sea coherente aunque respondan dos a la vez.
export async function difundirRespuesta(toque: Toque, respuesta: string, respondio: Destinatario) {
  await Promise.all([
    editarMensajes({ ...toque, respuesta }, respondio),
    avisarALosDemas(respuesta, respondio),
  ]);
}

async function editarMensajes(toque: Toque, respondio: Destinatario) {
  const { data: mensajes, error } = await getSupabase()
    .from("mensajes")
    .select("chat_id, message_id")
    .eq("toque_id", toque.id);
  if (error) {
    console.error("No se pudieron leer los mensajes del toque:", error);
    return;
  }

  const texto = textoAviso(toque, respondio);
  const markup = teclado(toque.id);
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

async function avisarALosDemas(respuesta: string, respondio: Destinatario) {
  const { data: destinatarios, error } = await getSupabase()
    .from("destinatarios")
    .select("chat_id")
    .eq("activo", true)
    .neq("chat_id", respondio.chat_id);
  if (error) {
    console.error("No se pudieron leer los destinatarios:", error);
    return;
  }

  const texto = `✅ Ya respondió ${escaparHtml(nombreDe(respondio))}: ${escaparHtml(respuesta)}`;
  const chatIds = (destinatarios ?? []).map((d) => Number(d.chat_id));
  const resultados = await Promise.allSettled(chatIds.map((chatId) => sendMessage(chatId, texto)));
  resultados.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`No se pudo avisar la respuesta al chat ${chatIds[i]}:`, r.reason);
    }
  });
}
