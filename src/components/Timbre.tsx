"use client";

import { useEffect, useState, type FormEvent } from "react";

type Estado =
  | { paso: "formulario"; error?: string }
  | { paso: "enviando" }
  | { paso: "esperando"; id: string }
  | { paso: "respondido"; respuesta: string }
  | { paso: "sinRespuesta" };

const INTERVALO_MS = 3000;
const LIMITE_ESPERA_MS = 10 * 60 * 1000;
const PUEDE_VOLVER_MS = 60 * 1000;

function Campana({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

export default function Timbre() {
  const [estado, setEstado] = useState<Estado>({ paso: "formulario" });
  const [nombre, setNombre] = useState("");
  const [motivo, setMotivo] = useState("");
  const [website, setWebsite] = useState("");
  const [puedeVolver, setPuedeVolver] = useState(false);

  const idEsperando = estado.paso === "esperando" ? estado.id : null;

  // Polling cada 3 s hasta que haya respuesta o pasen 10 minutos.
  useEffect(() => {
    if (!idEsperando) return;
    const inicio = Date.now();
    const control = new AbortController();
    let timer: ReturnType<typeof setTimeout>;

    const consultar = async () => {
      if (Date.now() - inicio >= LIMITE_ESPERA_MS) {
        setEstado({ paso: "sinRespuesta" });
        return;
      }
      try {
        const res = await fetch(`/api/toque/${idEsperando}`, { cache: "no-store", signal: control.signal });
        if (res.ok) {
          const data = (await res.json()) as { respondido: boolean; respuesta: string | null };
          if (data.respondido && data.respuesta) {
            setEstado({ paso: "respondido", respuesta: data.respuesta });
            return;
          }
        }
      } catch {
        if (control.signal.aborted) return;
      }
      timer = setTimeout(consultar, INTERVALO_MS);
    };

    timer = setTimeout(consultar, INTERVALO_MS);
    const habilitarVolver = setTimeout(() => setPuedeVolver(true), PUEDE_VOLVER_MS);
    return () => {
      control.abort();
      clearTimeout(timer);
      clearTimeout(habilitarVolver);
    };
  }, [idEsperando]);

  async function tocar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEstado({ paso: "enviando" });
    setPuedeVolver(false);
    try {
      const res = await fetch("/api/tocar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, motivo, website }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (res.ok && data.id) {
        setEstado({ paso: "esperando", id: data.id });
      } else if (res.status === 429) {
        setEstado({
          paso: "formulario",
          error: data.error ?? "Ya avisamos hace un momento. Esperá un minuto antes de volver a tocar.",
        });
      } else {
        setEstado({ paso: "formulario", error: data.error ?? "Uy, algo falló. Probá de nuevo en un ratito." });
      }
    } catch {
      setEstado({ paso: "formulario", error: "No pudimos conectarnos. Revisá tu conexión y probá de nuevo." });
    }
  }

  function volverATocar() {
    setPuedeVolver(false);
    setEstado({ paso: "formulario" });
  }

  const botonVolver = (
    <button
      type="button"
      onClick={volverATocar}
      className="mt-8 min-h-12 w-full rounded-2xl border-2 border-orange-300 bg-white px-6 text-lg font-semibold text-orange-800 transition hover:bg-orange-50 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
    >
      Volver a tocar
    </button>
  );

  return (
    <div className="w-full max-w-md">
      {(estado.paso === "formulario" || estado.paso === "enviando") && (
        <>
          <header className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-orange-100 text-orange-600 shadow-sm">
              <Campana className="h-10 w-10" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-stone-900">¡Hola! Tocá el timbre 🔔</h1>
            <p className="mt-3 text-lg text-stone-600">Le avisamos a la casa al toque. Si querés, dejanos tu nombre o el motivo.</p>
          </header>

          <form onSubmit={tocar} className="space-y-5" noValidate>
            <div>
              <label htmlFor="nombre" className="mb-1.5 block text-base font-medium text-stone-800">
                Tu nombre <span className="font-normal text-stone-500">(opcional)</span>
              </label>
              <input
                id="nombre"
                name="nombre"
                type="text"
                maxLength={40}
                autoComplete="name"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej.: Sofi, el plomero, delivery…"
                className="min-h-12 w-full rounded-xl border border-stone-300 bg-white px-4 text-lg text-stone-900 placeholder:text-stone-500 focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-200"
              />
            </div>

            <div>
              <label htmlFor="motivo" className="mb-1.5 block text-base font-medium text-stone-800">
                ¿Qué necesitás? <span className="font-normal text-stone-500">(opcional)</span>
              </label>
              <textarea
                id="motivo"
                name="motivo"
                rows={3}
                maxLength={120}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej.: Traigo un paquete, vengo a visitar…"
                className="w-full resize-none rounded-xl border border-stone-300 bg-white px-4 py-3 text-lg text-stone-900 placeholder:text-stone-500 focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-200"
              />
              <p className="mt-1 text-right text-sm text-stone-500" aria-live="polite">
                {motivo.length}/120
              </p>
            </div>

            {/* Honeypot: oculto para personas y lectores de pantalla. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
              <label htmlFor="website">No completar</label>
              <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>

            {estado.paso === "formulario" && estado.error && (
              <p role="alert" className="rounded-xl bg-amber-100 px-4 py-3 text-base text-amber-900">
                {estado.error}
              </p>
            )}

            <button
              type="submit"
              disabled={estado.paso === "enviando"}
              className="flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-orange-600 px-6 text-xl font-bold text-white shadow-lg shadow-orange-600/25 transition hover:bg-orange-700 active:scale-[0.98] disabled:cursor-wait disabled:opacity-80 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
            >
              <Campana className="h-7 w-7" />
              {estado.paso === "enviando" ? "Enviando..." : "Tocar timbre"}
            </button>
          </form>
        </>
      )}

      {estado.paso === "esperando" && (
        <section className="text-center" aria-live="polite">
          <div className="relative mx-auto mb-8 flex h-28 w-28 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-orange-200 motion-safe:animate-ping motion-safe:[animation-duration:2s]" aria-hidden="true" />
            <span className="relative flex h-28 w-28 items-center justify-center rounded-full bg-orange-100 text-orange-600">
              <Campana className="animate-balanceo h-14 w-14" />
            </span>
          </div>
          <h1 className="text-3xl font-bold text-stone-900">¡Listo! Ya avisamos 🔔</h1>
          <p className="mt-3 text-lg text-stone-600">
            Esperando respuesta
            <span className="inline-flex w-6 justify-start" aria-hidden="true">
              <span className="motion-safe:animate-pulse">...</span>
            </span>
          </p>
          <p className="mt-2 text-base text-stone-500">Quedate en esta pantalla, la respuesta aparece acá.</p>
          {puedeVolver && botonVolver}
        </section>
      )}

      {estado.paso === "respondido" && (
        <section className="text-center" aria-live="assertive">
          <p className="text-lg font-medium text-stone-600">Te respondieron:</p>
          <p className="mt-4 break-words rounded-3xl bg-white px-6 py-8 text-3xl font-bold leading-snug text-stone-900 shadow-md ring-1 ring-orange-100">
            {estado.respuesta}
          </p>
          {botonVolver}
        </section>
      )}

      {estado.paso === "sinRespuesta" && (
        <section className="text-center" aria-live="polite">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-stone-200 text-stone-600">
            <Campana className="h-10 w-10" />
          </div>
          <p className="text-xl font-semibold leading-relaxed text-stone-800">
            Nadie respondió todavía. Si es urgente, podés volver a tocar en unos minutos.
          </p>
          {botonVolver}
        </section>
      )}
    </div>
  );
}
