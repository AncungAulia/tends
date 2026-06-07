"use client";

import Link from "next/link";
import { Card } from "@/components/elements/Card";
import { Skeleton } from "@/components/elements/Skeleton";
import { useActivity } from "@/hooks/useActivityLog";
import { relativeTime, formatAction } from "@/utils/format";

export function AgentActivityFeed() {
  const { activities, isLoading } = useActivity(5);

  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-edge px-6 py-4">
        <h3 className="font-sans text-sm font-semibold text-ink">
          Agent Activity
        </h3>
        <Link
          href="/activity"
          className="font-mono text-[0.65rem] uppercase tracking-[0.06em] text-brand hover:underline"
        >
          View all
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3 p-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      ) : activities.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <p className="text-sm text-dim">No activity yet.</p>
          <p className="text-xs text-faint">
            Tends Agent begins working after your first deposit.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-edge/60 dark:divide-white/5">
          {activities.map((a) => (
            <li key={a.id} className="flex items-center justify-between px-6 py-3 text-sm">
              <span className="inline-flex items-center gap-2 text-ink">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                {formatAction(a.action)}
              </span>
              <span className="font-mono text-xs text-dim">
                {relativeTime(a.timestamp)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
