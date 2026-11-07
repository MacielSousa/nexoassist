"use client";

import { Check, RotateCcwKey } from "lucide-react";
import { useState } from "react";

/** Simulado: a redefinição real é feita pelo portal de senhas da Nexo. */
export function ResetPassword() {
  const [sent, setSent] = useState(false);
  return (
    <button
      onClick={() => setSent(true)}
      disabled={sent}
      className="flex h-9 items-center gap-[7px] rounded-lg border border-ink/12 pr-3.5 pl-3 text-[13.5px] font-medium text-ink-2 enabled:hover:bg-desk disabled:text-success-text"
    >
      {sent ? <Check size={15} /> : <RotateCcwKey size={15} />}
      {sent ? "Link enviado" : "Redefinir senha"}
    </button>
  );
}
