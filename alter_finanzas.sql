-- Ejecutar en Supabase SQL Editor

-- 1. Crear la tabla correcta para gastos de PUREZA (separada de AutoImport)
create table if not exists pureza_gastos (
  id              uuid primary key default gen_random_uuid(),
  tipo            text not null check(tipo in ('gasolina','productos_quimicos','publicidad','materiales','otros')),
  descripcion     text,
  monto           numeric not null check(monto >= 0),
  pagado_por      text not null check(pagado_por in ('emmanuel','jeebe','banco')),
  comprobante_url text,
  fecha           date not null default current_date,
  created_at      timestamptz default now()
);

-- 2. Agregar columna caja_chica a cortes (usada como "queda en banco")
ALTER TABLE cortes ADD COLUMN IF NOT EXISTS caja_chica numeric not null default 0;

-- 3. Agregar comprobante a gastos existentes (si ya creaste la tabla antes)
ALTER TABLE pureza_gastos ADD COLUMN IF NOT EXISTS comprobante_url text;

-- 4. Crear bucket pureza-comprobantes en Supabase Storage (hacer manualmente):
--    Storage → New bucket → Name: "pureza-comprobantes" → Public: ON
