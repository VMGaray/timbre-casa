# Timbre inteligente 🔔

Un timbre para la puerta de casa que avisa por Telegram.

## Qué hace

1. En la puerta hay un QR que abre la página principal (`/`).
2. Quien llega puede escribir su nombre y un motivo (las dos cosas son opcionales) y toca **"Tocar timbre"**.
3. El servidor guarda el toque en Supabase y manda un mensaje por Telegram a todos los destinatarios activos.
4. El mensaje trae botones de respuesta rápida (🏃 Ya voy, ⏳ Esperá un momento, 📦 Dejalo en la puerta, 🚫 No estoy, volvé más tarde). También se puede responder al mensaje (reply) con un texto libre.
5. Cuando alguien responde, se guarda la respuesta y se editan los mensajes de **todos** los destinatarios con la línea "✅ Respondido: …". Los botones quedan, así se puede cambiar la respuesta.
6. La página del visitante consulta cada 3 segundos y muestra la respuesta, sin decir quién respondió. Si en 10 minutos nadie contesta, deja de consultar y lo avisa.

Hay un honeypot contra bots y un límite global de un toque por minuto.

## Stack

- Next.js (App Router, TypeScript, Tailwind CSS)
- Supabase (`@supabase/supabase-js`), solo desde el servidor con la `service_role` key
- API oficial de bots de Telegram
- Deploy en Vercel

## Estructura

```
src/
  app/
    page.tsx                 Página principal
    layout.tsx               Metadata (title "Timbre", noindex/nofollow)
    api/tocar/route.ts       POST: registra el toque y avisa por Telegram
    api/toque/[id]/route.ts  GET: { respondido, respuesta }
    api/telegram/route.ts    Webhook del bot
  components/Timbre.tsx      Formulario, espera y respuesta (cliente)
  lib/
    supabase.ts              Cliente de Supabase (server-only, schema "timbre")
    telegram.ts              sendMessage, editMessageText, answerCallbackQuery
    textos.ts                Códigos de botón -> texto de respuesta
    avisos.ts                Armado del mensaje, teclado y edición de mensajes
```

## Base de datos

Las tablas ya existen en el schema `timbre` del proyecto de Supabase (expuesto en la Data API). Esta app **no** crea tablas ni corre migraciones:

- `timbre.destinatarios` (id, nombre, chat_id, activo, created_at)
- `timbre.toques` (id, nombre, motivo, respuesta, respondido_at, created_at)
- `timbre.mensajes` (id, toque_id, chat_id, message_id)

## Variables de entorno

Todas son **solo de servidor** (no se usa ninguna `NEXT_PUBLIC_*`). Están listadas en `.env.example`:

| Variable | Qué es |
| --- | --- |
| `SUPABASE_URL` | URL del proyecto de Supabase (`https://xxxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave `service_role` del proyecto. No la compartas nunca. |
| `TELEGRAM_BOT_TOKEN` | Token del bot que te da [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_WEBHOOK_SECRET` | Un texto secreto que inventás vos (1 a 256 caracteres: letras, números, `_` y `-`) |

Para generar un secreto en PowerShell:

```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 40 | ForEach-Object { [char]$_ })
```

## Correrlo local

```powershell
npm install
Copy-Item .env.example .env.local
# Completá .env.local con tus valores
npm run dev
```

Abrí http://localhost:3000. Para probar el webhook en local necesitás exponer tu máquina con un túnel (por ejemplo `ngrok http 3000`) y registrar esa URL como webhook (ver más abajo). Ojo: si después volvés a usar la URL de producción, tenés que registrar el webhook de nuevo.

## Deploy en Vercel

1. Subí el repo a GitHub.
2. En [vercel.com](https://vercel.com) → **Add New… → Project** → importá el repo (Vercel detecta Next.js solo).
3. En **Settings → Environment Variables** cargá las cuatro variables de arriba.
4. Hacé el deploy. Si cambiás variables después, hacé un **Redeploy** para que se apliquen.
5. Generá el QR con la URL de producción (por ejemplo `https://tu-proyecto.vercel.app`) y pegalo en la puerta.

## Registrar el webhook de Telegram

Una vez deployado, decile a Telegram adónde mandar los mensajes del bot. En PowerShell:

```powershell
$token  = "<TELEGRAM_BOT_TOKEN>"
$secret = "<TELEGRAM_WEBHOOK_SECRET>"
$body = @{
  url             = "https://<dominio>/api/telegram"
  secret_token    = $secret
  allowed_updates = @("message", "callback_query")
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$token/setWebhook" -ContentType "application/json" -Body $body
```

Para verificar que quedó bien:

```powershell
Invoke-RestMethod "https://api.telegram.org/bot$token/getWebhookInfo"
```

Si aparece `last_error_message` con un 401, el `secret_token` no coincide con `TELEGRAM_WEBHOOK_SECRET`.

## Dar de alta un destinatario nuevo

1. La persona abre el bot en Telegram y le manda `/start` (o cualquier mensaje).
2. El bot le contesta: "Hola 👋 Tu ID es 123456789…". Te pasa ese número.
3. En Supabase → **SQL Editor**, corré:

```sql
insert into timbre.destinatarios (nombre, chat_id, activo)
values ('Nombre de la persona', 123456789, true);
```

Desde ese momento recibe los avisos. Para pausar a alguien sin borrarlo:

```sql
update timbre.destinatarios set activo = false where chat_id = 123456789;
```

## Detalles

- Los avisos de más de 24 h ya no se pueden responder ("Este aviso ya expiró").
- Si varios destinatarios responden, queda la respuesta más reciente.
- Las respuestas por reply se recortan a 200 caracteres.
- La hora del aviso se muestra en la zona `America/Argentina/Cordoba`.
