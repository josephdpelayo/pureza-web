-- Ejecutar en Supabase SQL Editor
-- CORRER UNA SOLA VEZ. Importa el histórico de EMMANUEL.xlsx / JEEBE.xlsx (jul-ago
-- 2026) a la app, ahora que ya se puede clasificar por socio. Requiere haber corrido
-- antes migracion_restaurar_socio.sql. Es seguro re-ejecutarlo por accidente (cada
-- INSERT trae WHERE NOT EXISTS), PERO esa protección no detecta un movimiento que ya
-- se haya cargado a mano en la app durante ese periodo con cobrado_por/pagado_por en
-- NULL (así funcionaba antes) — antes de correr esto, revisa en los tabs Ingresos y
-- Gastos de finanzas.html que no haya ya movimientos de esas fechas/montos.
--
-- Totales verificados contra los Excel originales:
--   EMMANUEL: ingresos 38,072.13 · gastos 1,650.00 · saldo 36,422.13
--   JEEBE:    ingresos 42,365.00 · gastos 1,785.00 · saldo 40,580.00
--
-- created_at se pone igual a la fecha real del movimiento (no a "ahora") para que
-- estos 15 registros no aparezcan como recién ocurridos en "Actividad reciente".

-- ══ INGRESOS — EMMANUEL ══
insert into servicios_cobrados (descripcion, monto, cobrado_por, metodo_pago, fecha, created_at)
select 'Importado de Excel — Facturado', 4662.93, 'emmanuel', 'facturado', date '2026-08-08', timestamptz '2026-08-08 12:00:00'
where not exists (select 1 from servicios_cobrados where fecha = date '2026-08-08' and monto = 4662.93 and cobrado_por = 'emmanuel');

insert into servicios_cobrados (descripcion, monto, cobrado_por, metodo_pago, fecha, created_at)
select 'Importado de Excel — Efectivo', 3500, 'emmanuel', 'efectivo', date '2026-08-08', timestamptz '2026-08-08 12:00:00'
where not exists (select 1 from servicios_cobrados where fecha = date '2026-08-08' and monto = 3500 and cobrado_por = 'emmanuel');

insert into servicios_cobrados (descripcion, monto, cobrado_por, metodo_pago, fecha, created_at)
select 'Importado de Excel — Facturado', 1509.20, 'emmanuel', 'facturado', date '2026-08-15', timestamptz '2026-08-15 12:00:00'
where not exists (select 1 from servicios_cobrados where fecha = date '2026-08-15' and monto = 1509.20 and cobrado_por = 'emmanuel');

insert into servicios_cobrados (descripcion, monto, cobrado_por, metodo_pago, fecha, created_at)
select 'Importado de Excel — Efectivo', 10700, 'emmanuel', 'efectivo', date '2026-08-15', timestamptz '2026-08-15 12:00:00'
where not exists (select 1 from servicios_cobrados where fecha = date '2026-08-15' and monto = 10700 and cobrado_por = 'emmanuel');

insert into servicios_cobrados (descripcion, monto, cobrado_por, metodo_pago, fecha, created_at)
select 'Importado de Excel — Transferencia', 3700, 'emmanuel', 'transferencia', date '2026-08-22', timestamptz '2026-08-22 12:00:00'
where not exists (select 1 from servicios_cobrados where fecha = date '2026-08-22' and monto = 3700 and cobrado_por = 'emmanuel');

insert into servicios_cobrados (descripcion, monto, cobrado_por, metodo_pago, fecha, created_at)
select 'Importado de Excel — Efectivo', 14000, 'emmanuel', 'efectivo', date '2026-08-22', timestamptz '2026-08-22 12:00:00'
where not exists (select 1 from servicios_cobrados where fecha = date '2026-08-22' and monto = 14000 and cobrado_por = 'emmanuel');

-- ══ GASTOS — EMMANUEL ══
insert into pureza_gastos (tipo, descripcion, monto, pagado_por, fecha, created_at)
select 'gasolina', 'FACTURADO (GASOLINA)', 130, 'emmanuel', date '2026-08-22', timestamptz '2026-08-22 12:00:00'
where not exists (select 1 from pureza_gastos where fecha = date '2026-08-22' and monto = 130 and pagado_por = 'emmanuel');

insert into pureza_gastos (tipo, descripcion, monto, pagado_por, fecha, created_at)
select 'otros', 'EFECTIVO (CECATI)', 1520, 'emmanuel', date '2026-08-22', timestamptz '2026-08-22 12:00:00'
where not exists (select 1 from pureza_gastos where fecha = date '2026-08-22' and monto = 1520 and pagado_por = 'emmanuel');

-- ══ INGRESOS — JEEBE (todas SERVICIOS TRANSFERENCIAS) ══
insert into servicios_cobrados (descripcion, monto, cobrado_por, metodo_pago, fecha, created_at)
select 'Importado de Excel — Transferencia', 9100, 'jeebe', 'transferencia', date '2026-07-04', timestamptz '2026-07-04 12:00:00'
where not exists (select 1 from servicios_cobrados where fecha = date '2026-07-04' and monto = 9100 and cobrado_por = 'jeebe');

insert into servicios_cobrados (descripcion, monto, cobrado_por, metodo_pago, fecha, created_at)
select 'Importado de Excel — Transferencia', 16230, 'jeebe', 'transferencia', date '2026-07-11', timestamptz '2026-07-11 12:00:00'
where not exists (select 1 from servicios_cobrados where fecha = date '2026-07-11' and monto = 16230 and cobrado_por = 'jeebe');

insert into servicios_cobrados (descripcion, monto, cobrado_por, metodo_pago, fecha, created_at)
select 'Importado de Excel — Transferencia', 10335, 'jeebe', 'transferencia', date '2026-07-18', timestamptz '2026-07-18 12:00:00'
where not exists (select 1 from servicios_cobrados where fecha = date '2026-07-18' and monto = 10335 and cobrado_por = 'jeebe');

insert into servicios_cobrados (descripcion, monto, cobrado_por, metodo_pago, fecha, created_at)
select 'Importado de Excel — Transferencia', 3350, 'jeebe', 'transferencia', date '2026-07-25', timestamptz '2026-07-25 12:00:00'
where not exists (select 1 from servicios_cobrados where fecha = date '2026-07-25' and monto = 3350 and cobrado_por = 'jeebe');

insert into servicios_cobrados (descripcion, monto, cobrado_por, metodo_pago, fecha, created_at)
select 'Importado de Excel — Transferencia', 3350, 'jeebe', 'transferencia', date '2026-07-31', timestamptz '2026-07-31 12:00:00'
where not exists (select 1 from servicios_cobrados where fecha = date '2026-07-31' and monto = 3350 and cobrado_por = 'jeebe');

-- ══ GASTOS — JEEBE ══
insert into pureza_gastos (tipo, descripcion, monto, pagado_por, fecha, created_at)
select 'materiales', 'TRANSFERENCIAS (MAQUINA VAPOR)', 285, 'jeebe', date '2026-07-04', timestamptz '2026-07-04 12:00:00'
where not exists (select 1 from pureza_gastos where fecha = date '2026-07-04' and monto = 285 and pagado_por = 'jeebe');

insert into pureza_gastos (tipo, descripcion, monto, pagado_por, fecha, created_at)
select 'gasolina', 'FACTURADO- GASOLINA, FERRETERÍA', 1500, 'jeebe', date '2026-07-04', timestamptz '2026-07-04 12:00:00'
where not exists (select 1 from pureza_gastos where fecha = date '2026-07-04' and monto = 1500 and pagado_por = 'jeebe');
