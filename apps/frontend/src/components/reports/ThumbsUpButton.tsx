"use client";

import { useState } from "react";
import { ApiError, apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import type { DataResponse, VoteState } from "@/types/api";
import { ThumbsUpIcon } from "./ThumbsUpIcon";

interface ThumbsUpButtonProps {
  reportId: string;
  initial: VoteState;
  /** Your own report: count only, no button. */
  isMine: boolean;
  /** Resolved/rejected: count only, no button. */
  closed: boolean;
}

/**
 * Thumbs-up ("this affects me too"). A toggle (`aria-pressed`) that updates the count from the API's
 * answer, so it stays right even if someone else voted meanwhile.
 */
export function ThumbsUpButton({ reportId, initial, isMine, closed }: ThumbsUpButtonProps) {
  const [state, setState] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = `${state.voteCount} ${state.voteCount === 1 ? "thumbs-up" : "thumbs-ups"}`;

  if (isMine || closed) {
    return (
      <p className="inline-flex min-h-11 items-center gap-2 font-semibold text-fg-muted">
        <ThumbsUpIcon className="size-5" />
        {label}
      </p>
    );
  }

  async function toggle() {
    setPending(true);
    setError(null);
    try {
      const { data } = await apiFetch<DataResponse<VoteState>>(`/api/reports/${reportId}/votes`, { method: state.hasVoted ? "DELETE" : "POST" });
      setState(data);
    } catch (err) {
      // Already counted (another tab): show it as given.
      if (err instanceof ApiError && err.code === "ALREADY_VOTED") setState((s) => ({ ...s, hasVoted: true }));
      else setError(err instanceof ApiError ? err.message : "That didn't work. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        aria-pressed={state.hasVoted}
        aria-label={`Thumbs up, ${label}`}
        title={state.hasVoted ? "Remove your thumbs-up" : "This affects me too"}
        disabled={pending}
        onClick={toggle}
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-pill border px-4 font-semibold tabular-nums transition-colors disabled:opacity-60",
          state.hasVoted ? "border-primary bg-primary text-primary-fg hover:bg-primary-hover" : "border-border-strong bg-surface text-fg hover:bg-surface-muted",
        )}
      >
        <ThumbsUpIcon filled={state.hasVoted} className="size-5" />
        {state.voteCount}
      </button>
      <div aria-live="polite">{error && <p className="text-sm font-semibold text-danger">{error}</p>}</div>
    </div>
  );
}
