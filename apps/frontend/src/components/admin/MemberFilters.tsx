"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

interface MemberFiltersProps {
  q?: string;
  role?: string;
  status?: string;
}

/**
 * A plain GET form: filters live in the URL (shareable, survive refresh) and work without JavaScript.
 * With JavaScript, changing a select applies it straight away.
 */
export function MemberFilters({ q, role, status }: MemberFiltersProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const submit = () => formRef.current?.requestSubmit();

  return (
    <form ref={formRef} method="get" role="search" aria-label="Members" className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
      <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
        <label htmlFor="member-q" className="text-sm font-semibold text-fg">
          Search
        </label>
        <Input id="member-q" name="q" type="search" placeholder="Name or email" defaultValue={q} maxLength={100} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="member-role" className="text-sm font-semibold text-fg">
          Role
        </label>
        <Select id="member-role" name="role" defaultValue={role ?? ""} onChange={submit}>
          <option value="">All roles</option>
          <option value="ADMIN">Admin</option>
          <option value="MANAGER">Manager</option>
          <option value="RESIDENT">Resident</option>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="member-status" className="text-sm font-semibold text-fg">
          Status
        </label>
        <Select id="member-status" name="status" defaultValue={status ?? ""} onChange={submit}>
          <option value="">Everyone</option>
          <option value="ACTIVE">Active</option>
          <option value="INVITED">Invited</option>
          <option value="DISABLED">Disabled</option>
        </Select>
      </div>
      <Button type="submit" variant="secondary" size="lg" className="col-span-2 sm:col-span-1">
        Search
      </Button>
    </form>
  );
}
