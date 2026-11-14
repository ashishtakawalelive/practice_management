"use client";

import { Printer } from "lucide-react";
import { buttonClass } from "@/components/ui";

/** Opens the browser print dialog. Choose "Save as PDF" to download a PDF. */
export function PrintButton() {
  return (
    <button onClick={() => window.print()} className={buttonClass("primary")} title="Print, or choose 'Save as PDF' in the dialog">
      <Printer className="h-3.5 w-3.5" /> Print / PDF
    </button>
  );
}
