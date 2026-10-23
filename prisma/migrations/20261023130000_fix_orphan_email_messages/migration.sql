-- Supprime les lignes EmailMessage orphelines (prospectId NULL), incompatibles
-- avec le schéma (champ non-nullable) et qui font planter toute requête
-- emailMessage.findMany() côté application (ex: tableau de bord, /reponses).
DELETE FROM "EmailMessage" WHERE "prospectId" IS NULL;
