BEGIN;

ALTER TABLE public.cotizaciones
    ADD COLUMN IF NOT EXISTS tipo_precio character varying(20) DEFAULT 'minorista'::character varying NOT NULL;

ALTER TABLE public.cotizaciones
    DROP CONSTRAINT IF EXISTS chk_cotizaciones_tipo_precio;

ALTER TABLE public.cotizaciones
    ADD CONSTRAINT chk_cotizaciones_tipo_precio
    CHECK ((tipo_precio)::text = ANY ((ARRAY['minorista'::character varying, 'mayorista'::character varying])::text[]));

UPDATE public.cotizaciones
SET tipo_precio = 'minorista'
WHERE tipo_precio IS NULL;

COMMIT;
