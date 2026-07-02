-- Ejecutar en Supabase SQL Editor
-- Cuenta única de Pureza: ya no se rastrea quién cobró/pagó cada movimiento

ALTER TABLE servicios_cobrados ALTER COLUMN cobrado_por DROP NOT NULL;
ALTER TABLE servicios_cobrados DROP CONSTRAINT IF EXISTS servicios_cobrados_cobrado_por_check;

ALTER TABLE pureza_gastos ALTER COLUMN pagado_por DROP NOT NULL;
ALTER TABLE pureza_gastos DROP CONSTRAINT IF EXISTS pureza_gastos_pagado_por_check;
