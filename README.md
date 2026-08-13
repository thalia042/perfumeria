# Catálogo de Perfumes — guía de despliegue

Programa completo: catálogo público con filtros (categoría y tamaño) +
panel privado en `/admin` para vos, donde cargás, editás y borrás perfumes
(con foto incluida).

## 1. Crear el proyecto en Supabase (base de datos + fotos + login)

1. Andá a https://supabase.com → **New project** (gratis).
2. Cuando esté listo, abrí **SQL Editor** → **New query**, pegá todo el
   contenido de `supabase/schema.sql` y dale **Run**.
3. Andá a **Storage** → **New bucket** → nombre exacto: `perfumes-fotos`
   → marcalo como **Public bucket**.
4. Andá a **Authentication** → **Users** → **Add user** → creá tu propio
   usuario (el email y contraseña con los que vas a entrar a `/admin`).
5. Andá a **Project Settings** → **API** y copiá:
   - `Project URL`
   - `anon public` key

## 2. Configurar el proyecto localmente

```bash
cp .env.local.example .env.local
```

Pegá adentro la `Project URL` y la `anon public key` que copiaste.

```bash
npm install
npm run dev
```

Abrí `http://localhost:3000` (catálogo) y `http://localhost:3000/admin`
(panel, te va a pedir el login que creaste en el paso 1.4).

## 3. Subir a GitHub

```bash
git init
git add .
git commit -m "Catálogo de perfumes"
```

Creá un repo en GitHub y subilo (`git remote add origin ...` + `git push`).

## 4. Desplegar en Vercel

1. Entrá a https://vercel.com con tu cuenta de GitHub.
2. **Add New Project** → elegí el repo que subiste.
3. En **Environment Variables** agregá las mismas dos variables de tu
   `.env.local` (`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
4. **Deploy**. En 1-2 minutos te da una URL tipo `tu-proyecto.vercel.app`
   ya funcionando.

## 5. Tu dirección web (gratis, sin comprar dominio)

Al desplegar, Vercel te da automáticamente una dirección gratis y
permanente del estilo:

```
tu-proyecto.vercel.app
```

Es pública, la puede abrir cualquiera, y no cuesta nada. En el paso de
deploy podés elegir el nombre (ej. `perfumeria-nombre.vercel.app`). Esa
es la que compartís por WhatsApp, Instagram o cartel en el local.

Si en el futuro querés pasarte a un dominio propio (ej. `.com` o
`.com.ar`), simplemente lo comprás y lo conectás desde **Project →
Settings → Domains** — no hay que tocar nada más del proyecto.

## Uso del día a día

- **Catálogo público**: `tu-proyecto.vercel.app` — lo ve cualquiera, sin login.
- **Panel privado**: `tu-proyecto.vercel.app/admin` — te pide tu email/contraseña.
  Ahí cargás perfumes nuevos, subís foto, marcás "sin stock" cuando se
  vende, editás precio, o lo borrás.
- Cada cambio que hagas en `/admin` se refleja al instante en el catálogo
  público — no hay que volver a desplegar nada.

## Carga inicial de tus ~30 perfumes

Lo más rápido: entrá a `/admin` y cargalos uno por uno con el formulario
(nombre, marca, precio, categoría, tamaño, foto). Con 30 perfumes son
unos 15-20 minutos. Si querés, después te puedo armar un script para
importarlos todos de una desde una planilla de Excel.
