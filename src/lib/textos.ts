// Códigos de 1 letra para el callback_data de los botones ("r:<toqueId>:<código>").
export const RESPUESTAS = {
  y: "🏃 Ya voy",
  e: "⏳ Esperá un momento",
  p: "📦 Dejalo en la puerta",
  n: "🚫 No estoy, volvé más tarde",
} as const;

export type CodigoRespuesta = keyof typeof RESPUESTAS;

export function textoDeCodigo(codigo: string): string | null {
  return Object.hasOwn(RESPUESTAS, codigo) ? RESPUESTAS[codigo as CodigoRespuesta] : null;
}
