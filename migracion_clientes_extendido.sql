-- Ejecutar en Supabase SQL Editor
-- Agrega notas y fecha de última edición a clientes (agenda de clientes).

alter table clientes add column if not exists notas text;
alter table clientes add column if not exists updated_at timestamptz default now();
