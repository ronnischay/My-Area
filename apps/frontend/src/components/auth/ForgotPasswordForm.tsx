"use client";

import Link from "next/link";
import { type FormEvent, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { ApiError, apiFetch } from "@/lib/api-client";

/**
 * Asks for a reset link. The answer is the same whether or not the email has an account (the API
 * never says), so the confirmation is worded as "if".
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter the email you sign in with");
      return emailRef.current?.focus();
    }
    setError(null);
    setPending(true);
    try {
      await apiFetch("/api/auth/password-reset/request", { method: "POST", body: { email } });
      setSentTo(email.trim());
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success" title="Check your email">
          If an account exists for {sentTo}, we&apos;ve sent a link to reset your password. It works for one hour.
        </Alert>
        <p className="text-sm text-fg-muted">Nothing arrived after a few minutes? Check your spam folder, or ask again.</p>
        <Link href="/login" className="inline-flex min-h-11 items-center self-start font-semibold text-primary">
          ← Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      {formError && <Alert tone="error">{formError}</Alert>}
      <Field id="email" label="Email" error={error ?? undefined} required>
        {(control) => (
          <Input
            {...control}
            ref={emailRef}
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            maxLength={255}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
      </Field>
      <Button type="submit" size="lg" fullWidth loading={pending} loadingText="Sending…">
        Send reset link
      </Button>
      <Link href="/login" className="inline-flex min-h-11 items-center self-start font-semibold text-primary">
        ← Back to sign in
      </Link>
    </form>
  );
}
