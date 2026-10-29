"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { ApiError, apiFetch } from "@/lib/api-client";
import { reloadTo } from "@/lib/navigate";
import type { Society } from "@/types/api";

type Errors = { name?: string; addressText?: string };

/** Create the society (POST) or edit it (PATCH). Limits mirror docs/API_CONTRACT.md Societies. */
export function SocietyForm({ society }: { society?: Pick<Society, "name" | "addressText"> }) {
  const router = useRouter();
  const editing = society !== undefined;
  const [name, setName] = useState(society?.name ?? "");
  const [addressText, setAddressText] = useState(society?.addressText ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found: Errors = {};
    if (name.trim().length < 3) found.name = "Use at least 3 characters";
    if (addressText.trim().length < 5) found.addressText = "Use at least 5 characters";
    setErrors(found);
    setFormError(null);
    setSaved(false);
    if (found.name) return nameRef.current?.focus();
    if (found.addressText) return addressRef.current?.focus();

    setPending(true);
    try {
      await apiFetch(editing ? "/api/societies/current" : "/api/societies", {
        method: editing ? "PATCH" : "POST",
        body: { name, addressText },
      });
      if (!editing) return reloadTo("/admin/users");
      setSaved(true);
      setPending(false);
      router.refresh(); // the header shows the society name
    } catch (error) {
      setPending(false);
      if (error instanceof ApiError && error.code === "SOCIETY_ALREADY_EXISTS") return reloadTo("/");
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        setErrors({ name: error.fieldErrors.name?.[0], addressText: error.fieldErrors.addressText?.[0] });
        return;
      }
      setFormError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      {formError && <Alert tone="error">{formError}</Alert>}
      {saved && <Alert tone="success">Society details saved.</Alert>}
      <Field id="society-name" label="Society name" error={errors.name} required>
        {(control) => <Input {...control} ref={nameRef} autoComplete="organization" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />}
      </Field>
      <Field id="society-address" label="Address" hint="Street, area and city" error={errors.addressText} required>
        {(control) => (
          <Input {...control} ref={addressRef} autoComplete="street-address" value={addressText} maxLength={255} onChange={(e) => setAddressText(e.target.value)} />
        )}
      </Field>
      <Button type="submit" size="lg" fullWidth loading={pending} loadingText={editing ? "Saving…" : "Creating…"}>
        {editing ? "Save changes" : "Create society"}
      </Button>
    </form>
  );
}
