import { Avatar } from "@/components/ui/Avatar";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ROLE_LABELS } from "@/lib/format";
import type { SocietyMember, UserRole, UserStatus } from "@/types/api";
import { MemberActions } from "./MemberActions";

const STATUS: Record<UserStatus, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: "Active", tone: "success" },
  INVITED: { label: "Invited", tone: "warning" },
  DISABLED: { label: "Disabled", tone: "neutral" },
};

const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

/**
 * Member rows as rounded cards (no table, so nothing scrolls sideways on phones).
 * Admins manage every member; managers can only resend a resident's invite, never their own row.
 */
export function MembersList({
  societyId,
  members,
  currentUserId,
  viewerRole,
  filtered,
}: {
  societyId: string;
  members: SocietyMember[];
  currentUserId: string;
  viewerRole: UserRole;
  filtered: boolean;
}) {
  const isManager = viewerRole === "MANAGER";
  if (members.length === 0) {
    return (
      <EmptyState
        title={filtered ? "No members match" : "No members yet"}
        description={filtered ? "Try another name, role or status." : "Invite the first manager or resident to get started."}
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {members.map((member) => {
        const editable = member.id !== currentUserId && (!isManager || (member.role === "RESIDENT" && member.status === "INVITED"));
        const status = STATUS[member.status];
        return (
          <li key={member.id} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar name={member.name} />
              <div className="min-w-0">
                <p className="truncate font-bold text-fg">
                  {member.name}
                  {member.id === currentUserId && <span className="font-normal text-fg-muted"> (you)</span>}
                </p>
                <p className="truncate text-sm text-fg-muted">
                  {member.status === "INVITED" && member.inviteExpiresAt
                    ? `Invite expires ${dayFormat.format(new Date(member.inviteExpiresAt))}`
                    : member.email}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <span className="text-sm font-semibold text-fg-muted">{ROLE_LABELS[member.role]}</span>
              <Badge tone={status.tone}>{status.label}</Badge>
            </div>
            {editable && (
              <div className="sm:w-36">
                <MemberActions societyId={societyId} member={member} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
