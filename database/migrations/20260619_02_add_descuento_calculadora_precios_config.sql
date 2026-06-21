ALTER TABLE public.configuracion_negocio
ADD COLUMN IF NOT EXISTS porcentaje_descuento_contado_calculadora_precios numeric(6,3) NOT NULL DEFAULT 10.000;
