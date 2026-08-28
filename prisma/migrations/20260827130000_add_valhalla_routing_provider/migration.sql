-- Adds the self-hosted engine as a selectable routing provider.
--
-- Additive only: existing rows keep whatever they hold, and nothing reads
-- 'VALHALLA' until an admin selects it AND the container is configured.
--
-- ALTER TYPE ... ADD VALUE is allowed inside a transaction on PostgreSQL 12+,
-- which both the NAS (postgres:16) and Neon satisfy. The new value is only
-- added here, never used in the same transaction, so the "unsafe use of new
-- value" restriction does not apply.

-- AlterEnum
ALTER TYPE "RoutingProviderSetting" ADD VALUE 'VALHALLA';
