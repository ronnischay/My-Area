"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { ApiError, apiFetch } from "@/lib/api-client";
import { CATEGORIES, REPORT_LIMITS } from "@/lib/reports";
import type { DataResponse, Report } from "@/types/api";

type FieldName = "photo" | "title" | "category" | "locationText" | "description";
type Values = Record<Exclude<FieldName, "photo">, string>;
type Errors = Partial<Record<FieldName, string>>;

/** Field order = form order, so the error summary lists them top to bottom. */
const FIELDS: readonly { name: FieldName; label: string; id: string }[] = [
  { name: "photo", label: "Photo", id: "report-photo" },
  { name: "title", label: "Title", id: "report-title" },
  { name: "category", label: "Category", id: "report-category" },
  { name: "locationText", label: "Location", id: "report-location" },
  { name: "description", label: "Description", id: "report-description" },
];

const EMPTY: Values = { title: "", category: "", locationText: "", description: "" };

function lengthError(value: string, { min, max }: { min: number; max: number }, what: string): string | undefined {
  const length = value.trim().length;
  if (length === 0) return `Add ${what}`;
  if (length < min) return `Use at least ${min} characters`;
  if (length > max) return `Use at most ${max} characters`;
  return undefined;
}

export function validateReport(values: Values, photo: File | null): Errors {
  const errors: Errors = {};
  if (!photo) errors.photo = "Add a photo of the problem";
  else if (!(REPORT_LIMITS.photoTypes as readonly string[]).includes(photo.type)) errors.photo = "Use a JPEG, PNG or WebP photo.";
  else if (photo.size > REPORT_LIMITS.photoBytes) errors.photo = "The photo must be 5 MB or smaller.";
  const title = lengthError(values.title, REPORT_LIMITS.title, "a short title");
  if (title) errors.title = title;
  if (!values.category) errors.category = "Choose a category";
  const location = lengthError(values.locationText, REPORT_LIMITS.locationText, "where it is");
  if (location) errors.locationText = location;
  const description = lengthError(values.description, REPORT_LIMITS.description, "a description");
  if (description) errors.description = description;
  return errors;
}

/**
 * New report (UI_UX_GUIDELINES §6, §8). Validates on blur and submit, shows an error summary that
 * takes focus, keeps every value and the photo on failure, and replaces itself with a success panel.
 */
export function ReportForm() {
  const [values, setValues] = useState<Values>(EMPTY);
  const [photo, setPhoto] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [showSummary, setShowSummary] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<Report | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (created) successRef.current?.focus();
  }, [created]);

  const set = (name: keyof Values, value: string) => {
    setValues((v) => ({ ...v, [name]: value }));
    // Once flagged, a field re-validates as the user fixes it.
    if (errors[name]) setErrors((e) => ({ ...e, [name]: validateReport({ ...values, [name]: value }, photo)[name] }));
  };

  const blur = (name: keyof Values) => setErrors((e) => ({ ...e, [name]: validateReport(values, photo)[name] }));

  const choosePhoto = (file: File | null) => {
    setPhoto(file);
    setErrors((e) => ({ ...e, photo: file ? validateReport(values, file).photo : e.photo }));
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const found = validateReport(values, photo);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) {
      setShowSummary(true);
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setShowSummary(false);

    const form = new FormData();
    for (const [name, value] of Object.entries(values)) form.set(name, value.trim());
    if (photo) form.set("photo", photo);

    setPending(true);
    try {
      const { data } = await apiFetch<DataResponse<Report>>("/api/reports", { method: "POST", body: form });
      setCreated(data);
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        const fromServer: Errors = {};
        for (const field of FIELDS) {
          const message = error.fieldErrors[field.name]?.[0];
          if (message) fromServer[field.name] = message;
        }
        setErrors(fromServer);
        setShowSummary(true);
        requestAnimationFrame(() => summaryRef.current?.focus());
      } else {
        // Nothing was saved (the API is all-or-nothing), so trying again is safe. Everything is kept.
        setFormError(
          error instanceof ApiError && error.code !== "INTERNAL_ERROR"
            ? error.message
            : "We couldn't submit your report. Nothing was saved, so you can try again.",
        );
      }
    } finally {
      setPending(false);
    }
  }

  if (created) {
    return (
      <div role="status" className="flex flex-col gap-4 rounded-panel border border-success-border bg-success-soft p-6">
        <h2 ref={successRef} tabIndex={-1} className="font-display text-2xl font-bold text-fg focus:outline-none">
          Report submitted
        </h2>
        <p className="text-fg">
          Thanks. Your society&apos;s managers have been told about <strong>{created.title}</strong>.
        </p>
        <p className="text-sm text-fg-muted">Reference: {created.id.slice(0, 8).toUpperCase()}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href={`/reports/${created.id}`} className="inline-flex min-h-13 items-center justify-center rounded-pill bg-primary px-6 font-semibold text-primary-fg hover:bg-primary-hover">
            View report
          </Link>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              setCreated(null);
              setValues(EMPTY);
              setPhoto(null);
              setErrors({});
            }}
          >
            Report another issue
          </Button>
        </div>
      </div>
    );
  }

  const summary = FIELDS.filter((f) => errors[f.name]);

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-6" aria-busy={pending || undefined}>
      {showSummary && summary.length > 0 && (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded-card border border-danger-border bg-danger-soft p-4 focus:outline-none focus-visible:outline-2 focus-visible:outline-danger">
          <p className="font-bold text-danger">Please fix {summary.length === 1 ? "this" : `these ${summary.length} things`}:</p>
          <ul className="mt-2 list-disc pl-5">
            {summary.map((f) => (
              <li key={f.name}>
                <a href={`#${f.id}`} className="font-semibold text-danger underline" onClick={(e) => (e.preventDefault(), document.getElementById(f.id)?.focus())}>
                  {f.label}: {errors[f.name]}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {formError && (
        <Alert tone="error" title="Not submitted">
          {formError}
        </Alert>
      )}

      <FileDropzone
        id="report-photo"
        label="Photo"
        hint="JPG, PNG or WebP, up to 5 MB"
        accept={REPORT_LIMITS.photoTypes.join(",")}
        file={photo}
        onChange={choosePhoto}
        error={errors.photo}
        required
      />

      <Field id="report-title" label="Title" hint="A few words, e.g. “Streetlight out near Block C”" error={errors.title} required>
        {(control) => (
          <Input {...control} value={values.title} maxLength={REPORT_LIMITS.title.max} onChange={(e) => set("title", e.target.value)} onBlur={() => blur("title")} />
        )}
      </Field>

      <Field id="report-category" label="Category" error={errors.category} required>
        {(control) => (
          <Select {...control} value={values.category} onChange={(e) => set("category", e.target.value)} onBlur={() => blur("category")}>
            <option value="">Choose a category</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field id="report-location" label="Location" hint="Street, landmark or nearest address" error={errors.locationText} required>
        {(control) => (
          <Input
            {...control}
            value={values.locationText}
            maxLength={REPORT_LIMITS.locationText.max}
            onChange={(e) => set("locationText", e.target.value)}
            onBlur={() => blur("locationText")}
          />
        )}
      </Field>

      <Field id="report-description" label="Description" hint="What's wrong, and since when?" error={errors.description} required>
        {(control) => (
          <Textarea
            {...control}
            showCount
            value={values.description}
            maxLength={REPORT_LIMITS.description.max}
            onChange={(e) => set("description", e.target.value)}
            onBlur={() => blur("description")}
          />
        )}
      </Field>

      {/* Phones: the submit button sticks to the bottom of the screen (the tab bar is hidden here). */}
      <div className="sticky bottom-0 -mx-4 border-t border-border bg-canvas/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <Button type="submit" variant="brand" size="lg" fullWidth loading={pending} loadingText="Submitting…">
          Submit report
        </Button>
      </div>
    </form>
  );
}
