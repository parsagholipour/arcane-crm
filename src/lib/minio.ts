import "server-only";

import { randomUUID } from "node:crypto";
import { Client } from "minio";
import { OrganizationLogoValidationError, validateOrganizationLogo } from "@/lib/organization-branding";

type MinioEnvironment = Record<string, string | undefined> & {
  MINIO_ACCESS_KEY?: string;
  MINIO_BUCKET?: string;
  MINIO_ENDPOINT?: string;
  MINIO_SECRET_KEY?: string;
};

export type MinioConfiguration = {
  accessKey: string;
  bucket: string;
  endPoint: string;
  port: number;
  secretKey: string;
  useSSL: boolean;
};

export class MinioConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MinioConfigurationError";
  }
}

function required(value: string | undefined, name: keyof MinioEnvironment) {
  const normalized = value?.trim() ?? "";
  if (!normalized) throw new MinioConfigurationError(`${name} is required for organization logo uploads.`);
  return normalized;
}

export function minioConfiguration(environment: MinioEnvironment = process.env) {
  const endpointValue = required(environment.MINIO_ENDPOINT, "MINIO_ENDPOINT");
  let endpoint: URL;
  try {
    endpoint = new URL(endpointValue.includes("://") ? endpointValue : `http://${endpointValue}`);
  } catch {
    throw new MinioConfigurationError("MINIO_ENDPOINT must be a valid HTTP or HTTPS endpoint.");
  }
  if (
    !["http:", "https:"].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password ||
    (endpoint.pathname && endpoint.pathname !== "/") ||
    endpoint.search ||
    endpoint.hash
  ) {
    throw new MinioConfigurationError("MINIO_ENDPOINT must contain only an HTTP(S) host and optional port.");
  }

  return {
    accessKey: required(environment.MINIO_ACCESS_KEY, "MINIO_ACCESS_KEY"),
    bucket: required(environment.MINIO_BUCKET, "MINIO_BUCKET"),
    endPoint: endpoint.hostname,
    port: endpoint.port ? Number(endpoint.port) : endpoint.protocol === "https:" ? 443 : 80,
    secretKey: required(environment.MINIO_SECRET_KEY, "MINIO_SECRET_KEY"),
    useSSL: endpoint.protocol === "https:"
  } satisfies MinioConfiguration;
}

function clientFor(configuration: MinioConfiguration) {
  return new Client({
    endPoint: configuration.endPoint,
    port: configuration.port,
    useSSL: configuration.useSSL,
    accessKey: configuration.accessKey,
    secretKey: configuration.secretKey
  });
}

function isBucketRace(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  return code === "BucketAlreadyExists" || code === "BucketAlreadyOwnedByYou";
}

async function ensureBucket(client: Client, bucket: string) {
  if (await client.bucketExists(bucket)) return;
  try {
    await client.makeBucket(bucket);
  } catch (error) {
    if (!isBucketRace(error)) throw error;
  }
}

function safeOrganizationSegment(organizationId: string) {
  return organizationId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export async function uploadOrganizationLogo(organizationId: string, file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const metadata = validateOrganizationLogo(file, bytes);
  const configuration = minioConfiguration();
  const client = clientFor(configuration);
  const objectKey = `organization-logos/${safeOrganizationSegment(organizationId)}/${randomUUID()}.${metadata.extension}`;

  try {
    await ensureBucket(client, configuration.bucket);
    await client.putObject(configuration.bucket, objectKey, Buffer.from(bytes), bytes.byteLength, {
      "Cache-Control": "private, max-age=86400",
      "Content-Type": metadata.contentType
    });
    return { objectKey, contentType: metadata.contentType, size: bytes.byteLength };
  } catch (error) {
    console.error("[minio] organization logo upload failed", error);
    if (error instanceof MinioConfigurationError || error instanceof OrganizationLogoValidationError) throw error;
    throw new Error("Unable to store the logo in MinIO. Check the storage configuration and try again.");
  }
}

export async function readOrganizationLogo(objectKey: string) {
  const configuration = minioConfiguration();
  const client = clientFor(configuration);
  const stat = await client.statObject(configuration.bucket, objectKey);
  const stream = await client.getObject(configuration.bucket, objectKey);
  const contentType = String(stat.metaData["content-type"] ?? stat.metaData["Content-Type"] ?? "image/png");
  return { contentType, etag: stat.etag, size: stat.size, stream };
}

export async function removeOrganizationLogo(objectKey: string) {
  const configuration = minioConfiguration();
  await clientFor(configuration).removeObject(configuration.bucket, objectKey);
}
