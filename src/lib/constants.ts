export const APP_NAME = "CA ORG";
export const APP_TAGLINE = "Management Tool";

export const ROLES = ["PARTNER", "MANAGER", "STAFF"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABEL: Record<string, string> = {
  PARTNER: "Partner",
  MANAGER: "Manager",
  STAFF: "Staff",
};

export const ISSUE_TYPES = ["EPIC", "STORY", "TASK", "BUG", "SUBTASK"] as const;
export const ISSUE_TYPE_LABEL: Record<string, string> = {
  EPIC: "Epic",
  STORY: "Story",
  TASK: "Task",
  BUG: "Bug",
  SUBTASK: "Sub-task",
};

export const PRIORITIES = ["HIGHEST", "HIGH", "MEDIUM", "LOW", "LOWEST"] as const;
export const PRIORITY_LABEL: Record<string, string> = {
  HIGHEST: "Highest",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
  LOWEST: "Lowest",
};
export const PRIORITY_RANK: Record<string, number> = {
  HIGHEST: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  LOWEST: 4,
};

export const STATUS_CATEGORIES = ["TODO", "IN_PROGRESS", "DONE"] as const;
export const STATUS_CATEGORY_LABEL: Record<string, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

export const DEFAULT_WORKFLOW = [
  { name: "To Do", category: "TODO" },
  { name: "In Progress", category: "IN_PROGRESS" },
  { name: "In Review", category: "IN_PROGRESS" },
  { name: "Done", category: "DONE" },
];

export const LINK_TYPES: Record<string, { out: string; in: string }> = {
  BLOCKS: { out: "blocks", in: "is blocked by" },
  RELATES: { out: "relates to", in: "relates to" },
  DUPLICATES: { out: "duplicates", in: "is duplicated by" },
};

export const AVAILABILITY_TYPES = ["LEAVE", "ABSENT", "OOO", "WFH"] as const;
export const AVAILABILITY_LABEL: Record<string, string> = {
  LEAVE: "Leave",
  ABSENT: "Absent",
  OOO: "Out of office",
  WFH: "Work from home",
};
/** Types that need manager approval. OOO and WFH are recorded straight away. */
export const AVAILABILITY_NEEDS_APPROVAL = new Set(["LEAVE"]);
/** Types where the person can't be expected to pick up work that day. */
export const AVAILABILITY_UNAVAILABLE = new Set(["LEAVE", "ABSENT", "OOO"]);

export const ENTITY_TYPES: Record<string, string> = {
  COMPANY: "Private / Public Ltd",
  LLP: "LLP",
  PARTNERSHIP: "Partnership firm",
  PROPRIETORSHIP: "Proprietorship",
  INDIVIDUAL: "Individual",
  HUF: "HUF",
  TRUST: "Trust / Society",
};

export const DOC_TYPES = ["INVOICE", "QUOTATION", "PROFORMA", "CREDIT_NOTE"] as const;
export const DOC_TYPE_LABEL: Record<string, string> = {
  INVOICE: "Tax Invoice",
  QUOTATION: "Quotation",
  PROFORMA: "Proforma Invoice",
  CREDIT_NOTE: "Credit Note",
};
export const DOC_TYPE_PLURAL: Record<string, string> = {
  INVOICE: "Invoices",
  QUOTATION: "Quotations",
  PROFORMA: "Proforma",
  CREDIT_NOTE: "Credit notes",
};

export const PAYMENT_MODES: Record<string, string> = {
  UPI: "UPI",
  BANK_TRANSFER: "Bank transfer",
  CASH: "Cash",
  CHEQUE: "Cheque",
  CARD: "Card",
};

export const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28, 40];

export const UNITS = ["NOS", "HRS", "DAYS", "MONTHS", "PCS", "KGS", "LTR", "BOX", "SET", "OTH"];

/** GST state codes (first two digits of a GSTIN). */
export const STATES: { code: string; name: string }[] = [
  { code: "01", name: "Jammu & Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra & Nagar Haveli and Daman & Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman & Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
  { code: "97", name: "Other Territory" },
  { code: "96", name: "Other Country" },
];

export function stateName(code?: string | null) {
  if (!code) return "";
  return STATES.find((s) => s.code === code)?.name ?? code;
}
