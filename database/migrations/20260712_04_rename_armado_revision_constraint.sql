BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'armado_configuraciones_numero_version_not_null'
    ) THEN
        ALTER TABLE armado_configuraciones
            RENAME CONSTRAINT armado_configuraciones_numero_version_not_null
            TO armado_configuraciones_numero_revision_not_null;
    END IF;
END $$;

COMMIT;
