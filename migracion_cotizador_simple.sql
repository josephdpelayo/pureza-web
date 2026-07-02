-- Ejecutar en Supabase SQL Editor (opcional, solo si quieres limpiar el schema)
-- Las cotizaciones ya no usan descuento ni socio (cuenta única de Pureza)
ALTER TABLE cotizaciones DROP COLUMN IF EXISTS descuento;
ALTER TABLE cotizaciones DROP COLUMN IF EXISTS socio;
