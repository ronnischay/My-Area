"use client";

import Link from "next/link";
import { type FormEvent, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { ApiError, apiFetch } from "@/lib/api-client";
import { reloadTo } from "@/lib/navigate";
import { safeNextPath } from "@/lib/redirect-target";

type Errors = { email?: string; password?: string };

/** UI_UX_GUIDELINES §8 Login: one generic error, email kept, password cleared. */
export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found: Errors = {};
    if (!email.trim()) found.email = "Enter your email";
    if (!password) found.password = "Enter your password";
    setErrors(found);
    setFormError(null);
    if (found.email) return emailRef.current?.focus();
    if (found.password) return passwordRef.current?.focus();

    setPending(true);
    try {
      await apiFetch("/api/auth/login", { method: "POST", body: { email, password } });
      reloadTo(safeNextPath(next));
    } catch (error) {
      setPending(false);
      setPassword("");
      setFormError(
        error instanceof ApiError && (error.code === "INVALID_CREDENTIALS" || error.code === "RATE_LIMITED" || error.code === "NETWORK_ERROR")
          ? error.message
          : "Something went wrong. Please try again.",
      );
      passwordRef.current?.focus();
    }
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      {formError && <Alert tone="error">{formError}</Alert>}
      <Field id="email" label="Email" error={errors.email} required>
        {(control) => (
          <Input
            {...control}
            ref={emailRef}
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
      </Field>
      <Field id="password" label="Password" error={errors.password} required>
        {(control) => (
          <div className="relative">
            <Input
              {...control}
              ref={passwordRef}
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-20"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-pressed={showPassword}
              aria-label="Show password"
              className="absolute top-1/2 right-2 min-h-11 -translate-y-1/2 rounded-pill px-3 text-sm font-semibold text-primary hover:bg-surface-muted"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        )}
      </Field>
      <Link href="/forgot-password" className="-mt-2 inline-flex min-h-11 items-center self-end text-sm font-semibold text-primary">
        Forgot password?
      </Link>
      <Button type="submit" size="lg" fullWidth loading={pending} loadingText="Signing in…">
        Sign in
      </Button>
    </form>
  );
}
