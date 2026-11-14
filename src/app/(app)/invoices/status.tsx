import { Badge, type Tone } from "@/components/ui";

const LABEL: Record<string, [string, Tone]> = {
  DRAFT: ["Draft", "gray"],
  SENT: ["Unpaid", "amber"],
  PARTIAL: ["Partly paid", "blue"],
  PAID: ["Paid", "green"],
  CANCELLED: ["Cancelled", "gray"],
  ACCEPTED: ["Accepted", "green"],
  DECLINED: ["Declined", "red"],
};

export function InvoiceStatusBadge({ invoice }: { invoice: { status: string; docType: string; dueDate: Date | null } }) {
  const overdue =
    invoice.docType === "INVOICE" && ["SENT", "PARTIAL"].includes(invoice.status) && invoice.dueDate && invoice.dueDate < new Date();
  if (overdue) return <Badge tone="red">Overdue</Badge>;
  let [label, tone] = LABEL[invoice.status] ?? [invoice.status, "gray"];
  if (invoice.docType !== "INVOICE" && invoice.status === "SENT") [label, tone] = ["Sent", "blue"];
  return <Badge tone={tone}>{label}</Badge>;
}
