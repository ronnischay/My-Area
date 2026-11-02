"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { ApiError, apiFetch } from "@/lib/api-client";
import { reloadTo } from "@/lib/navigate";
import type { DataResponse } from "@/types/api";

const PASSWORD_MIN = 10;

type Account = { name: string; email: string };
type Lookup = { state: "loading" } | { state: "invalid" } | { state: "error"; message: string } | { state: "ready"; account: Account };
type Errors = { password?: string; confirm?: string };

/**
 * Choose a new password from a reset link. Like the invite, the token travels in POST bodies, never
 * in an API URL. Success signs out every other device and signs this one in.
 */
export function ResetPasswordForm({ token }: { token: string }) {
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
    apiFetch<DataResponse<Account>>("/api/auth/password-reset/lookup", { method: "POST", body: { token } })
      .then(({ data }) => active && setLookup({ state: "ready", account: data }))
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && (error.code === "RESET_LINK_INVALID" || error.status === 400)) setLookup({ state: "invalid" });
        else setLookup({ state: "error", message: error instanceof ApiError ? error.message : "Something went wrong." });
      });
    return () => {
      active = false;
    };
  }, [token, attempt]);

  if (lookup.state === "loading") {
    return (
      <div role="status" className="flex flex-col gap-4">
        <span className="sr-only">Checking your link…</span>
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (lookup.state === "invalid") {
    return (
      <EmptyState
        headingLevel="h1"
        title="This reset link doesn't work"
        description="It may have expired (links last one hour) or already been used. Ask for a new one."
        action={
          <ButtonLink href="/forgot-password" variant="secondary">
            Get a new link
          </ButtonLink>
        }
      />
    );
  }

  if (lookup.state === "error") {
    return (
      <Alert
        tone="error"
        title="We couldn't check your link"
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

  const { account } = lookup;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found: Errors = {};
    if (password.length < PASSWORD_MIN) found.password = `Use at least ${PASSWORD_MIN} characters`;
    else if (password.trim().toLowerCase() === account.email.toLowerCase()) found.password = "Your password can't be your email";
    if (!found.password && confirm !== password) found.confirm = "The passwords don't match";
    setErrors(found);
    setFormError(null);
    if (found.password) return passwordRef.current?.focus();
    if (found.confirm) return confirmRef.current?.focus();

    setPending(true);
    try {
      await apiFetch("/api/auth/password-reset/confirm", { method: "POST", body: { token, password } });
      reloadTo("/");
    } catch (error) {
      setPending(false);
      if (error instanceof ApiError && error.code === "RESET_LINK_INVALID") return setLookup({ state: "invalid" });
      if (error instanceof ApiError && error.fieldErrors.password?.[0]) {
        setErrors({ password: error.fieldErrors.password[0] });
        return passwordRef.current?.focus();
      }
      setFormError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-display font-bold text-fg">Choose a new password</h1>
        <p className="text-fg-muted">
          For {account.name} ({account.email}). You&apos;ll be signed out on every other device.
        </p>
      </div>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {formError && <Alert tone="error">{formError}</Alert>}
        <Field id="password" label="New password" hint={`At least ${PASSWORD_MIN} characters`} error={errors.password} required>
          {(control) => (
            <Input {...control} ref={passwordRef} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          )}
        </Field>
        <Field id="confirm" label="Confirm new password" error={errors.confirm} required>
          {(control) => (
            <Input {...control} ref={confirmRef} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          )}
        </Field>
        <Button type="submit" size="lg" fullWidth loading={pending} loadingText="Saving…">
          Save password and sign in
        </Button>
      </form>
    </div>
  );
}
