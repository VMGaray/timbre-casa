import Timbre from "@/components/Timbre";

export default function Home() {
  return (
    <>
      {/* Brillos verdes de fondo, puramente decorativos. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-acento/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-72 w-72 rounded-full bg-acento/10 blur-3xl" />
      </div>

      <main
        className="mx-auto flex w-full max-w-[420px] flex-1 flex-col px-5"
        style={{
          paddingTop: "max(2rem, env(safe-area-inset-top))",
          paddingLeft: "max(1.25rem, env(safe-area-inset-left))",
          paddingRight: "max(1.25rem, env(safe-area-inset-right))",
        }}
      >
        <div className="flex flex-1 flex-col justify-center">
          <Timbre />
        </div>

        <footer
          className="pt-8 text-center text-xs text-texto-suave/80"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          Desarrollado por{" "}
          <a
            href="https://www.instagram.com/vmg.setup.ai/"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded underline-offset-2 hover:text-texto hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento"
          >
            @vmg.setup.ai
          </a>
        </footer>
      </main>
    </>
  );
}
