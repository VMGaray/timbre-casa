"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { RESPUESTAS, type CodigoRespuesta } from "@/lib/textos";

type Estado =
  | { paso: "formulario"; error?: string }
  | { paso: "enviando" }
  | { paso: "esperando"; id: string }
  | { paso: "respondido"; respuesta: string }
  | { paso: "sinRespuesta" };

const INTERVALO_MS = 3000;
const LIMITE_ESPERA_MS = 10 * 60 * 1000;
const PUEDE_VOLVER_MS = 60 * 1000;

const ICONOS_RESPUESTA: Record<CodigoRespuesta, string> = {
  y: "/icons/corriendo.png",
  e: "/icons/reloj-arena.png",
  p: "/icons/paquete.png",
  n: "/icons/prohibido.png",
};

// Las respuestas de los botones muestran su ícono 3D (sin el emoji); el texto libre, el globo.
function presentarRespuesta(respuesta: string) {
  const codigo = (Object.keys(RESPUESTAS) as CodigoRespuesta[]).find((c) => RESPUESTAS[c] === respuesta);
  if (!codigo) return { icono: "/icons/globo.png", texto: respuesta };
  return { icono: ICONOS_RESPUESTA[codigo], texto: respuesta.slice(respuesta.indexOf(" ") + 1) };
}

const ANILLO_CAMPANA = [0, -16, 14, -10, 7, -3, 0];

const transicionVista = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
};

const tarjeta =
  "rounded-[28px] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl";

const foco = "focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-acento";

const campo =
  "w-full rounded-2xl border border-white/15 bg-marino/60 px-4 text-base text-texto placeholder:text-texto-suave/70 transition focus:border-acento focus:outline-none focus:ring-4 focus:ring-acento/30";

function Icono3D({ src, size, className = "", eager = false }: { src: string; size: number; className?: string; eager?: boolean }) {
  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      sizes={`${size}px`}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      className={`select-none drop-shadow-[0_10px_18px_rgba(0,0,0,0.35)] ${className}`}
      draggable={false}
    />
  );
}

// Campana con balanceo tipo "ring". Cambiar `toque` la vuelve a hacer sonar.
function Campana({ size, toque = 0, repetir = false }: { size: number; toque?: number; repetir?: boolean }) {
  const reducir = useReducedMotion();
  return (
    <motion.div
      key={toque}
      style={{ transformOrigin: "50% 12%" }}
      initial={{ rotate: 0 }}
      animate={{ rotate: ANILLO_CAMPANA }}
      transition={{
        duration: 1.1,
        ease: "easeInOut",
        ...(repetir && !reducir ? { repeat: Infinity, repeatDelay: 2.4 } : {}),
      }}
    >
      <Icono3D src="/icons/campana.png" size={size} eager />
    </motion.div>
  );
}

function Ondas() {
  return (
    <div aria-hidden="true" className="absolute inset-0">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="absolute inset-0 rounded-full border-2 border-acento/70 bg-acento/10"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: [0.6, 1.9], opacity: [0.7, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

function Puntos() {
  const reducir = useReducedMotion();
  if (reducir) return <span aria-hidden="true">...</span>;
  return (
    <span aria-hidden="true" className="inline-flex gap-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
        >
          .
        </motion.span>
      ))}
    </span>
  );
}

function BotonVolver({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className={`mt-6 min-h-14 w-full rounded-2xl border border-white/20 bg-white/5 px-6 text-lg font-semibold text-texto transition hover:bg-white/10 ${foco}`}
    >
      Volver a tocar
    </motion.button>
  );
}

export default function Timbre() {
  const [estado, setEstado] = useState<Estado>({ paso: "formulario" });
  const [nombre, setNombre] = useState("");
  const [motivo, setMotivo] = useState("");
  const [website, setWebsite] = useState("");
  const [puedeVolver, setPuedeVolver] = useState(false);
  const [toques, setToques] = useState(0);
  const reducir = useReducedMotion();

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
    setToques((n) => n + 1);
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

  const vista = estado.paso === "enviando" ? "formulario" : estado.paso;
  const anuncio =
    estado.paso === "enviando"
      ? "Enviando aviso..."
      : estado.paso === "esperando"
        ? "¡Listo! Ya avisamos. Esperando respuesta."
        : estado.paso === "respondido"
          ? `Te respondieron: ${presentarRespuesta(estado.respuesta).texto}`
          : estado.paso === "sinRespuesta"
            ? "Nadie respondió todavía. Si es urgente, podés volver a tocar en unos minutos."
            : "";
  const listo = estado.paso === "formulario";

  return (
    <MotionConfig reducedMotion="user">
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {anuncio}
      </p>

      <AnimatePresence mode="wait" initial={false}>
        {vista === "formulario" && (
          <motion.div key="formulario" {...transicionVista}>
            <header className="mb-7 text-center">
              <div className="mx-auto mb-4 flex h-28 w-28 items-center justify-center">
                <Campana size={104} toque={toques} />
              </div>
              <h1 className="font-display text-[2rem] leading-tight font-bold tracking-tight text-texto">
                ¡Hola! Tocá el timbre
              </h1>
              <p className="mt-2 text-base text-texto-suave">
                Le avisamos a la casa al toque. Si querés, dejanos tu nombre o el motivo.
              </p>
            </header>

            <form onSubmit={tocar} className={`${tarjeta} space-y-5`} noValidate>
              <div>
                <label htmlFor="nombre" className="mb-1.5 block text-[0.95rem] font-medium text-texto">
                  Tu nombre <span className="font-normal text-texto-suave">(opcional)</span>
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
                  className={`${campo} min-h-13`}
                />
              </div>

              <div>
                <label htmlFor="motivo" className="mb-1.5 block text-[0.95rem] font-medium text-texto">
                  ¿Qué necesitás? <span className="font-normal text-texto-suave">(opcional)</span>
                </label>
                <textarea
                  id="motivo"
                  name="motivo"
                  rows={3}
                  maxLength={120}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej.: Traigo un paquete, vengo a visitar…"
                  className={`${campo} resize-none py-3`}
                />
                <p className="mt-1 text-right text-sm text-texto-suave" aria-live="polite">
                  {motivo.length}/120
                </p>
              </div>

              {/* Honeypot: oculto para personas y lectores de pantalla. */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
                <label htmlFor="website">No completar</label>
                <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>

              <AnimatePresence initial={false}>
                {estado.paso === "formulario" && estado.error && (
                  <motion.div
                    role="alert"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-3 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-[0.95rem] text-amber-100"
                  >
                    <Icono3D src="/icons/advertencia.png" size={32} className="shrink-0" />
                    <span>{estado.error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                type="submit"
                disabled={!listo}
                whileTap={{ scale: 0.97 }}
                animate={
                  listo && !reducir
                    ? {
                        boxShadow: [
                          "0 10px 30px -8px rgba(6,163,120,0.45), 0 0 0 0 rgba(6,163,120,0.35)",
                          "0 10px 30px -8px rgba(6,163,120,0.65), 0 0 0 10px rgba(6,163,120,0)",
                        ],
                      }
                    : { boxShadow: "0 10px 30px -8px rgba(6,163,120,0.45)" }
                }
                transition={listo && !reducir ? { duration: 1.8, repeat: Infinity, ease: "easeOut" } : { duration: 0.2 }}
                className={`flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-acento px-6 text-xl font-bold text-marino transition-colors hover:bg-[#08b585] disabled:cursor-wait ${foco}`}
              >
                {estado.paso === "enviando" ? (
                  <>
                    <span aria-hidden="true" className="h-6 w-6 rounded-full border-[3px] border-marino/30 border-t-marino motion-safe:animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Tocar timbre"
                )}
              </motion.button>
            </form>
          </motion.div>
        )}

        {vista === "esperando" && (
          <motion.section key="esperando" {...transicionVista} className="text-center">
            <div className="relative mx-auto mb-8 flex h-40 w-40 items-center justify-center">
              {!reducir && <Ondas />}
              <div className="absolute inset-4 rounded-full bg-acento/15 ring-1 ring-acento/30" aria-hidden="true" />
              <div className="relative">
                <Campana size={112} repetir />
              </div>
            </div>
            <div className={tarjeta}>
              <div className="flex items-center justify-center gap-2">
                <Icono3D src="/icons/check.png" size={30} />
                <h1 className="font-display text-2xl font-bold text-texto">¡Listo! Ya avisamos</h1>
              </div>
              <p className="mt-3 text-lg text-texto-suave">
                Esperando respuesta<Puntos />
              </p>
              <p className="mt-2 text-sm text-texto-suave">Quedate en esta pantalla, la respuesta aparece acá.</p>
              <AnimatePresence>
                {puedeVolver && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <BotonVolver onClick={volverATocar} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.section>
        )}

        {estado.paso === "respondido" && (
          <motion.section
            key="respondido"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ type: "spring", bounce: 0.45, duration: 0.6 }}
            className="text-center"
          >
            <div className="mb-4 flex items-center justify-center gap-2 text-texto-suave">
              <Icono3D src="/icons/check.png" size={26} />
              <p className="text-base font-medium">Te respondieron</p>
            </div>
            <div className={`${tarjeta} px-6 py-8`}>
              <motion.div
                className="mx-auto mb-5 w-fit"
                initial={{ scale: 0, rotate: -12 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", bounce: 0.55, duration: 0.7, delay: 0.15 }}
              >
                <Icono3D src={presentarRespuesta(estado.respuesta).icono} size={112} eager />
              </motion.div>
              <p className="font-display text-3xl leading-snug font-bold break-words text-texto">
                {presentarRespuesta(estado.respuesta).texto}
              </p>
            </div>
            <BotonVolver onClick={volverATocar} />
          </motion.section>
        )}

        {vista === "sinRespuesta" && (
          <motion.section key="sinRespuesta" {...transicionVista} className="text-center">
            <div className="mx-auto mb-6 w-fit opacity-70 grayscale-[35%]">
              <Icono3D src="/icons/campana.png" size={96} />
            </div>
            <div className={tarjeta}>
              <p className="text-xl leading-relaxed font-semibold text-texto">
                Nadie respondió todavía. Si es urgente, podés volver a tocar en unos minutos.
              </p>
              <BotonVolver onClick={volverATocar} />
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
