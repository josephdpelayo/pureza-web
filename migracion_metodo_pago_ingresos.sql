-- Ejecutar en Supabase SQL Editor
-- Método de pago por ingreso: efectivo / transferencia / facturado.
-- Nullable: los registros existentes quedan "sin clasificar".

alter table servicios_cobrados add column if not exists metodo_pago text
  check (metodo_pago in ('efectivo','transferencia','facturado'));
