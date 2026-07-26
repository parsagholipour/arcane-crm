import assert from "node:assert/strict";
import test from "node:test";
import {
  contentDisposition,
  FileValidationError,
  isPreviewableContentType,
  normalizeFileName,
  validateFileMetadata
} from "@/lib/files";

test("file metadata normalizes paths and accepts safe content", () => {
  assert.equal(normalizeFileName("../../Quarterly Report.pdf"), "Quarterly Report.pdf");
  assert.deepEqual(validateFileMetadata("Quarterly Report.pdf", 128, "application/pdf"), {
    name: "Quarterly Report.pdf",
    contentType: "application/pdf"
  });
});

test("file metadata rejects empty, oversized, and executable uploads", () => {
  assert.throws(() => validateFileMetadata("empty.txt", 0, "text/plain"), FileValidationError);
  assert.throws(() => validateFileMetadata("payload.exe", 12, "application/octet-stream"), FileValidationError);
  assert.throws(() => validateFileMetadata("vector.svg", 12, "image/svg+xml"), FileValidationError);
  assert.throws(
    () => validateFileMetadata("large.pdf", 26 * 1024 * 1024, "application/pdf"),
    (error) => error instanceof FileValidationError && error.status === 413
  );
});

test("preview and content-disposition helpers constrain browser rendering", () => {
  assert.equal(isPreviewableContentType("application/pdf"), true);
  assert.equal(isPreviewableContentType("text/html"), false);
  assert.match(contentDisposition("Résumé 2026.pdf", true), /^inline; filename=/);
  assert.match(contentDisposition("Résumé 2026.pdf", true), /filename\*=UTF-8''R%C3%A9sum%C3%A9%202026.pdf/);
});
