BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.cotizaciones_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.cotizaciones_numero_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE IF NOT EXISTS public.cotizaciones (
    id bigint NOT NULL DEFAULT nextval('public.cotizaciones_id_seq'::regclass),
    numero character varying(30) NOT NULL DEFAULT ('COT-'::text || lpad((nextval('public.cotizaciones_numero_seq'::regclass))::text, 6, '0'::text)),
    tipo character varying(20) NOT NULL,
    estado character varying(20) DEFAULT 'borrador'::character varying NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    fecha_validez date,
    id_sucursal bigint NOT NULL,
    id_cliente bigint,
    cliente_nombre_snapshot character varying(150),
    cliente_telefono_snapshot character varying(50),
    id_bicicleta_cliente bigint,
    problema_reportado text,
    observaciones text,
    subtotal numeric(14,2) DEFAULT 0 NOT NULL,
    descuento_total numeric(14,2) DEFAULT 0 NOT NULL,
    recargo_total numeric(14,2) DEFAULT 0 NOT NULL,
    total_final numeric(14,2) DEFAULT 0 NOT NULL,
    id_usuario_creador bigint NOT NULL,
    id_usuario_actualiza bigint,
    id_venta_convertida bigint,
    id_orden_taller_convertida bigint,
    fecha_convertida timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cotizaciones_pkey PRIMARY KEY (id),
    CONSTRAINT cotizaciones_numero_key UNIQUE (numero),
    CONSTRAINT chk_cotizaciones_tipo CHECK (((tipo)::text = ANY ((ARRAY['venta'::character varying, 'reparacion'::character varying])::text[]))),
    CONSTRAINT chk_cotizaciones_estado CHECK (((estado)::text = ANY ((ARRAY['borrador'::character varying, 'enviada'::character varying, 'aceptada'::character varying, 'convertida'::character varying, 'rechazada'::character varying, 'vencida'::character varying, 'cancelada'::character varying])::text[]))),
    CONSTRAINT chk_cotizaciones_montos_no_negativos CHECK (((subtotal >= (0)::numeric) AND (descuento_total >= (0)::numeric) AND (recargo_total >= (0)::numeric) AND (total_final >= (0)::numeric))),
    CONSTRAINT chk_cotizaciones_conversion_por_tipo CHECK ((((tipo)::text = 'venta'::text) OR (id_venta_convertida IS NULL))),
    CONSTRAINT chk_cotizaciones_conversion_taller_por_tipo CHECK ((((tipo)::text = 'reparacion'::text) OR (id_orden_taller_convertida IS NULL))),
    CONSTRAINT chk_cotizaciones_convertida_referencia CHECK ((((estado)::text <> 'convertida'::text) OR (id_venta_convertida IS NOT NULL) OR (id_orden_taller_convertida IS NOT NULL)))
);

ALTER SEQUENCE public.cotizaciones_id_seq OWNED BY public.cotizaciones.id;
ALTER SEQUENCE public.cotizaciones_numero_seq OWNED BY public.cotizaciones.numero;

CREATE SEQUENCE IF NOT EXISTS public.cotizacion_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE IF NOT EXISTS public.cotizacion_items (
    id bigint NOT NULL DEFAULT nextval('public.cotizacion_items_id_seq'::regclass),
    id_cotizacion bigint NOT NULL,
    tipo_item character varying(30) NOT NULL,
    id_variante bigint,
    id_servicio_taller bigint,
    descripcion_snapshot character varying(255) NOT NULL,
    cantidad numeric(14,3) DEFAULT 1 NOT NULL,
    precio_unitario numeric(14,2) DEFAULT 0 NOT NULL,
    descuento_monto numeric(14,2) DEFAULT 0 NOT NULL,
    subtotal numeric(14,2) DEFAULT 0 NOT NULL,
    costo_unitario_referencia numeric(14,4),
    notas text,
    orden integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cotizacion_items_pkey PRIMARY KEY (id),
    CONSTRAINT chk_cotizacion_items_tipo CHECK (((tipo_item)::text = ANY ((ARRAY['producto'::character varying, 'servicio_taller'::character varying, 'linea_libre'::character varying])::text[]))),
    CONSTRAINT chk_cotizacion_items_referencia_por_tipo CHECK (((((tipo_item)::text = 'producto'::text) AND (id_variante IS NOT NULL) AND (id_servicio_taller IS NULL)) OR (((tipo_item)::text = 'servicio_taller'::text) AND (id_variante IS NULL) AND (id_servicio_taller IS NOT NULL)) OR (((tipo_item)::text = 'linea_libre'::text) AND (id_variante IS NULL) AND (id_servicio_taller IS NULL)))),
    CONSTRAINT chk_cotizacion_items_cantidad_positiva CHECK ((cantidad > (0)::numeric)),
    CONSTRAINT chk_cotizacion_items_montos_no_negativos CHECK (((precio_unitario >= (0)::numeric) AND (descuento_monto >= (0)::numeric) AND (subtotal >= (0)::numeric) AND ((costo_unitario_referencia IS NULL) OR (costo_unitario_referencia >= (0)::numeric))))
);

ALTER SEQUENCE public.cotizacion_items_id_seq OWNED BY public.cotizacion_items.id;

ALTER TABLE ONLY public.cotizaciones
    ADD CONSTRAINT cotizaciones_id_sucursal_fkey FOREIGN KEY (id_sucursal) REFERENCES public.sucursales(id);

ALTER TABLE ONLY public.cotizaciones
    ADD CONSTRAINT cotizaciones_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.clientes(id);

ALTER TABLE ONLY public.cotizaciones
    ADD CONSTRAINT cotizaciones_id_bicicleta_cliente_fkey FOREIGN KEY (id_bicicleta_cliente) REFERENCES public.bicicletas_clientes(id);

ALTER TABLE ONLY public.cotizaciones
    ADD CONSTRAINT cotizaciones_id_usuario_creador_fkey FOREIGN KEY (id_usuario_creador) REFERENCES public.usuarios(id);

ALTER TABLE ONLY public.cotizaciones
    ADD CONSTRAINT cotizaciones_id_usuario_actualiza_fkey FOREIGN KEY (id_usuario_actualiza) REFERENCES public.usuarios(id);

ALTER TABLE ONLY public.cotizaciones
    ADD CONSTRAINT cotizaciones_id_venta_convertida_fkey FOREIGN KEY (id_venta_convertida) REFERENCES public.ventas(id);

ALTER TABLE ONLY public.cotizaciones
    ADD CONSTRAINT cotizaciones_id_orden_taller_convertida_fkey FOREIGN KEY (id_orden_taller_convertida) REFERENCES public.ordenes_taller(id);

ALTER TABLE ONLY public.cotizacion_items
    ADD CONSTRAINT cotizacion_items_id_cotizacion_fkey FOREIGN KEY (id_cotizacion) REFERENCES public.cotizaciones(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cotizacion_items
    ADD CONSTRAINT cotizacion_items_id_variante_fkey FOREIGN KEY (id_variante) REFERENCES public.variantes(id);

ALTER TABLE ONLY public.cotizacion_items
    ADD CONSTRAINT cotizacion_items_id_servicio_taller_fkey FOREIGN KEY (id_servicio_taller) REFERENCES public.servicios_taller(id);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_tipo_estado ON public.cotizaciones USING btree (tipo, estado);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_fecha ON public.cotizaciones USING btree (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_cliente ON public.cotizaciones USING btree (id_cliente);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_bicicleta_cliente ON public.cotizaciones USING btree (id_bicicleta_cliente);
CREATE INDEX IF NOT EXISTS idx_cotizacion_items_cotizacion ON public.cotizacion_items USING btree (id_cotizacion, orden, id);

COMMIT;
