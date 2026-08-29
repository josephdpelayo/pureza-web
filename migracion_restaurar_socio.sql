-- Ejecutar en Supabase SQL Editor
-- Repone la clasificación por socio en ingresos y gastos.
-- Las columnas cobrado_por / pagado_por nunca se borraron (migracion_cuenta_unica.sql
-- solo quitó NOT NULL y el CHECK) — aquí solo se repone el CHECK. Siguen siendo
-- opcionales: NULL (sin clasificar) sigue siendo válido, igual que metodo_pago.

alter table servicios_cobrados
  add constraint servicios_cobrados_cobrado_por_check
  check (cobrado_por in ('emmanuel','jeebe','banco'));

alter table pureza_gastos
  add constraint pureza_gastos_pagado_por_check
  check (pagado_por in ('emmanuel','jeebe','banco'));
