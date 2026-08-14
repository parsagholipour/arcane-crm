import { apiRequest, jsonBody } from "@/lib/api/client";
import type { RecordData } from "@/lib/crm-types";
import { PRODUCT_LINE_SUBJECTS, type ProductLineSubjectKind } from "@/components/crm/products/product-line-subjects";

/** Lines staged in a record modal carry this prefix until the server assigns a real id. */
const STAGED_PREFIX = "staged:";

let stagedCounter = 0;

export function stagedLineId() {
  stagedCounter += 1;
  return `${STAGED_PREFIX}${stagedCounter}`;
}

export function isStagedLine(line: RecordData) {
  return String(line.id ?? "").startsWith(STAGED_PREFIX);
}

function body(line: RecordData) {
  return {
    quantity: String(line.quantity ?? "1"),
    unitPrice: String(line.unitPrice ?? "0"),
    description: line.description === null || line.description === undefined ? "" : String(line.description)
  };
}

function edited(next: RecordData, previous: RecordData) {
  const a = body(next);
  const b = body(previous);
  return a.quantity !== b.quantity || a.unitPrice !== b.unitPrice || a.description !== b.description;
}

function productName(line: RecordData) {
  const product = line.product as RecordData | undefined;
  return String(product?.name ?? "") || "Product";
}

function reason(error: unknown, verb: string, line: RecordData) {
  const detail = error instanceof Error ? error.message : "";
  return `${productName(line)} could not be ${verb}.${detail ? ` ${detail}` : ""}`;
}

export type ProductLineCommitResult = {
  /** The lines that are now persisted, in staged order. */
  lines: RecordData[];
  /** One message per line the server rejected; the record itself is already saved. */
  failures: string[];
};

/**
 * Reconcile the lines staged in a record modal with the server once the record itself is saved.
 * A new record has no id until that point, so adds, edits, and removals are all applied here
 * rather than as the user types — which is also what lets Cancel discard line edits along with
 * the rest of the form.
 */
export async function commitProductLines(
  subjectKind: ProductLineSubjectKind,
  subjectId: string,
  staged: RecordData[],
  original: RecordData[]
): Promise<ProductLineCommitResult> {
  const collection = PRODUCT_LINE_SUBJECTS[subjectKind].path(subjectId);
  const kept = new Set(staged.filter((line) => !isStagedLine(line)).map((line) => String(line.id)));
  const lines: RecordData[] = [];
  const failures: string[] = [];

  for (const line of original) {
    const lineId = String(line.id ?? "");
    if (!lineId || kept.has(lineId)) continue;
    try {
      await apiRequest(`${collection}/${lineId}`, { method: "DELETE" });
    } catch (error) {
      failures.push(reason(error, "removed", line));
      lines.push(line);
    }
  }

  for (const line of staged) {
    try {
      if (isStagedLine(line)) {
        const created = await apiRequest<{ product: RecordData }>(collection, {
          method: "POST",
          body: jsonBody({ productId: String(line.productId ?? ""), ...body(line) })
        });
        lines.push(created.product);
        continue;
      }
      const previous = original.find((item) => String(item.id) === String(line.id));
      if (previous && !edited(line, previous)) {
        lines.push(previous);
        continue;
      }
      const updated = await apiRequest<{ product: RecordData }>(`${collection}/${String(line.id)}`, {
        method: "PATCH",
        body: jsonBody(body(line))
      });
      lines.push(updated.product);
    } catch (error) {
      failures.push(reason(error, isStagedLine(line) ? "added" : "updated", line));
      if (!isStagedLine(line)) lines.push(line);
    }
  }

  return { lines, failures };
}
