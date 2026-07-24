import assert from "node:assert/strict";
import test from "node:test";
import {
  desiredSmtpConfig,
  smtpConfigMatches,
  validateEmailEnvironment
} from "./configure-keycloak-email.mjs";

const environment = {
  AUTH_KEYCLOAK_ISSUER: "https://identity.example.com/realms/crm",
  AUTH_KEYCLOAK_ADMIN_CLIENT_ID: "crm-admin",
  AUTH_KEYCLOAK_ADMIN_CLIENT_SECRET: "admin-secret",
  SENDGRID_API_KEY: "sendgrid-key",
  SENDGRID_EMAIL: "notifications@example.com"
};

test("Keycloak SMTP configuration uses the SendGrid relay without exposing alternate transport choices", () => {
  const smtp = desiredSmtpConfig(environment);
  assert.deepEqual(smtp, {
    host: "smtp.sendgrid.net",
    port: "587",
    from: "notifications@example.com",
    fromDisplayName: "Reloriq",
    replyTo: "notifications@example.com",
    replyToDisplayName: "Reloriq",
    auth: "true",
    user: "apikey",
    password: "sendgrid-key",
    starttls: "true",
    ssl: "false"
  });
  assert.equal(smtpConfigMatches({ ...smtp, password: "**********" }, smtp), true);
  assert.equal(smtpConfigMatches({ ...smtp, starttls: "false" }, smtp), false);
});

test("Keycloak SMTP configuration fails safely when required values are absent", () => {
  assert.doesNotThrow(() => validateEmailEnvironment(environment));
  assert.throws(
    () => validateEmailEnvironment({ ...environment, SENDGRID_API_KEY: "" }),
    /SENDGRID_API_KEY/
  );
  assert.throws(
    () => validateEmailEnvironment({ ...environment, SENDGRID_EMAIL: "not-an-email" }),
    /valid email/
  );
  assert.doesNotThrow(() => validateEmailEnvironment({
    ...environment,
    AUTH_KEYCLOAK_ADMIN_CLIENT_ID: "",
    AUTH_KEYCLOAK_ADMIN_CLIENT_SECRET: "",
    KEYCLOAK_REALM_ADMIN_CLIENT_ID: "realm-config",
    KEYCLOAK_REALM_ADMIN_CLIENT_SECRET: "realm-config-secret"
  }));
});
