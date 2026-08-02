-- Leads can be captured without a last name or company.
ALTER TABLE "Lead" ALTER COLUMN "lastName" DROP NOT NULL;
ALTER TABLE "Lead" ALTER COLUMN "company" DROP NOT NULL;
