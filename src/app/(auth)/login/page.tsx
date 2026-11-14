import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/form-bits";
import { Field } from "@/components/ui";
import { login } from "../actions";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-muted">Welcome back. Sign in to your firm&apos;s workspace.</p>
      <ActionForm action={login} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label="Email">
          <input name="email" type="email" required autoComplete="email" className="field" />
        </Field>
        <Field label="Password">
          <input name="password" type="password" required autoComplete="current-password" className="field" />
        </Field>
        <SubmitButton className="w-full" pendingText="Signing in…">
          Sign in
        </SubmitButton>
      </ActionForm>
      <p className="mt-6 text-sm text-muted">
        New firm?{" "}
        <Link href="/signup" className="font-medium text-brand-700 hover:underline">
          Create a workspace
        </Link>
      </p>
      <div className="mt-8 rounded-md border border-dashed border-line bg-white px-3 py-2.5 text-xs text-muted">
        Demo workspace: see <code className="font-mono">README.md</code> for the sample logins.
      </div>
    </>
  );
}
