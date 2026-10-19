import { timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { getSupabase, type Toque } from "@/lib/supabase";
import { answerCallbackQuery, sendMessage } from "@/lib/telegram";
import { textoDeCodigo } from "@/lib/textos";
import {
  buscarDestinatarioActivo,
  buscarToque,
  buscarToqueReciente,
  difundirRespuesta,
  estaVigente,
  guardarRespuesta,
  type Destinatario,
} from "@/lib/avisos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Update = {
  callback_query?: {
    id: string;
    from: { id: number };
    data?: string;
  };
  message?: {
    message_id: number;
    from?: { id: number };
    chat: { id: number };
    text?: string;
    reply_to_message?: { message_id: number };
  };
};

const CALLBACK = /^r:([0-9a-f-]{36}):([a-z])$/;
const VENTANA_TEXTO_DIRECTO_MS = 10 * 60 * 1000;

function secretoValido(recibido: string | null) {
  const esperado = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!esperado || !recibido) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!secretoValido(request.headers.get("x-telegram-bot-api-secret-token"))) {
    return new Response("No autorizado", { status: 401 });
  }

  const update = (await request.json().catch(() => null)) as Update | null;
  if (update) {
    // Le contestamos 200 a Telegram enseguida y procesamos después.
    after(async () => {
      try {
        await procesar(update);
      } catch (err) {
        console.error("Error procesando update de Telegram:", err);
      }
    });
  }
  return new Response("ok");
}

async function procesar(update: Update) {
  if (update.callback_query) return procesarBoton(update.callback_query);
  if (update.message) return procesarMensaje(update.message);
}

async function procesarBoton(cq: NonNullable<Update["callback_query"]>) {
  const match = cq.data?.match(CALLBACK);
  const respuesta = match ? textoDeCodigo(match[2]) : null;
  if (!match || !respuesta) {
    await answerCallbackQuery(cq.id, "Opción no válida");
    return;
  }

  const destinatario = await buscarDestinatarioActivo(cq.from.id);
  if (!destinatario) {
    await answerCallbackQuery(cq.id, "No autorizado");
    return;
  }

  const toque = await buscarToque(match[1]);
  if (!toque || !estaVigente(toque)) {
    await answerCallbackQuery(cq.id, "Este aviso ya expiró");
    return;
  }

  await guardarRespuesta(toque.id, respuesta);
  await answerCallbackQuery(cq.id, "Respuesta enviada ✅");
  await difundirRespuesta(toque, respuesta, destinatario);
}

async function procesarMensaje(msg: NonNullable<Update["message"]>) {
  const chatId = msg.chat.id;
  const remitente = msg.from?.id ?? chatId;
  const destinatario = await buscarDestinatarioActivo(remitente);

  const texto = msg.text?.trim();
  if (msg.reply_to_message && texto && destinatario) {
    const { data: original, error } = await getSupabase()
      .from("mensajes")
      .select("toque_id")
      .eq("chat_id", chatId)
      .eq("message_id", msg.reply_to_message.message_id)
      .maybeSingle();
    if (error) throw error;

    if (original) {
      const toque = await buscarToque(original.toque_id);
      if (!toque || !estaVigente(toque)) {
        await sendMessage(chatId, "Este aviso ya expiró ⌛", { reply_to_message_id: msg.message_id });
        return;
      }
      await responderConTexto(toque, texto, destinatario, chatId, msg.message_id);
      return;
    }
  }

  // Texto suelto (sin reply) que no es comando: responde al toque de los últimos 10 minutos.
  if (!msg.reply_to_message && texto && !texto.startsWith("/") && destinatario) {
    const toque = await buscarToqueReciente(VENTANA_TEXTO_DIRECTO_MS);
    if (toque) {
      await responderConTexto(toque, texto, destinatario, chatId, msg.message_id);
      return;
    }
  }

  if (!destinatario) {
    await sendMessage(
      chatId,
      `Hola 👋 Tu ID es <code>${chatId}</code>. Pasáselo a quien administra el timbre para que te dé de alta.`,
    );
    return;
  }

  await sendMessage(
    chatId,
    [
      "Hola 👋 Ya estás anotado/a para recibir los avisos del timbre.",
      "",
      "🔔 Cuando alguien toque, te llega un mensaje solo.",
      "👆 Para contestar, tocá uno de los botones del aviso.",
      "✍️ O respondé (reply) a ese mensaje con el texto que quieras y se lo mostramos a quien está en la puerta.",
      "💬 En los 10 minutos posteriores al aviso también podés escribir directamente en el chat, sin reply.",
    ].join("\n"),
  );
}

async function responderConTexto(
  toque: Toque,
  texto: string,
  destinatario: Destinatario,
  chatId: number,
  messageId: number,
) {
  const respuesta = Array.from(texto).slice(0, 200).join("");
  await guardarRespuesta(toque.id, respuesta);
  await sendMessage(chatId, "Respuesta enviada ✅", { reply_to_message_id: messageId });
  await difundirRespuesta(toque, respuesta, destinatario);
}
