import { ENTITY_TYPES, STATES } from "@/lib/constants";
import { Field } from "@/components/ui";
import { SubmitButton } from "@/components/form-bits";

type ClientLike = {
  name?: string;
  entityType?: string;
  pan?: string | null;
  gstin?: string | null;
  cin?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  stateCode?: string | null;
  pincode?: string | null;
  notes?: string | null;
  managerId?: string | null;
};

/** Shared fields for creating and editing a client (render inside an ActionForm). */
export function ClientFields({ client = {}, users, submitLabel }: { client?: ClientLike; users: { id: string; name: string }[]; submitLabel: string }) {
  return (
    <div className="space-y-3">
      <Field label="Client / business name">
        <input name="name" required defaultValue={client.name} className="field" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Entity type">
          <select name="entityType" defaultValue={client.entityType ?? "COMPANY"} className="field">
            {Object.entries(ENTITY_TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Client manager">
          <select name="managerId" defaultValue={client.managerId ?? ""} className="field">
            <option value="">—</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="PAN">
          <input name="pan" defaultValue={client.pan ?? ""} maxLength={10} placeholder="ABCDE1234F" className="field font-mono uppercase" />
        </Field>
        <Field label="GSTIN" hint="State is filled from the GSTIN if left blank">
          <input name="gstin" defaultValue={client.gstin ?? ""} maxLength={15} placeholder="27ABCDE1234F1Z5" className="field font-mono uppercase" />
        </Field>
        <Field label="CIN / LLPIN" className="col-span-2">
          <input name="cin" defaultValue={client.cin ?? ""} className="field font-mono uppercase" />
        </Field>
        <Field label="Contact person">
          <input name="contactPerson" defaultValue={client.contactPerson ?? ""} className="field" />
        </Field>
        <Field label="Phone">
          <input name="phone" defaultValue={client.phone ?? ""} className="field" />
        </Field>
        <Field label="Email" className="col-span-2">
          <input name="email" type="email" defaultValue={client.email ?? ""} className="field" />
        </Field>
      </div>
      <Field label="Address">
        <textarea name="address" rows={2} defaultValue={client.address ?? ""} className="field" />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="City">
          <input name="city" defaultValue={client.city ?? ""} className="field" />
        </Field>
        <Field label="State">
          <select name="stateCode" defaultValue={client.stateCode ?? ""} className="field">
            <option value="">—</option>
            {STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="PIN code">
          <input name="pincode" defaultValue={client.pincode ?? ""} className="field" />
        </Field>
      </div>
      <Field label="Notes">
        <textarea name="notes" rows={2} defaultValue={client.notes ?? ""} className="field" />
      </Field>
      <SubmitButton>{submitLabel}</SubmitButton>
    </div>
  );
}
