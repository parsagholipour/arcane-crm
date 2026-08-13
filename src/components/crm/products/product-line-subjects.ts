import type { ScopedCrmData } from "@/lib/crm-types";

/** Records that can have catalogue Products assigned to them as priced lines. */
export type ProductLineSubjectKind = "Opportunity" | "Lead";

export type ProductLineSubjectConfig = {
  /** Collection in ScopedCrmData holding the subject record. */
  dataKey: Extract<keyof ScopedCrmData, "opportunities" | "leads">;
  /** Property on the subject record holding its assigned lines. */
  linesKey: "products" | "sampleProducts";
  /** REST collection the lines are created, edited, and removed under. */
  path: (subjectId: string) => string;
  cardTitle: string;
  addLabel: string;
  addDialogTitle: string;
  /** Dialog heading when the chosen Product has no name to show. */
  lineLabel: string;
  emptyBody: string;
  totalLabel: string;
  removeConfirm: (productName: string) => string;
  addedToast: string;
  updatedToast: string;
  removedToast: string;
  removeError: string;
  saveError: string;
};

/**
 * Opportunity Products and Lead Sample Products are the same feature with different copy and
 * endpoints — the shared card and editor read everything that differs from here.
 */
export const PRODUCT_LINE_SUBJECTS: Record<ProductLineSubjectKind, ProductLineSubjectConfig> = {
  Opportunity: {
    dataKey: "opportunities",
    linesKey: "products",
    path: (subjectId) => `/api/opportunities/${subjectId}/products`,
    cardTitle: "Products",
    addLabel: "Add Product",
    addDialogTitle: "Add Product to Opportunity",
    lineLabel: "Opportunity Product",
    emptyBody: "No Products are assigned yet. Choose Add Product to quote catalogue items on this Opportunity.",
    totalLabel: "Total Product Amount",
    removeConfirm: (productName) => `Remove ${productName} from the Opportunity?`,
    addedToast: "Product assigned.",
    updatedToast: "Opportunity Product updated.",
    removedToast: "Product removed.",
    removeError: "The Product could not be removed.",
    saveError: "Unable to save the Opportunity Product."
  },
  Lead: {
    dataKey: "leads",
    linesKey: "sampleProducts",
    path: (subjectId) => `/api/leads/${subjectId}/sample-products`,
    cardTitle: "Sample Products",
    addLabel: "Add Sample Product",
    addDialogTitle: "Add Sample Product to Lead",
    lineLabel: "Sample Product",
    emptyBody: "No Sample Products are assigned yet. Choose Add Sample Product to record what this Lead was sent.",
    totalLabel: "Total Sample Amount",
    removeConfirm: (productName) => `Remove ${productName} from the Lead's sample?`,
    addedToast: "Sample Product added.",
    updatedToast: "Sample Product updated.",
    removedToast: "Sample Product removed.",
    removeError: "The Sample Product could not be removed.",
    saveError: "Unable to save the Sample Product."
  }
};
