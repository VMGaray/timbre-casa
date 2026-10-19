import "server-only";

export type InlineKeyboardMarkup = {
  inline_keyboard: { text: string; callback_data: string }[][];
};

export class TelegramError extends Error {
  constructor(
    public method: string,
    public description: string,
  ) {
    super(`Telegram ${method}: ${description}`);
  }
}

type TelegramResponse<T> =
  | { ok: true; result: T }
  | { ok: false; description?: string; error_code?: number };

async function llamar<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Falta TELEGRAM_BOT_TOKEN");

  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as TelegramResponse<T> | null;
  if (!data || !data.ok) {
    throw new TelegramError(method, data?.description ?? `HTTP ${res.status}`);
  }
  return data.result;
}

export function sendMessage(
  chatId: number,
  text: string,
  opts: { reply_markup?: InlineKeyboardMarkup; reply_to_message_id?: number } = {},
) {
  const { reply_to_message_id, ...resto } = opts;
  return llamar<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...resto,
    ...(reply_to_message_id
      ? { reply_parameters: { message_id: reply_to_message_id, allow_sending_without_reply: true } }
      : {}),
  });
}

export function editMessageText(
  chatId: number,
  messageId: number,
  text: string,
  reply_markup?: InlineKeyboardMarkup,
) {
  return llamar<unknown>("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(reply_markup ? { reply_markup } : {}),
  });
}

export function answerCallbackQuery(callbackQueryId: string, text?: string) {
  return llamar<boolean>("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
  });
}

export function esNoModificado(err: unknown) {
  return err instanceof TelegramError && err.description.includes("message is not modified");
}

export function escaparHtml(texto: string) {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
