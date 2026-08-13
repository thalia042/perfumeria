-- Ejecutar esto en Supabase > SQL Editor > New query > Run

create table perfumes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  marca text,
  precio numeric not null,
  categoria text not null check (categoria in ('mujer','hombre','nina','nino')),
  tamano text not null,
  en_stock boolean default true,
  foto_url text,
  created_at timestamp with time zone default now()
);

-- Cualquiera puede LEER el catálogo (para que se vea sin login)
alter table perfumes enable row level security;

create policy "Cualquiera puede ver el catalogo"
on perfumes for select
to anon
using (true);

-- Solo usuarios logueados (vos) pueden insertar/editar/borrar
create policy "Solo admin puede insertar"
on perfumes for insert
to authenticated
with check (true);

create policy "Solo admin puede editar"
on perfumes for update
to authenticated
using (true);

create policy "Solo admin puede borrar"
on perfumes for delete
to authenticated
using (true);

-- Bucket de almacenamiento para las fotos (crear manualmente en Storage
-- con el nombre "perfumes-fotos" y marcarlo como público). Luego correr:

create policy "Lectura publica de fotos"
on storage.objects for select
to anon
using (bucket_id = 'perfumes-fotos');

create policy "Solo admin sube fotos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'perfumes-fotos');
