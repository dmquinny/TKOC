-- One-time recovery for a deployment that stopped at query 7 of
-- 20260726090000_audit_hardening with MySQL error 1553.
--
-- The failed DROP INDEX did not change ResearchOrder. MySQL had already
-- committed the two preceding ALTER TABLE statements, so remove only those
-- additions before Prisma marks the attempt rolled back and reapplies the
-- corrected migration.
ALTER TABLE `User`
  DROP INDEX `User_username_key`,
  DROP INDEX `User_email_key`,
  DROP COLUMN `sessionVersion`;

ALTER TABLE `Province`
  DROP INDEX `Province_provinceName_key`,
  DROP COLUMN `status`,
  DROP COLUMN `attackPressure`;
