// Genera el QR de la puerta y el cartel para imprimir en qr/.
// Uso: npm run qr
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

const URL_TIMBRE = "https://timbre-casa-liard.vercel.app";
const SALIDA = fileURLToPath(new URL("../qr/", import.meta.url));

const opciones = {
  errorCorrectionLevel: "H",
  margin: 4,
  color: { dark: "#000000", light: "#ffffff" },
};

await mkdir(SALIDA, { recursive: true });

const svg = await QRCode.toString(URL_TIMBRE, { ...opciones, type: "svg" });
await writeFile(`${SALIDA}qr-timbre.svg`, svg);

await QRCode.toFile(`${SALIDA}qr-timbre.png`, URL_TIMBRE, { ...opciones, type: "png", width: 2000 });

const cartel = `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cartel del timbre</title>
<style>
  @page { size: 10cm 15cm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #ffffff; color: #000000; }
  body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; }
  .cartel {
    width: 10cm;
    height: 15cm;
    padding: 0.8cm 0.6cm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    text-align: center;
    overflow: hidden;
    break-after: avoid;
  }
  h1 { font-size: 1.5cm; line-height: 1; font-weight: 800; letter-spacing: -0.02em; }
  .qr { width: 8.6cm; height: 8.6cm; }
  .qr svg { display: block; width: 100%; height: 100%; }
  p { font-size: 0.6cm; line-height: 1.3; font-weight: 600; }
  @media screen {
    body { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #e5e5e5; }
    .cartel { background: #ffffff; box-shadow: 0 0.1cm 0.4cm rgba(0, 0, 0, 0.25); }
  }
  @media print {
    html, body { width: 10cm; height: 15cm; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <main class="cartel">
    <h1>🔔 Timbre</h1>
    <div class="qr" role="img" aria-label="Código QR para tocar el timbre">${svg.trim()}</div>
    <p>Escaneá con la cámara de tu celular para avisarnos que llegaste</p>
  </main>
</body>
</html>
`;
await writeFile(`${SALIDA}cartel.html`, cartel);

console.log(`QR generado para ${URL_TIMBRE} en ${SALIDA}`);
