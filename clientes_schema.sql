-- Ejecutar en Supabase SQL Editor
-- https://app.supabase.com → SQL Editor

create table if not exists clientes (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  domicilio  text,
  telefono   text,
  created_at timestamptz default now()
);

-- Índice para búsqueda rápida por nombre
create index if not exists clientes_nombre_idx on clientes (nombre);
