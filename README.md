# Home&Heart

Marketplace de alojamiento, cuidado de niños y mascotas con proveedores verificados.

**Pila:** Next.js 16 (App Router) · React 19 · Tailwind 4 · Supabase (BD, auth, storage) · Stripe + Stripe Connect · Resend (email) · Upstash Redis (rate limiting) · Mapbox · PWA (next-pwa).

> Esta versión de Next.js tiene cambios respecto a lo habitual. Antes de tocar código de framework, consulta la documentación incluida en `node_modules/next/dist/docs/`.

## Arrancar en local

```bash
npm install
# crea .env.local (ver abajo)
npm run dev        # http://localhost:3000
```

`dev` y `build` usan `--webpack` porque `next-pwa` añade configuración de webpack que Turbopack no admite.

### Variables de entorno (`.env.local`)

El archivo está en `.gitignore`: nunca se sube. Pídelo a quien lo tenga o créalo con estas variables.

| Variable | Obligatoria | Para qué |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | URL del proyecto (`https://xxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sí | Clave pública de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | Clave de servidor (se salta la RLS; nunca en el cliente) |
| `NEXT_PUBLIC_URL` | Sí | URL base (`http://localhost:3000` en local) |
| `STRIPE_SECRET_KEY` | Sí | Pagos (usa `sk_test_…` fuera de producción) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Sí | Pagos en el navegador |
| `STRIPE_WEBHOOK_SECRET` | Pagos | Firma del webhook `/api/stripe/webhook` (`whsec_…`) |
| `STRIPE_WEBHOOK_SECRET_2` | No | Segundo secreto de webhook, si hay un segundo endpoint |
| `RESEND_API_KEY` | Emails | Envío de emails desde `soporte@homeandheart.es` |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapa | Mapa y geocodificación en `/buscar` |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Producción | Rate limiting. Si faltan, queda **desactivado** (solo un aviso en logs) |
| `CRON_SECRET` | Cron | Autoriza las llamadas a `/api/cron/*` |
| `CONFIRM_TOKEN_SECRET` | Emails | Firma los enlaces de confirmación de servicio |
| `ADMIN_EMAIL` / `ADMIN_USER_IDS` / `INTERNAL_EMAILS` | Admin | Quién es administrador y qué emails se tratan como internos |

Next solo lee `.env.local` al arrancar: reinicia `npm run dev` tras cambiarlo.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Build y servidor de producción |
| `npm test` | Tests unitarios (Vitest) |
| `npm run lint` | ESLint |

## Estructura

- `app/` — páginas (App Router) y `app/api/` (rutas de API: reservas, Stripe, admin, cron, chat…).
- `app/components/` — componentes de UI. `app/components/admin/` y `app/components/provider/` para paneles.
- `app/lib/` — lógica de negocio: precios (`pricing-reserva.js`), cancelaciones y reembolsos, reparto de incidencias, créditos, emails, RGPD, i18n (`i18n.js`, ES/EN).
- `lib/` — utilidades de autenticación de servidor (admin) y cliente Supabase de servidor.
- `proxy.ts` — refresca la sesión de Supabase en cada petición y redirige `?preview=1`.
- `supabase/migrations/` — migraciones SQL. **Ojo:** empiezan en mayo de 2026 y no crean las tablas base (`profiles`, `services`, `bookings`…), así que no bastan para recrear la base de datos desde cero.
- `tests/` — tests unitarios de la lógica de dinero.

## Tareas programadas

`vercel.json` programa `/api/cron/diario` a las 08:00 UTC (actualizar estados de reservas y liberar pagos, calcular tiempo de respuesta, secuencias de email, limpiar reservas retenidas huérfanas). Se puede lanzar a mano desde el panel de admin.

`/api/cron/retention` (limpieza RGPD) existe pero **no está programado** y todos los plazos de `app/lib/retention-policy.js` están en `null` hasta que el abogado los fije.

## Tests

```bash
npm test
```

Cubren la lógica pura de dinero: política de cancelación, reparto en cancelación del cliente, ingresos del proveedor, bote y capturas de incidencias, y cálculo de precios (incluido el cambio de hora de octubre/marzo en `Europe/Madrid`). No hay tests de integración ni de interfaz.

## Antes de lanzar

Pendiente de definir (ver también los `TODO LEGAL` del código): textos legales definitivos (aviso legal, privacidad, términos), plazos de retención RGPD, configuración de Stripe en modo live y su webhook, dominio de email en Resend y variables de entorno de producción en Vercel.
