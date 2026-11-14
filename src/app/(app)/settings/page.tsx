import { canManage, requireUser } from "@/lib/auth";
import { STATES } from "@/lib/constants";
import { Card, CardHeader, Field, PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/form-bits";
import { updateOrg } from "./actions";

export const metadata = { title: "Firm settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const org = user.org;
  const disabled = !canManage(user);

  return (
    <>
      <PageHeader title="Firm settings" subtitle="These details appear on your invoices and quotations." />
      {disabled && <p className="mb-4 text-sm text-muted">Only partners and managers can change firm settings.</p>}
      <ActionForm action={updateOrg}>
        <fieldset disabled={disabled} className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Firm details" />
            <div className="space-y-3 p-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Display name">
                  <input name="name" required defaultValue={org.name} className="field" />
                </Field>
                <Field label="Legal name (on invoices)">
                  <input name="legalName" defaultValue={org.legalName ?? ""} className="field" />
                </Field>
                <Field label="GSTIN">
                  <input name="gstin" defaultValue={org.gstin ?? ""} maxLength={15} className="field font-mono uppercase" />
                </Field>
                <Field label="PAN">
                  <input name="pan" defaultValue={org.pan ?? ""} maxLength={10} className="field font-mono uppercase" />
                </Field>
              </div>
              <Field label="Address">
                <textarea name="address" rows={2} defaultValue={org.address ?? ""} className="field" />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="City">
                  <input name="city" defaultValue={org.city ?? ""} className="field" />
                </Field>
                <Field label="State" hint="Decides CGST+SGST vs IGST">
                  <select name="stateCode" defaultValue={org.stateCode ?? ""} className="field">
                    <option value="">—</option>
                    {STATES.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="PIN code">
                  <input name="pincode" defaultValue={org.pincode ?? ""} className="field" />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Phone">
                  <input name="phone" defaultValue={org.phone ?? ""} className="field" />
                </Field>
                <Field label="Email">
                  <input name="email" type="email" defaultValue={org.email ?? ""} className="field" />
                </Field>
                <Field label="Website">
                  <input name="website" defaultValue={org.website ?? ""} className="field" />
                </Field>
              </div>
            </div>
          </Card>

          <div className="space-y-5">
            <Card>
              <CardHeader title="Bank & UPI" subtitle="Printed on invoices. The UPI ID also generates a scan-to-pay QR code." />
              <div className="grid grid-cols-2 gap-3 p-4">
                <Field label="Bank name">
                  <input name="bankName" defaultValue={org.bankName ?? ""} className="field" />
                </Field>
                <Field label="Branch">
                  <input name="bankBranch" defaultValue={org.bankBranch ?? ""} className="field" />
                </Field>
                <Field label="Account number">
                  <input name="bankAccountNo" defaultValue={org.bankAccountNo ?? ""} className="field font-mono" />
                </Field>
                <Field label="IFSC">
                  <input name="bankIfsc" defaultValue={org.bankIfsc ?? ""} className="field font-mono uppercase" />
                </Field>
                <Field label="UPI ID" className="col-span-2">
                  <input name="upiId" defaultValue={org.upiId ?? ""} placeholder="firmname@bank" className="field" />
                </Field>
              </div>
            </Card>
            <Card>
              <CardHeader title="Numbering & terms" />
              <div className="space-y-3 p-4">
                <div className="grid grid-cols-4 gap-3">
                  <Field label="Invoice">
                    <input name="invoicePrefix" defaultValue={org.invoicePrefix} className="field font-mono uppercase" />
                  </Field>
                  <Field label="Quotation">
                    <input name="quotePrefix" defaultValue={org.quotePrefix} className="field font-mono uppercase" />
                  </Field>
                  <Field label="Proforma">
                    <input name="proformaPrefix" defaultValue={org.proformaPrefix} className="field font-mono uppercase" />
                  </Field>
                  <Field label="Credit note">
                    <input name="creditPrefix" defaultValue={org.creditPrefix} className="field font-mono uppercase" />
                  </Field>
                </div>
                <p className="text-[11px] text-muted">Numbers continue from the highest existing number with each prefix, e.g. INV-0007. Tip: include the FY, like INV/26-27.</p>
                <Field label="Default terms & conditions">
                  <textarea name="invoiceTerms" rows={4} defaultValue={org.invoiceTerms ?? ""} className="field" />
                </Field>
              </div>
            </Card>
            {!disabled && <SubmitButton className="w-full">Save settings</SubmitButton>}
          </div>
        </fieldset>
      </ActionForm>
    </>
  );
}
