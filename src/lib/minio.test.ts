import assert from "node:assert/strict";
import test from "node:test";
import { MinioConfigurationError, minioConfiguration } from "@/lib/minio";

const credentials = {
  MINIO_ACCESS_KEY: "access",
  MINIO_BUCKET: "crm-assets",
  MINIO_SECRET_KEY: "secret"
};

test("MinIO configuration accepts full HTTPS URLs and bare host ports", () => {
  assert.deepEqual(minioConfiguration({ ...credentials, MINIO_ENDPOINT: "https://objects.example.com" }), {
    accessKey: "access",
    bucket: "crm-assets",
    endPoint: "objects.example.com",
    port: 443,
    secretKey: "secret",
    useSSL: true
  });
  assert.equal(minioConfiguration({ ...credentials, MINIO_ENDPOINT: "minio:9000" }).port, 9000);
  assert.equal(minioConfiguration({ ...credentials, MINIO_ENDPOINT: "minio:9000" }).useSSL, false);
});

test("MinIO configuration rejects missing credentials and endpoint paths", () => {
  assert.throws(
    () => minioConfiguration({ ...credentials, MINIO_ENDPOINT: "" }),
    (error: unknown) => error instanceof MinioConfigurationError && /MINIO_ENDPOINT/.test(error.message)
  );
  assert.throws(
    () => minioConfiguration({ ...credentials, MINIO_ENDPOINT: "https://objects.example.com/storage" }),
    /host and optional port/
  );
});
