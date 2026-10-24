-- Ejecutar en Supabase SQL Editor
-- Guarda el desglose por socio (Emmanuel=efectivo, Jeebe=transferencias) de cada
-- corte guardado, para que el historial lo conserve igual que hoy se reporta por
-- WhatsApp. El detalle itemizado se sigue calculando al vuelo desde
-- servicios_cobrados/pureza_gastos; aquí solo se guardan los totales.

ALTER TABLE cortes ADD COLUMN IF NOT EXISTS ingresos_emmanuel numeric not null default 0;
ALTER TABLE cortes ADD COLUMN IF NOT EXISTS gastos_emmanuel   numeric not null default 0;
ALTER TABLE cortes ADD COLUMN IF NOT EXISTS ingresos_jeebe    numeric not null default 0;
ALTER TABLE cortes ADD COLUMN IF NOT EXISTS gastos_jeebe      numeric not null default 0;
ALTER TABLE cortes ADD COLUMN IF NOT EXISTS ingresos_banco    numeric not null default 0;
ALTER TABLE cortes ADD COLUMN IF NOT EXISTS gastos_banco      numeric not null default 0;
