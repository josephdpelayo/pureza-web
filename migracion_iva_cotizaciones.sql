-- Ejecutar en Supabase SQL Editor
-- Agrega soporte para cotizaciones que requieren factura con IVA.

alter table cotizaciones add column if not exists total_sin_iva numeric not null default 0;
alter table cotizaciones add column if not exists requiere_factura boolean not null default false;
alter table cotizaciones add column if not exists iva_tasa numeric not null default 0;
alter table cotizaciones add column if not exists iva numeric not null default 0;

update cotizaciones
set total_sin_iva = greatest(0, subtotal - descuento)
where total_sin_iva = 0;
