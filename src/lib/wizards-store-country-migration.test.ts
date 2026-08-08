import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { COUNTRIES } from "./crm-metadata/geographic";

type SourceStore = {
  storeId: string;
  country: string;
};

type CountryCorrection = {
  storeId: string;
  country: string;
};

function migrationJson<T>(migrationPath: string, marker: string): T {
  const sql = readFileSync(resolve(process.cwd(), migrationPath), "utf8");
  const startToken = `$${marker}$\n`;
  const endToken = `\n$${marker}$::jsonb`;
  const start = sql.indexOf(startToken);
  const end = sql.indexOf(endToken, start + startToken.length);

  assert.notEqual(start, -1, `Missing ${startToken.trim()} in ${migrationPath}`);
  assert.notEqual(end, -1, `Missing closing ${endToken.trim()} in ${migrationPath}`);

  return JSON.parse(sql.slice(start + startToken.length, end)) as T;
}

test("Wizards store country migration leaves every imported lead filterable", () => {
  const sourceStores = migrationJson<SourceStore[]>(
    "prisma/migrations/20260807000000_import_wizards_stores_as_arcane_fortress_leads/migration.sql",
    "wizard_store_data"
  );
  const corrections = migrationJson<CountryCorrection[]>(
    "prisma/migrations/20260809000000_normalize_wizards_store_lead_countries/migration.sql",
    "wizard_store_country_data"
  );

  assert.equal(sourceStores.length, 12_692);
  assert.equal(new Set(sourceStores.map((store) => store.storeId)).size, sourceStores.length);
  assert.equal(corrections.length, 129);
  assert.equal(new Set(corrections.map((store) => store.storeId)).size, corrections.length);

  const sourceIds = new Set(sourceStores.map((store) => store.storeId));
  for (const correction of corrections) {
    assert.ok(sourceIds.has(correction.storeId), `Unknown corrected store ${correction.storeId}`);
  }

  const correctionById = new Map(corrections.map((store) => [store.storeId, store.country]));
  const finalStores = sourceStores.map((store) => ({
    ...store,
    country: correctionById.get(store.storeId) ?? store.country
  }));
  const allowedCountries = new Set<string>(COUNTRIES);
  const unsupported = finalStores.filter((store) => !allowedCountries.has(store.country));

  assert.deepEqual(unsupported, []);
  assert.equal(finalStores.filter((store) => store.country === "Unspecified").length, 0);
  assert.equal(finalStores.filter((store) => store.country === "Hong Kong").length, 29);
  assert.equal(finalStores.filter((store) => store.country === "Turkey").length, 12);
  assert.equal(finalStores.filter((store) => store.country === "Czech Republic").length, 41);
  assert.equal(finalStores.filter((store) => store.country === "Myanmar").length, 2);
  assert.equal(finalStores.filter((store) => store.country === "Guam").length, 2);
  assert.equal(finalStores.filter((store) => store.country === "Puerto Rico").length, 22);
});
