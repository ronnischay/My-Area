"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { ApiError, apiFetch } from "@/lib/api-client";
import { reloadTo } from "@/lib/navigate";
import { formatDateTime, ROLE_LABELS } from "@/lib/format";
import type { DataResponse, InviteDetails } from "@/types/api";

const PASSWORD_MIN = 10;

type Lookup = { state: "loading" } | { state: "invalid" } | { state: "error"; message: string } | { state: "ready"; invite: InviteDetails };
type Errors = { password?: string; confirm?: string };

/**
 * UI_UX_GUIDELINES §8 Accept invite. The token travels in the POST body, never in an API URL, so it
 * doesn't end up in request logs.
 */
export function AcceptInviteForm({ token }: { token: string }) {
  const [lookup, setLookup] = useState<Lookup>(token ? { state: "loading" } : { state: "invalid" });
  const [attempt, setAttempt] = useState(0);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    apiFetch<DataResponse<InviteDetails>>("/api/auth/invites/lookup", { method: "POST", body: { token } })
      .then(({ data }) => active && setLookup({ state: "ready", invite: data }))
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && (error.code === "INVITE_INVALID" || error.status === 400)) setLookup({ state: "invalid" });
        else setLookup({ state: "error", message: error instanceof ApiError ? error.message : "Something went wrong." });
      });
    return () => {
      active = false;
    };
  }, [token, attempt]);

  if (lookup.state === "loading") {
    return (
      <div role="status" className="flex flex-col gap-4">
        <span className="sr-only">Checking your invite…</span>
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (lookup.state === "invalid") {
    return (
      <EmptyState
        headingLevel="h1"
        title="This invite link doesn't work"
        description="This invite link is invalid or has expired. Ask your society admin to send a new one."
      />
    );
  }

  if (lookup.state === "error") {
    return (
      <Alert
        tone="error"
        title="We couldn't check your invite"
        action={
          <Button variant="secondary" onClick={() => (setLookup({ state: "loading" }), setAttempt((a) => a + 1))}>
            Try again
          </Button>
        }
      >
        {lookup.message}
      </Alert>
    );
  }

  const { invite } = lookup;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found: Errors = {};
    if (password.length < PASSWORD_MIN) found.password = `Use at least ${PASSWORD_MIN} characters`;
    else if (password.trim().toLowerCase() === invite.email.toLowerCase()) found.password = "Your password can't be your email";
    if (!found.password && confirm !== password) found.confirm = "The passwords don't match";
    setErrors(found);
    setFormError(null);
    if (found.password) return passwordRef.current?.focus();
    if (found.confirm) return confirmRef.current?.focus();

    setPending(true);
    try {
      await apiFetch("/api/auth/invites/accept", { method: "POST", body: { token, password } });
      reloadTo("/");
    } catch (error) {
      setPending(false);
      if (error instanceof ApiError && error.code === "INVITE_INVALID") return setLookup({ state: "invalid" });
      if (error instanceof ApiError && error.fieldErrors.password?.[0]) {
        setErrors({ password: error.fieldErrors.password[0] });
        return passwordRef.current?.focus();
      }
      setFormError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start gap-3">
        <Badge tone="brand">You&apos;re invited</Badge>
        <h1 className="font-display text-display font-bold text-fg sm:text-display-lg">Join {invite.societyName}</h1>
      </div>
      <div className="flex items-center gap-4 rounded-card border border-border bg-surface-muted p-4">
        <Avatar name={invite.name} size="lg" />
        <dl className="min-w-0">
          <dt className="sr-only">Name</dt>
          <dd className="truncate font-bold text-fg">{invite.name}</dd>
          <dt className="sr-only">Email</dt>
          <dd className="truncate text-fg-muted">{invite.email}</dd>
          <dt className="sr-only">Role</dt>
          <dd className="text-sm font-semibold text-primary">{ROLE_LABELS[invite.role]}</dd>
        </dl>
      </div>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {formError && <Alert tone="error">{formError}</Alert>}
        <Field id="password" label="Create a password" hint={`At least ${PASSWORD_MIN} characters`} error={errors.password} required>
          {(control) => (
            <Input {...control} ref={passwordRef} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          )}
        </Field>
        <Field id="confirm" label="Confirm password" error={errors.confirm} required>
          {(control) => (
            <Input {...control} ref={confirmRef} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          )}
        </Field>
        <Button type="submit" size="lg" fullWidth loading={pending} loadingText="Joining…">
          Join and sign in
        </Button>
        <p className="text-sm text-fg-muted">This link expires on {formatDateTime(invite.expiresAt)}.</p>
      </form>
    </div>
  );
}
