"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ApiError, apiFetch } from "@/lib/api-client";
import { firstName } from "@/lib/format";
import type { InviteResponse, MemberRole, SocietyMember } from "@/types/api";

const ROLE_OPTIONS = [
  { value: "RESIDENT", label: "Resident" },
  { value: "MANAGER", label: "Manager" },
] as const satisfies readonly { value: MemberRole; label: string }[];

type Message = { tone: "success" | "warning" | "error"; text: string } | null;

/**
 * One action per row (UI_UX_GUIDELINES §8 Members): Resend for invited, Enable for disabled,
 * Manage (role + disable) for active. Managers only ever get Resend (MembersList decides).
 */
export function MemberActions({ societyId, member }: { societyId: string; member: SocietyMember }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [role, setRole] = useState<MemberRole>(member.role === "MANAGER" ? "MANAGER" : "RESIDENT");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const name = firstName(member.name);

  async function run(action: () => Promise<Message>) {
    setPending(true);
    setMessage(null);
    try {
      setMessage(await action());
      router.refresh();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof ApiError ? error.message : "Something went wrong. Please try again." });
    } finally {
      setPending(false);
    }
  }

  const close = () => {
    setOpen(false);
    setConfirmDisable(false);
    triggerRef.current?.focus();
  };

  const resend = () =>
    run(async () => {
      const { meta } = await apiFetch<InviteResponse>(`/api/societies/${societyId}/members/${member.id}/invite`, { method: "POST" });
      return meta.invite === "SENT"
        ? { tone: "success", text: `New invite sent to ${name}. The old link no longer works.` }
        : { tone: "warning", text: `A new invite was created for ${name}, but the email could not be sent. Try again later.` };
    });

  const update = (patch: { role?: MemberRole; disabled?: boolean }, done: string) =>
    run(async () => {
      await apiFetch(`/api/societies/${societyId}/members/${member.id}`, { method: "PATCH", body: patch });
      close();
      return { tone: "success", text: done };
    });

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      {member.status === "INVITED" && (
        <Button variant="secondary" size="sm" loading={pending} loadingText="Sending…" onClick={resend} aria-label={pending ? undefined : `Resend invite to ${member.name}`}>
          Resend
        </Button>
      )}
      {member.status === "DISABLED" && (
        <Button variant="secondary" size="sm" loading={pending} loadingText="Enabling…" onClick={() => update({ disabled: false }, `${name} can sign in again.`)} aria-label={pending ? undefined : `Enable ${member.name}`}>
          Enable
        </Button>
      )}
      {member.status === "ACTIVE" && (
        <Button ref={triggerRef} variant="secondary" size="sm" onClick={() => setOpen(true)} aria-label={`Manage ${member.name}`}>
          Manage
        </Button>
      )}
      <div aria-live="polite">{message && <Alert tone={message.tone}>{message.text}</Alert>}</div>

      <Dialog
        open={open}
        onClose={close}
        title={confirmDisable ? `Disable ${member.name}?` : `Manage ${member.name}`}
        description={confirmDisable ? `${name} will be signed out and can't sign in until you enable them again.` : member.email}
      >
        {confirmDisable ? (
          <div className="flex flex-col gap-3 sm:flex-row-reverse">
            <Button variant="danger" fullWidth loading={pending} loadingText="Disabling…" onClick={() => update({ disabled: true }, `${name} is disabled and signed out.`)}>
              Disable member
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setConfirmDisable(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <SegmentedControl label="Role" name={`role-${member.id}`} options={ROLE_OPTIONS} value={role} onChange={setRole} />
            <Button
              fullWidth
              disabled={role === member.role}
              loading={pending}
              loadingText="Saving…"
              onClick={() => update({ role }, `${name} is now a ${role === "MANAGER" ? "manager" : "resident"}.`)}
            >
              Save role
            </Button>
            <div className="border-t border-border pt-4">
              <Button variant="ghost" fullWidth className="text-danger" onClick={() => setConfirmDisable(true)}>
                Disable member…
              </Button>
            </div>
            <Button variant="secondary" fullWidth onClick={close}>
              Close
            </Button>
          </div>
        )}
      </Dialog>
    </div>
  );
}
