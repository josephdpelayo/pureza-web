-- Ejecutar en Supabase SQL Editor
-- Cadencia de renovación por servicio cobrado (varía por instancia, no es global).
-- null en renovacion_meses = ese servicio no requiere renovación.

alter table servicios_cobrados add column if not exists renovacion_meses integer;
alter table servicios_cobrados add column if not exists proxima_renovacion date;
alter table servicios_cobrados add column if not exists renovacion_notificada boolean not null default false;

create index if not exists servicios_cobrados_renovacion_idx
  on servicios_cobrados (proxima_renovacion)
  where renovacion_meses is not null and renovacion_notificada = false;
