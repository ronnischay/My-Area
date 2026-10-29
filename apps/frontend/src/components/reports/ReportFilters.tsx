"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { CATEGORIES, STATUSES } from "@/lib/reports";

interface ReportFiltersProps {
  q?: string;
  status?: string;
  category?: string;
  mine: boolean;
}

/**
 * GET form: filters live in the URL (shareable, survive refresh, work without JavaScript). Behind a
 * "Filters" toggle on phones (open when a filter is set), always shown from md. Changing a select or
 * "Only mine" applies it straight away.
 */
export function ReportFilters({ q, status, category, mine }: ReportFiltersProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const submit = () => formRef.current?.requestSubmit();
  const active = [q, status, category, mine ? "mine" : undefined].filter(Boolean).length;
  const [open, setOpen] = useState(active > 0);
  const panelId = useId();

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-13 items-center justify-between rounded-card border border-border bg-surface px-4 font-semibold text-fg md:hidden"
      >
        Filters{active > 0 && ` (${active})`}
        <span aria-hidden="true" className={open ? "rotate-180" : undefined}>
          ▾
        </span>
      </button>
      <div id={panelId} className={open ? "block" : "hidden md:block"}>
        <form
          ref={formRef}
          method="get"
          action="/reports"
          role="search"
          aria-label="Reports"
          className="grid grid-cols-2 items-end gap-3 md:grid-cols-[1fr_auto_auto_auto_auto]"
        >
          <div className="col-span-2 flex flex-col gap-1.5 md:col-span-1">
            <label htmlFor="report-q" className="text-sm font-semibold text-fg">
              Search
            </label>
            <Input id="report-q" name="q" type="search" placeholder="Title or location" defaultValue={q} maxLength={100} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="report-status" className="text-sm font-semibold text-fg">
              Status
            </label>
            <Select id="report-status" name="status" defaultValue={status ?? ""} onChange={submit}>
              <option value="">Any status</option>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="report-category-filter" className="text-sm font-semibold text-fg">
              Category
            </label>
            <Select id="report-category-filter" name="category" defaultValue={category ?? ""} onChange={submit}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <label className="col-span-2 flex min-h-13 items-center gap-3 rounded-field border border-border-strong bg-surface px-4 font-semibold text-fg md:col-span-1">
            <input type="checkbox" name="mine" value="true" defaultChecked={mine} onChange={submit} className="size-5 accent-[var(--color-primary)]" />
            Only mine
          </label>
          <Button type="submit" variant="secondary" size="lg" className="col-span-2 md:col-span-1">
            Search
          </Button>
        </form>
      </div>
    </div>
  );
}
