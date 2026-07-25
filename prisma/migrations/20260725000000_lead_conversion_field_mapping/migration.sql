-- Carry lead segment data across on conversion instead of dropping it.
ALTER TABLE "Account" ADD COLUMN "rating" TEXT;
ALTER TABLE "Account" ADD COLUMN "numberOfEmployees" INTEGER;
ALTER TABLE "Account" ADD COLUMN "annualRevenue" DECIMAL(65,30);
ALTER TABLE "Account" ADD COLUMN "industry" TEXT;

ALTER TABLE "Contact" ADD COLUMN "leadSource" TEXT;

ALTER TABLE "Opportunity" ADD COLUMN "leadSource" TEXT;
