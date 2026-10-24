-- Ejecutar en Supabase SQL Editor
-- Agrega datos fiscales a clientes y una tabla de facturas (CFDI) para la
-- facturación automática vía FacturAPI.

alter table clientes add column if not exists rfc text;
alter table clientes add column if not exists regimen_fiscal text;
alter table clientes add column if not exists uso_cfdi text;
alter table clientes add column if not exists codigo_postal text;
alter table clientes add column if not exists email_facturacion text;

create table if not exists facturas (
  id                   uuid primary key default gen_random_uuid(),
  origen               text not null check (origen in ('ingreso','cotizacion')),
  servicio_cobrado_id  uuid references servicios_cobrados(id) on delete set null,
  cotizacion_id        uuid references cotizaciones(id) on delete set null,
  cliente_id           uuid references clientes(id) on delete set null,
  cliente_nombre       text,
  receptor_rfc         text,
  facturapi_id         text,
  uuid_fiscal          text,
  serie                text,
  folio                text,
  total                numeric not null default 0,
  estado               text not null default 'timbrada' check (estado in ('timbrada','cancelada')),
  created_at           timestamptz default now()
);

create index if not exists facturas_servicio_cobrado_idx on facturas (servicio_cobrado_id);
create index if not exists facturas_cotizacion_idx       on facturas (cotizacion_id);
