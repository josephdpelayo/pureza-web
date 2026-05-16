-- Ejecutar en Supabase SQL Editor (después de clientes_schema.sql)

-- Cotizaciones guardadas con folio
create table if not exists cotizaciones (
  id             uuid primary key default gen_random_uuid(),
  folio          text unique not null,
  cliente_id     uuid references clientes(id) on delete set null,
  cliente_nombre text,
  items          jsonb not null default '[]',
  subtotal       numeric not null default 0,
  descuento      numeric not null default 0,
  total          numeric not null default 0,
  created_at     timestamptz default now()
);
create index if not exists cotizaciones_folio_idx   on cotizaciones (folio);
create index if not exists cotizaciones_cliente_idx on cotizaciones (cliente_nombre);

-- Servicios cobrados (ingresos)
create table if not exists servicios_cobrados (
  id               uuid primary key default gen_random_uuid(),
  cotizacion_id    uuid references cotizaciones(id) on delete set null,
  folio_cotizacion text,
  cliente_id       uuid references clientes(id) on delete set null,
  cliente_nombre   text,
  descripcion      text,
  monto            numeric not null check(monto >= 0),
  cobrado_por      text not null check(cobrado_por in ('emmanuel','jeebe','banco')),
  fecha            date not null default current_date,
  created_at       timestamptz default now()
);

-- Gastos
create table if not exists gastos (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null check(tipo in ('gasolina','productos_quimicos','publicidad','materiales','otros')),
  descripcion text,
  monto       numeric not null check(monto >= 0),
  pagado_por  text not null check(pagado_por in ('emmanuel','jeebe','banco')),
  fecha       date not null default current_date,
  created_at  timestamptz default now()
);

-- Cortes de caja semanales
create table if not exists cortes (
  id                uuid primary key default gen_random_uuid(),
  fecha_inicio      date not null,
  fecha_fin         date not null,
  efectivo_emmanuel numeric not null default 0,
  efectivo_jeebe    numeric not null default 0,
  transferencias    numeric not null default 0,
  total_ingresos    numeric not null default 0,
  gastos_emmanuel   numeric not null default 0,
  gastos_jeebe      numeric not null default 0,
  gastos_banco      numeric not null default 0,
  total_gastos      numeric not null default 0,
  ganancia          numeric not null default 0,
  reparto_emmanuel  numeric not null default 0,
  reparto_jeebe     numeric not null default 0,
  fondo_ahorro      numeric not null default 0,
  notas             text,
  created_at        timestamptz default now()
);
