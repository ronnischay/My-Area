"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api-client";
import { reloadTo } from "@/lib/navigate";

export function SignOutButton() {
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="secondary"
      size="lg"
      fullWidth
      loading={pending}
      loadingText="Signing out…"
      onClick={async () => {
        setPending(true);
        // Logout is idempotent; even if the call fails, leave the signed-in pages.
        await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
        reloadTo("/login");
      }}
    >
      Sign out
    </Button>
  );
}
