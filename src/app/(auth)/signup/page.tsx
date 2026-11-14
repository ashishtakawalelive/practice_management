import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/form-bits";
import { Field } from "@/components/ui";
import { signup } from "../actions";

export const metadata = { title: "Create workspace" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Create your firm&apos;s workspace</h1>
      <p className="mt-1 text-sm text-muted">You&apos;ll be the Partner (admin). Invite your team afterwards.</p>
      <ActionForm action={signup} className="mt-6 space-y-4">
        <Field label="Firm name">
          <input name="firm" required placeholder="e.g. Sharma & Associates" className="field" />
        </Field>
        <Field label="Your name">
          <input name="name" required autoComplete="name" className="field" />
        </Field>
        <Field label="Work email">
          <input name="email" type="email" required autoComplete="email" className="field" />
        </Field>
        <Field label="Password" hint="At least 8 characters">
          <input name="password" type="password" required minLength={8} autoComplete="new-password" className="field" />
        </Field>
        <SubmitButton className="w-full" pendingText="Creating…">
          Create workspace
        </SubmitButton>
      </ActionForm>
      <p className="mt-6 text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
