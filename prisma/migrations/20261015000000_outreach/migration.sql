-- Contacto desde el Prospector: mensajes preparados por el worker, números por probar,
-- historial del contacto y el nombre con que firma cada usuario. Solo agrega columnas.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "displayName" TEXT;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "outreach" JSONB,
ADD COLUMN     "contactNumber" TEXT,
ADD COLUMN     "contactLog" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "contactedAt" TIMESTAMP(3);
