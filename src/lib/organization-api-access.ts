import "server-only";

import type { OrganizationApiAccess } from "@prisma/client";
import type { OrganizationApiAccessDto, OrganizationApiAccessMutationDto } from "@/lib/api/contracts";
import { apiFailure } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { generateApiToken, generateWebhookSecret, tokenPreview } from "@/lib/public-api/token";
import { sendLeadWebhookTest } from "@/lib/public-api/webhook-delivery";
import { validateWebhookUrl, WebhookUrlError } from "@/lib/public-api/webhook-url";
import { resolvePublicAppUrl } from "@/lib/public-app-url";
import { decryptSecret, encryptSecret, maskSecret, secretEncryptionConfigured } from "@/lib/secret-encryption";

export class OrganizationApiAccessError extends Error {
  constructor(
    message: string,
    readonly status: number = 400
  ) {
    super(message);
    this.name = "OrganizationApiAccessError";
  }
}

function isoOrNull(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function assertEncryptionConfigured() {
  if (secretEncryptionConfigured()) return;
  throw new OrganizationApiAccessError(
    "Set INTEGRATION_ENCRYPTION_KEY (or AUTH_SECRET) before saving webhook secrets.",
    503
  );
}

export async function loadOrganizationApiAccess(organizationId: string) {
  return prisma.organizationApiAccess.findUnique({ where: { organizationId } });
}

export async function ensureOrganizationApiAccess(organizationId: string) {
  const existing = await loadOrganizationApiAccess(organizationId);
  if (existing) return existing;
  return prisma.organizationApiAccess.create({ data: { organizationId } });
}

export function organizationApiAccessDto(
  access: OrganizationApiAccess | null,
  extras: { token?: string; webhookSecret?: string } = {}
): OrganizationApiAccessMutationDto {
  const secret = access?.webhookSecretCipher ? decryptSecret(access.webhookSecretCipher) : null;
  return {
    hasToken: Boolean(access?.tokenHash),
    tokenPreview: tokenPreview(access?.tokenPrefix),
    tokenCreatedAt: isoOrNull(access?.tokenCreatedAt),
    lastUsedAt: isoOrNull(access?.lastUsedAt),
    webhookUrl: access?.webhookUrl ?? null,
    webhookEnabled: access?.webhookEnabled ?? false,
    hasWebhookSecret: Boolean(access?.webhookSecretCipher),
    webhookSecretPreview: secret ? maskSecret(secret) : null,
    webhookSecretReadable: Boolean(secret) || !access?.webhookSecretCipher,
    webhookFailureCount: access?.webhookFailureCount ?? 0,
    webhookLastError: access?.webhookLastError ?? null,
    webhookLastDeliveredAt: isoOrNull(access?.webhookLastDeliveredAt),
    encryptionConfigured: secretEncryptionConfigured(),
    publicApiBaseUrl: `${resolvePublicAppUrl()}/api/v1`,
    ...extras
  };
}

export async function issueOrganizationApiToken(organizationId: string) {
  const generated = generateApiToken();
  const access = await prisma.organizationApiAccess.upsert({
    where: { organizationId },
    create: {
      organizationId,
      tokenHash: generated.hash,
      tokenPrefix: generated.prefix,
      tokenCreatedAt: new Date()
    },
    update: {
      tokenHash: generated.hash,
      tokenPrefix: generated.prefix,
      tokenCreatedAt: new Date(),
      lastUsedAt: null
    }
  });
  return organizationApiAccessDto(access, { token: generated.token });
}

export async function revokeOrganizationApiToken(organizationId: string) {
  const access = await prisma.organizationApiAccess.upsert({
    where: { organizationId },
    create: { organizationId },
    update: { tokenHash: null, tokenPrefix: null, tokenCreatedAt: null, lastUsedAt: null }
  });
  return organizationApiAccessDto(access);
}

export async function saveOrganizationWebhookSettings(
  organizationId: string,
  input: { webhookUrl?: string | null; webhookEnabled?: boolean }
) {
  const existing = await ensureOrganizationApiAccess(organizationId);
  const requestedUrl = input.webhookUrl === undefined ? undefined : (input.webhookUrl ?? "").trim();
  const webhookUrl =
    requestedUrl === undefined ? existing.webhookUrl : requestedUrl ? validateWebhookUrl(requestedUrl) : null;

  let webhookSecretCipher = existing.webhookSecretCipher;
  let revealedSecret: string | undefined;
  if (webhookUrl && !webhookSecretCipher) {
    assertEncryptionConfigured();
    revealedSecret = generateWebhookSecret();
    webhookSecretCipher = encryptSecret(revealedSecret);
  }
  if (!webhookUrl) webhookSecretCipher = existing.webhookSecretCipher;

  const webhookEnabled = input.webhookEnabled ?? existing.webhookEnabled;
  if (webhookEnabled && (!webhookUrl || !webhookSecretCipher)) {
    throw new OrganizationApiAccessError("Save a webhook URL before enabling deliveries.");
  }

  const access = await prisma.organizationApiAccess.update({
    where: { organizationId },
    data: {
      webhookUrl,
      webhookSecretCipher,
      webhookEnabled: webhookUrl ? webhookEnabled : false,
      ...(input.webhookEnabled === false || (webhookUrl && webhookUrl !== existing.webhookUrl)
        ? { webhookFailureCount: 0, webhookLastError: null }
        : {})
    }
  });
  return organizationApiAccessDto(access, revealedSecret ? { webhookSecret: revealedSecret } : {});
}

export async function rotateOrganizationWebhookSecret(organizationId: string) {
  const existing = await ensureOrganizationApiAccess(organizationId);
  if (!existing.webhookUrl) {
    throw new OrganizationApiAccessError("Save a webhook URL before rotating the signing secret.");
  }
  assertEncryptionConfigured();
  const webhookSecret = generateWebhookSecret();
  const access = await prisma.organizationApiAccess.update({
    where: { organizationId },
    data: {
      webhookSecretCipher: encryptSecret(webhookSecret),
      webhookFailureCount: 0,
      webhookLastError: null
    }
  });
  return organizationApiAccessDto(access, { webhookSecret });
}

export async function testOrganizationWebhook(organizationId: string) {
  const access = await loadOrganizationApiAccess(organizationId);
  if (!access?.webhookUrl || !access.webhookSecretCipher) {
    throw new OrganizationApiAccessError("Save a webhook URL before sending a test.");
  }
  if (!decryptSecret(access.webhookSecretCipher)) {
    throw new OrganizationApiAccessError(
      "The stored webhook secret could not be decrypted. Rotate the secret and try again.",
      503
    );
  }
  const result = await sendLeadWebhookTest(organizationId);
  const next = await loadOrganizationApiAccess(organizationId);
  return {
    access: organizationApiAccessDto(next),
    delivered: result.delivered,
    status: result.status,
    error: result.error
  };
}

export function organizationApiAccessErrorResponse(error: unknown) {
  if (error instanceof OrganizationApiAccessError) return error;
  if (error instanceof WebhookUrlError) return new OrganizationApiAccessError(error.message);
  return null;
}

export function organizationApiAccessFailure(error: unknown) {
  const mapped = organizationApiAccessErrorResponse(error);
  if (!mapped) return null;
  return apiFailure(
    {
      code: mapped.status === 503 ? "NOT_CONFIGURED" : "VALIDATION_ERROR",
      message: mapped.message
    },
    mapped.status
  );
}

export type { OrganizationApiAccessDto };
