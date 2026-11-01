import type { Metadata } from "next";
import { Suspense } from "react";
import { AppearanceSetting } from "@/components/auth/AppearanceSetting";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { Container } from "@/components/layout/Container";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ROLE_LABELS } from "@/lib/format";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <Container className="flex max-w-xl flex-col gap-6 pt-6">
      <Suspense fallback={<Skeleton className="h-28" />}>
        <ProfileHeader />
      </Suspense>
      <section aria-labelledby="appearance" className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5">
        <h2 id="appearance" className="font-display text-xl font-bold text-fg">
          Appearance
        </h2>
        <AppearanceSetting />
      </section>
      <Suspense fallback={<Skeleton className="h-40" />}>
        <AccountDetails />
      </Suspense>
      <Suspense>
        <SocietyLinks />
      </Suspense>
      <SignOutButton />
    </Container>
  );
}

async function ProfileHeader() {
  const user = await requireUser();
  return (
    <div className="flex items-center gap-4">
      <Avatar name={user.name} size="lg" />
      <div className="min-w-0">
        <h1 className="truncate font-display text-display font-bold text-fg">{user.name}</h1>
        <p className="text-fg-muted">
          {ROLE_LABELS[user.role]}
          {user.society && ` · ${user.society.name}`}
        </p>
      </div>
    </div>
  );
}

async function AccountDetails() {
  const user = await requireUser();
  const rows = [
    { label: "Email", value: user.email },
    { label: "Role", value: ROLE_LABELS[user.role] },
    // Admins run every society from outside (D028).
    { label: "Society", value: user.society?.name ?? "All societies" },
  ];
  return (
    <section aria-labelledby="account" className="rounded-card border border-border bg-surface p-5">
      <h2 id="account" className="sr-only">
        Account
      </h2>
      <dl className="flex flex-col divide-y divide-border">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
            <dt className="text-fg-muted">{row.label}</dt>
            <dd className="min-w-0 font-semibold break-words text-fg">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Phones have no header nav and the tab bar has no room, so managers reach Members from here. */
async function SocietyLinks() {
  const user = await requireUser();
  if (user.role !== "MANAGER") return null;
  return (
    <ButtonLink href="/members" variant="secondary" size="lg">
      Members
    </ButtonLink>
  );
}
