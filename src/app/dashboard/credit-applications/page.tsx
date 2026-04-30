"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDashboardProfile } from "@/contexts/DashboardProfileContext";

type AppRow = {
  id: string;
  status: string;
  requested_principal: number;
  submitted_at: string | null;
  applicant_profile: Record<string, unknown>;
};

export default function CreditApplicationsInboxPage() {
  const { profile, loading: profileLoading } = useDashboardProfile() ?? {
    profile: null,
    loading: true,
  };
  const [apps, setApps] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const isStaff =
    profile?.admin_level === "admin" ||
    profile?.admin_level === "super_admin";

  useEffect(() => {
    if (!isStaff || profileLoading) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/credit/org/applications", {
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Failed to load");
          return;
        }
        if (!cancelled) setApps(data.applications ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isStaff, profileLoading]);

  async function review(id: string, action: "approve" | "reject") {
    setActionId(id);
    setError(null);
    try {
      const res = await fetch(`/api/credit/org/applications/${id}/review`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          rejectionReason:
            action === "reject" ? "Does not meet criteria at this time." : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Action failed");
        return;
      }
      setApps((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, status: action === "approve" ? "approved" : "rejected" }
            : a
        )
      );
    } finally {
      setActionId(null);
    }
  }

  if (profileLoading || loading) {
    return (
      <div className="animate-pulse h-32 rounded-lg bg-gray-100 dark:bg-gray-800" />
    );
  }

  if (!isStaff) {
    return (
      <p className="text-gray-600 dark:text-gray-400">
        You need staff access to review applications.
      </p>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Credit applications
      </h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Review beneficiary requests. Approvals create a loan schedule and notify the applicant by
        email.
      </p>
      <p className="mt-2">
        <Link
          href="/dashboard/credit"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          ← Credit overview
        </Link>
      </p>

      {error && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="mt-6 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th className="text-left p-3 font-medium">Applicant</th>
              <th className="text-left p-3 font-medium">Amount</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Submitted</th>
              <th className="text-right p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {apps.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-gray-500 text-center">
                  No applications yet.
                </td>
              </tr>
            ) : (
              apps.map((a) => {
                const name =
                  typeof a.applicant_profile.full_name === "string"
                    ? a.applicant_profile.full_name
                    : "—";
                const pending =
                  a.status === "submitted" || a.status === "under_review";
                return (
                  <tr
                    key={a.id}
                    className="border-t border-gray-200 dark:border-gray-700"
                  >
                    <td className="p-3 font-medium">{name}</td>
                    <td className="p-3 tabular-nums">
                      {Number(a.requested_principal).toFixed(2)} USD
                    </td>
                    <td className="p-3 capitalize">{a.status}</td>
                    <td className="p-3 text-gray-600 dark:text-gray-400">
                      {a.submitted_at
                        ? new Date(a.submitted_at).toLocaleString()
                        : "—"}
                    </td>
                    <td className="p-3 text-right space-x-2">
                      {pending && (
                        <>
                          <button
                            type="button"
                            disabled={actionId === a.id}
                            onClick={() => review(a.id, "approve")}
                            className="rounded border border-green-600 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 dark:text-green-400 dark:border-green-500 dark:hover:bg-green-900/20 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={actionId === a.id}
                            onClick={() => review(a.id, "reject")}
                            className="rounded border border-gray-400 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-800 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
