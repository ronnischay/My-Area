"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ApiError, apiFetch } from "@/lib/api-client";
import { firstName } from "@/lib/format";
import type { InviteResponse, MemberRole } from "@/types/api";

type Errors = { name?: string; email?: string };
type Outcome = { tone: "success" | "warning"; text: string } | null;

const ROLE_OPTIONS = [
  { value: "RESIDENT", label: "Resident" },
  { value: "MANAGER", label: "Manager" },
] as const satisfies readonly { value: MemberRole; label: string }[];

/** "Invite a neighbour" to `societyId` (side panel on lg+, its own page on phones). Managers invite residents only. */
export function InviteMemberForm({ societyId, residentsOnly = false }: { societyId: string; residentsOnly?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("RESIDENT");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [pending, setPending] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found: Errors = {};
    if (name.trim().length < 2) found.name = "Enter their full name";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) found.email = "Enter a valid email address";
    setErrors(found);
    setFormError(null);
    setOutcome(null);
    if (found.name) return nameRef.current?.focus();
    if (found.email) return emailRef.current?.focus();

    setPending(true);
    try {
      const { meta } = await apiFetch<InviteResponse>(`/api/societies/${societyId}/members`, { method: "POST", body: { name, email, role } });
      setOutcome(
        meta.invite === "SENT"
          ? { tone: "success", text: `Invite sent to ${firstName(name)}.` }
          : { tone: "warning", text: `${firstName(name)} was added, but the invite email could not be sent. Use Resend in the list.` },
      );
      setName("");
      setEmail("");
      setRole("RESIDENT");
      router.refresh();
      nameRef.current?.focus();
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        setErrors({ name: error.fieldErrors.name?.[0], email: error.fieldErrors.email?.[0] });
        if (error.fieldErrors.email) emailRef.current?.focus();
      } else {
        setFormError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      {formError && <Alert tone="error">{formError}</Alert>}
      {outcome && <Alert tone={outcome.tone}>{outcome.text}</Alert>}
      <Field id="invite-name" label="Full name" error={errors.name} required>
        {(control) => <Input {...control} ref={nameRef} autoComplete="off" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />}
      </Field>
      <Field id="invite-email" label="Email" error={errors.email} required>
        {(control) => (
          <Input {...control} ref={emailRef} type="email" inputMode="email" autoComplete="off" value={email} maxLength={255} onChange={(e) => setEmail(e.target.value)} />
        )}
      </Field>
      {residentsOnly ? (
        <p className="text-sm text-fg-muted">They join as a resident.</p>
      ) : (
        <SegmentedControl label="Role" name="invite-role" options={ROLE_OPTIONS} value={role} onChange={setRole} />
      )}
      <Button type="submit" size="lg" fullWidth loading={pending} loadingText="Sending…">
        Send invite
      </Button>
      <p className="text-sm text-fg-muted">They get a link that&apos;s valid for 72 hours.</p>
    </form>
  );
}
