-- Restaura la columna descuento en cotizaciones (por si se llegó a correr
-- migracion_cotizador_simple.sql, que la eliminaba). Ahora el descuento
-- vuelve a estar disponible en el cotizador, pero opcional y oculto por
-- default — el usuario debe activarlo con el checkbox "+ Agregar descuento".
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS descuento numeric NOT NULL DEFAULT 0;
