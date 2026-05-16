-- Ejecutar en Supabase SQL Editor

-- 1. Crear la tabla correcta para gastos de PUREZA (separada de AutoImport)
create table if not exists pureza_gastos (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null check(tipo in ('gasolina','productos_quimicos','publicidad','materiales','otros')),
  descripcion text,
  monto       numeric not null check(monto >= 0),
  pagado_por  text not null check(pagado_por in ('emmanuel','jeebe','banco')),
  fecha       date not null default current_date,
  created_at  timestamptz default now()
);

-- 2. Agregar columna caja_chica a cortes (si no existe)
ALTER TABLE cortes ADD COLUMN IF NOT EXISTS caja_chica numeric not null default 0;
