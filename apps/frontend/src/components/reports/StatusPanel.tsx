"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { Textarea } from "@/components/ui/Textarea";
import { ApiError, apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { REPORT_LIMITS, STATUS_META, STATUS_TRANSITIONS } from "@/lib/reports";
import type { ReportStatus, UpdateStatusInput } from "@/types/api";

/** What each move means, in words a manager would use. */
const ACTIONS: Record<ReportStatus, { label: string; hint: string }> = {
  IN_PROGRESS: { label: "Start work", hint: "Someone is looking into it." },
  RESOLVED: { label: "Mark as resolved", hint: "The problem is fixed. You can add a photo of the result." },
  REJECTED: { label: "Reject", hint: "Not something the society will act on. Say why in the note." },
  OPEN: { label: "Move back to open", hint: "Work stopped; it's waiting again." },
};

const FINAL: readonly ReportStatus[] = ["RESOLVED", "REJECTED"];

type Message = { tone: "success" | "warning" | "error"; text: string } | null;

/**
 * "Update status" for MANAGER/ADMIN (UI_UX_GUIDELINES §8): only the allowed next statuses, an optional
 * note for residents, a confirmation before a final status, and an optional photo when resolving.
 * The API enforces the same rules; this only offers what will be accepted.
 */
export function StatusPanel({ reportId, status }: { reportId: string; status: ReportStatus }) {
  const router = useRouter();
  const options = STATUS_TRANSITIONS[status];
  const [choice, setChoice] = useState<ReportStatus | null>(null);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  if (options.length === 0) {
    return (
      <p className="text-fg-muted">
        This report is {STATUS_META[status].label.toLowerCase()}. That&apos;s final, so its status can&apos;t change any more.
      </p>
    );
  }

  async function save() {
    if (!choice) return;
    setConfirming(false);
    setPending(true);
    setMessage(null);
    try {
      const body: UpdateStatusInput = { status: choice, ...(note.trim() ? { note: note.trim() } : {}) };
      await apiFetch(`/api/reports/${reportId}/status`, { method: "PATCH", body });
      let done: Message = { tone: "success", text: `Status changed to ${STATUS_META[choice].label}.` };
      if (choice === "RESOLVED" && photo) {
        const form = new FormData();
        form.set("photo", photo);
        try {
          await apiFetch(`/api/reports/${reportId}/media`, { method: "POST", body: form });
        } catch (error) {
          done = {
            tone: "warning",
            text: `Status changed to Resolved, but the photo wasn't added: ${error instanceof ApiError ? error.message : "please try again."}`,
          };
        }
      }
      setMessage(done);
      setChoice(null);
      setNote("");
      setPhoto(null);
      router.refresh(); // badge, timeline and photos come from the server
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof ApiError ? error.message : "Something went wrong. Please try again." });
      // 409: someone else changed it first; show the current state.
      if (error instanceof ApiError && error.code === "INVALID_STATUS_TRANSITION") router.refresh();
    } finally {
      setPending(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!choice) return setMessage({ tone: "error", text: "Choose what to do with this report." });
    if (FINAL.includes(choice)) return setConfirming(true);
    void save();
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <div aria-live="polite">{message && <Alert tone={message.tone}>{message.text}</Alert>}</div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold text-fg">New status</legend>
        {options.map((option) => (
          <label
            key={option}
            className={cn(
              "flex min-h-13 cursor-pointer items-start gap-3 rounded-field border p-4 transition-colors",
              choice === option ? "border-primary bg-primary-soft" : "border-border-strong bg-surface hover:bg-surface-muted",
            )}
          >
            <input
              type="radio"
              name="status"
              value={option}
              checked={choice === option}
              onChange={() => setChoice(option)}
              className="mt-1 size-5 shrink-0 accent-[var(--color-primary)]"
            />
            <span className="flex flex-col">
              <span className="font-semibold text-fg">{ACTIONS[option].label}</span>
              <span className="text-sm text-fg-muted">{ACTIONS[option].hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="status-note" className="text-sm font-semibold text-fg">
          Note for residents <span className="font-normal text-fg-muted">(optional)</span>
        </label>
        <Textarea id="status-note" value={note} showCount maxLength={1000} onChange={(e) => setNote(e.target.value)} className="min-h-24" />
      </div>
      {choice === "RESOLVED" && (
        <FileDropzone
          id="resolution-photo"
          label="Photo of the fix (optional)"
          hint="JPG, PNG or WebP, up to 5 MB"
          accept={REPORT_LIMITS.photoTypes.join(",")}
          file={photo}
          onChange={setPhoto}
        />
      )}
      <Button type="submit" size="lg" fullWidth loading={pending} loadingText="Saving…">
        Save status
      </Button>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={choice === "REJECTED" ? "Reject this report?" : "Mark as resolved?"}
        description="This is final: the status can't be changed again afterwards."
      >
        <div className="flex flex-col gap-3 sm:flex-row-reverse">
          <Button variant={choice === "REJECTED" ? "danger" : "primary"} fullWidth onClick={() => void save()}>
            {choice === "REJECTED" ? "Reject report" : "Mark as resolved"}
          </Button>
          <Button variant="secondary" fullWidth onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      </Dialog>
    </form>
  );
}
