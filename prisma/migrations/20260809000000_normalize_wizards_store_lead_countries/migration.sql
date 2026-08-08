-- Normalize Wizards Store Locator Lead countries to CRM-supported country values.
-- This follows the original 12,692-row import and corrects 129 rows without changing store IDs.
-- Coverage includes 29 Hong Kong stores, 12 Turkey stores, and all previously unresolved aliases/codes.

DO $migration_guard$
DECLARE
    organization_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO organization_count
    FROM "Organization"
    WHERE "name" = 'Arcane Fortress';

    IF organization_count > 1 THEN
        RAISE EXCEPTION 'Wizards store Lead country normalization expected at most one organization named Arcane Fortress, found %', organization_count;
    END IF;
END;
$migration_guard$;

WITH target_organization AS (
    SELECT "id"
    FROM "Organization"
    WHERE "name" = 'Arcane Fortress'
), country_data AS (
    SELECT *
    FROM jsonb_to_recordset($wizard_store_country_data$
[
{"storeId":"22789","country":"Hong Kong"}
,{"storeId":"15472","country":"Czech Republic"}
,{"storeId":"11700","country":"Czech Republic"}
,{"storeId":"11371","country":"Czech Republic"}
,{"storeId":"11154","country":"Czech Republic"}
,{"storeId":"15951","country":"Czech Republic"}
,{"storeId":"16080","country":"Czech Republic"}
,{"storeId":"10946","country":"Czech Republic"}
,{"storeId":"23246","country":"Czech Republic"}
,{"storeId":"11743","country":"Czech Republic"}
,{"storeId":"13991","country":"Czech Republic"}
,{"storeId":"11692","country":"Czech Republic"}
,{"storeId":"12148","country":"Czech Republic"}
,{"storeId":"16079","country":"Czech Republic"}
,{"storeId":"21963","country":"Czech Republic"}
,{"storeId":"11659","country":"Czech Republic"}
,{"storeId":"17651","country":"Czech Republic"}
,{"storeId":"21662","country":"Czech Republic"}
,{"storeId":"6765","country":"Czech Republic"}
,{"storeId":"11771","country":"Czech Republic"}
,{"storeId":"11538","country":"Czech Republic"}
,{"storeId":"14880","country":"Czech Republic"}
,{"storeId":"22560","country":"Czech Republic"}
,{"storeId":"11056","country":"Czech Republic"}
,{"storeId":"13091","country":"Czech Republic"}
,{"storeId":"11890","country":"Czech Republic"}
,{"storeId":"22681","country":"Czech Republic"}
,{"storeId":"20041","country":"Czech Republic"}
,{"storeId":"8811","country":"Czech Republic"}
,{"storeId":"16992","country":"Czech Republic"}
,{"storeId":"11797","country":"Czech Republic"}
,{"storeId":"16949","country":"Czech Republic"}
,{"storeId":"18171","country":"Czech Republic"}
,{"storeId":"22052","country":"Czech Republic"}
,{"storeId":"13406","country":"Czech Republic"}
,{"storeId":"11212","country":"Czech Republic"}
,{"storeId":"11196","country":"Czech Republic"}
,{"storeId":"14014","country":"Czech Republic"}
,{"storeId":"21431","country":"Czech Republic"}
,{"storeId":"16575","country":"Czech Republic"}
,{"storeId":"14758","country":"Czech Republic"}
,{"storeId":"17202","country":"Czech Republic"}
,{"storeId":"13969","country":"Myanmar"}
,{"storeId":"22883","country":"Myanmar"}
,{"storeId":"21657","country":"Turkey"}
,{"storeId":"11855","country":"Turkey"}
,{"storeId":"11403","country":"Turkey"}
,{"storeId":"19755","country":"Turkey"}
,{"storeId":"20090","country":"Turkey"}
,{"storeId":"16146","country":"Turkey"}
,{"storeId":"20930","country":"Turkey"}
,{"storeId":"13864","country":"Turkey"}
,{"storeId":"21551","country":"Turkey"}
,{"storeId":"11806","country":"Turkey"}
,{"storeId":"11812","country":"Turkey"}
,{"storeId":"22691","country":"Turkey"}
,{"storeId":"11662","country":"Hong Kong"}
,{"storeId":"11009","country":"Hong Kong"}
,{"storeId":"15567","country":"Hong Kong"}
,{"storeId":"11557","country":"Hong Kong"}
,{"storeId":"21489","country":"Hong Kong"}
,{"storeId":"16674","country":"Hong Kong"}
,{"storeId":"14884","country":"Hong Kong"}
,{"storeId":"22204","country":"New Zealand"}
,{"storeId":"22843","country":"New Zealand"}
,{"storeId":"11053","country":"Hong Kong"}
,{"storeId":"22203","country":"Australia"}
,{"storeId":"16104","country":"Hong Kong"}
,{"storeId":"22096","country":"Australia"}
,{"storeId":"21878","country":"Canada"}
,{"storeId":"21879","country":"Canada"}
,{"storeId":"21880","country":"Canada"}
,{"storeId":"21881","country":"Canada"}
,{"storeId":"21882","country":"Canada"}
,{"storeId":"21883","country":"Canada"}
,{"storeId":"21884","country":"Canada"}
,{"storeId":"21885","country":"Canada"}
,{"storeId":"21886","country":"Canada"}
,{"storeId":"21887","country":"Canada"}
,{"storeId":"21888","country":"Canada"}
,{"storeId":"21889","country":"Canada"}
,{"storeId":"21890","country":"Canada"}
,{"storeId":"21891","country":"Canada"}
,{"storeId":"21892","country":"Canada"}
,{"storeId":"21893","country":"Canada"}
,{"storeId":"21894","country":"Canada"}
,{"storeId":"21895","country":"Canada"}
,{"storeId":"21896","country":"Canada"}
,{"storeId":"22638","country":"Australia"}
,{"storeId":"22383","country":"Australia"}
,{"storeId":"22879","country":"Australia"}
,{"storeId":"22463","country":"Singapore"}
,{"storeId":"10956","country":"Hong Kong"}
,{"storeId":"11021","country":"North Macedonia"}
,{"storeId":"22132","country":"United Arab Emirates"}
,{"storeId":"22099","country":"New Zealand"}
,{"storeId":"21875","country":"New Zealand"}
,{"storeId":"13841","country":"Hong Kong"}
,{"storeId":"13311","country":"Hong Kong"}
,{"storeId":"10954","country":"Hong Kong"}
,{"storeId":"11585","country":"Hong Kong"}
,{"storeId":"19373","country":"Hong Kong"}
,{"storeId":"19374","country":"Hong Kong"}
,{"storeId":"14861","country":"Hong Kong"}
,{"storeId":"11045","country":"Hong Kong"}
,{"storeId":"11085","country":"Hong Kong"}
,{"storeId":"12458","country":"Hong Kong"}
,{"storeId":"22097","country":"Australia"}
,{"storeId":"17252","country":"Bosnia and Herzegovina"}
,{"storeId":"19725","country":"Hong Kong"}
,{"storeId":"22098","country":"Australia"}
,{"storeId":"22280","country":"Australia"}
,{"storeId":"17688","country":"Hong Kong"}
,{"storeId":"22452","country":"South Korea"}
,{"storeId":"21611","country":"Hong Kong"}
,{"storeId":"16673","country":"Hong Kong"}
,{"storeId":"18521","country":"Hong Kong"}
,{"storeId":"21485","country":"Reunion"}
,{"storeId":"22100","country":"New Zealand"}
,{"storeId":"22453","country":"South Korea"}
,{"storeId":"22384","country":"Australia"}
,{"storeId":"22205","country":"Australia"}
,{"storeId":"22337","country":"Australia"}
,{"storeId":"9332","country":"Australia"}
,{"storeId":"16739","country":"Bosnia and Herzegovina"}
,{"storeId":"12724","country":"Hong Kong"}
,{"storeId":"11754","country":"Hong Kong"}
,{"storeId":"16041","country":"Hong Kong"}
,{"storeId":"20473","country":"Macau"}
]
$wizard_store_country_data$::jsonb) AS store_country(
        "storeId" TEXT,
        "country" TEXT
    )
)
UPDATE "Lead" AS lead
SET
    "country" = country_data."country",
    "updatedAt" = CURRENT_TIMESTAMP
FROM country_data
CROSS JOIN target_organization
WHERE lead."organizationId" = target_organization."id"
  AND lead."id" = 'lead-wizards-store-' || country_data."storeId" || '-' || SUBSTRING(MD5(target_organization."id"), 1, 12)
  AND lead."country" IS DISTINCT FROM country_data."country";


