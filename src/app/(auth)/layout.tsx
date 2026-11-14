import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col justify-between px-6 py-8 sm:px-12">
        <Logo />
        <div className="mx-auto w-full max-w-sm py-10">{children}</div>
        <p className="text-xs text-muted">© {new Date().getFullYear()} CA ORG Management Tool</p>
      </div>
      <div className="relative hidden overflow-hidden bg-brand-800 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(123,207,192,.35),transparent_55%)]" />
        <div className="relative flex h-full flex-col justify-center px-14 text-white">
          <p className="text-sm font-medium uppercase tracking-widest text-brand-200">Built for CA practices</p>
          <h2 className="mt-3 max-w-md text-3xl font-semibold leading-tight">
            Clients, compliance work, your team&apos;s availability and GST billing — in one place.
          </h2>
          <ul className="mt-8 space-y-3 text-sm text-brand-100">
            <li>• Boards, backlogs and sprints for every engagement</li>
            <li>• Leave, OOO and work-from-home on one team calendar</li>
            <li>• GST invoices, quotations and payment tracking</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
