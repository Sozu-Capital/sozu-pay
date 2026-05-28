"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SdpDisbursement {
  id: string;
  name: string;
  status: string;
  total_payments: number;
  successful_payments: number;
  failed_payments: number;
  total_amount: string;
  disbursed_amount: string;
  asset: { code: string; issuer: string };
  wallet: { id: string; name: string };
  created_at: string;
}

interface SdpWallet {
  id: string;
  name: string;
  homepage: string;
}

interface SdpAsset {
  id: string;
  code: string;
  issuer: string;
}

interface SdpPayment {
  id: string;
  amount: string;
  status: string;
  stellar_transaction_id: string | null;
  receiver: { id: string; email?: string; phone_number?: string };
  created_at: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const STELLAR_EXPERT =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "public"
    ? "https://stellar.expert/explorer/public"
    : "https://stellar.expert/explorer/testnet";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  READY: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  STARTED: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  PAUSED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  FAILED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  DRAFT: "text-gray-500",
  READY: "text-blue-600",
  PENDING: "text-yellow-600",
  PAUSED: "text-yellow-500",
  SUCCESS: "text-green-600",
  FAILED: "text-red-600",
};

// ── Component ────────────────────────────────────────────────────────────────

export default function DisbursementsPage() {
  // List view
  const [disbursements, setDisbursements] = useState<SdpDisbursement[]>([]);
  const [wallets, setWallets] = useState<SdpWallet[]>([]);
  const [assets, setAssets] = useState<SdpAsset[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [batchName, setBatchName] = useState("");
  const [selectedWalletId, setSelectedWalletId] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detail view
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    disbursement: SdpDisbursement;
    payments: SdpPayment[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Actions
  const [startingId, setStartingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  // ── Fetch list ────────────────────────────────────────────────────────────

  const fetchList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetch("/api/sdp/disbursements");
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setListError(j.error ?? `Error ${res.status}`);
        return;
      }
      const data = await res.json();
      setDisbursements(data.disbursements ?? []);
      setWallets(data.wallets ?? []);
      setAssets(data.assets ?? []);
      if ((data.wallets ?? []).length > 0 && !selectedWalletId) {
        setSelectedWalletId(data.wallets[0].id);
      }
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Network error");
    } finally {
      setListLoading(false);
    }
  }, [selectedWalletId]);

  useEffect(() => {
    fetchList();
  }, []);

  // ── Fetch detail ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedId) return;
    setDetailLoading(true);
    setDetailError(null);
    fetch(`/api/sdp/disbursements/${selectedId}`)
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setDetailError(j.error ?? `Error ${res.status}`);
          return;
        }
        const data = await res.json();
        setDetail({ disbursement: data.disbursement, payments: data.payments ?? [] });
      })
      .catch((e) => setDetailError(e instanceof Error ? e.message : "Network error"))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  // ── Create disbursement ───────────────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!csvFile) {
      setCreateError("Please select a CSV file.");
      return;
    }
    if (!selectedWalletId) {
      setCreateError("Please select a wallet.");
      return;
    }

    setCreating(true);
    setCreateError(null);

    const form = new FormData();
    form.append("name", batchName);
    form.append("walletId", selectedWalletId);
    form.append("file", csvFile);

    try {
      const res = await fetch("/api/sdp/disbursements", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error ?? `Error ${res.status}`);
        return;
      }
      setShowCreate(false);
      setBatchName("");
      setCsvFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchList();
      setSelectedId(data.disbursement.id);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Network error");
    } finally {
      setCreating(false);
    }
  }

  // ── Start disbursement ────────────────────────────────────────────────────

  async function handleStart(id: string) {
    setStartingId(id);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/sdp/disbursements/${id}/start`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setActionMsg(`Error: ${data.error ?? res.status}`);
        return;
      }
      setActionMsg("Disbursement started. Payments are being processed.");
      await fetchList();
      if (selectedId === id) setSelectedId(null);
      setTimeout(() => setSelectedId(id), 100);
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : "Network error");
    } finally {
      setStartingId(null);
    }
  }

  // ── Send invites ──────────────────────────────────────────────────────────

  async function handleSendInvites(id: string) {
    setSendingId(id);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/sdp/disbursements/${id}/send-invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationName: "Sozu" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMsg(`Error: ${data.error ?? res.status}`);
        return;
      }
      setActionMsg(
        `Invites sent: ${data.sent} sent, ${data.skipped} skipped (already registered), ${data.failed} failed.`
      );
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : "Network error");
    } finally {
      setSendingId(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Batch disbursements
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Create CSV-based payment batches via the Stellar Disbursement Platform.
            Recipients receive an invite email and register on SozuCredit.
          </p>
        </div>
        <button
          onClick={() => {
            setShowCreate((v) => !v);
            setCreateError(null);
          }}
          className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
        >
          {showCreate ? "Cancel" : "New batch"}
        </button>
      </div>

      {/* Action message banner */}
      {actionMsg && (
        <div className="rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
          {actionMsg}
          <button
            onClick={() => setActionMsg(null)}
            className="ml-3 text-blue-500 hover:text-blue-700 font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Create new disbursement batch
          </h2>

          {listError && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Warning: could not load wallets/assets from SDP ({listError}). Check{" "}
              <code className="text-xs">SDP_API_URL</code> in your env.
            </p>
          )}

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Batch name
              </label>
              <input
                required
                type="text"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="e.g. Mujeres 2000 — May 2026"
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Recipient wallet
              </label>
              {wallets.length > 0 ? (
                <select
                  required
                  value={selectedWalletId}
                  onChange={(e) => setSelectedWalletId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} — {w.homepage}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  required
                  type="text"
                  value={selectedWalletId}
                  onChange={(e) => setSelectedWalletId(e.target.value)}
                  placeholder="Wallet UUID from SDP admin"
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Payment instructions (CSV)
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Required columns:{" "}
                <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">
                  email,id,amount,verification
                </code>
                {" "}—{" "}
                <a
                  href="/sdp-disbursement-template.csv"
                  download
                  className="text-blue-600 hover:underline"
                >
                  download template
                </a>
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                required
                onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-gray-100 dark:file:bg-gray-700 file:text-sm file:font-medium"
              />
              {csvFile && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {csvFile.name} ({Math.round(csvFile.size / 1024)} KB)
                </p>
              )}
            </div>

            {createError && (
              <p className="text-sm text-red-600 dark:text-red-400">{createError}</p>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
              >
                {creating ? "Creating…" : "Create batch"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Disbursements list */}
      <div className="space-y-3">
        {listLoading && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading disbursements…</p>
        )}
        {!listLoading && listError && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Could not connect to SDP
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">{listError}</p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
              Set <code>SDP_API_URL</code>, <code>SDP_ADMIN_EMAIL</code>, and{" "}
              <code>SDP_ADMIN_PASSWORD</code> in your environment variables.
            </p>
          </div>
        )}
        {!listLoading && !listError && disbursements.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No disbursements yet. Click &quot;New batch&quot; to create the first one.
          </p>
        )}
        {disbursements.map((d) => (
          <div
            key={d.id}
            className={`rounded-xl border cursor-pointer transition-colors ${
              selectedId === d.id
                ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
            onClick={() => setSelectedId(selectedId === d.id ? null : d.id)}
          >
            <div className="flex items-center justify-between px-5 py-4">
              <div className="space-y-0.5 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">{d.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {d.total_payments} payments · {d.asset.code} · {d.wallet.name}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-4">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    STATUS_COLORS[d.status] ?? STATUS_COLORS.DRAFT
                  }`}
                >
                  {d.status}
                </span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {d.total_amount} {d.asset.code}
                </span>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    selectedId === d.id ? "rotate-180" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Expanded detail */}
            {selectedId === d.id && (
              <div
                className="border-t border-gray-200 dark:border-gray-700 px-5 py-4 space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  {(d.status === "READY" || d.status === "DRAFT") && (
                    <button
                      onClick={() => handleStart(d.id)}
                      disabled={startingId === d.id}
                      className="px-3 py-1.5 rounded bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-60"
                    >
                      {startingId === d.id ? "Starting…" : "Start payments"}
                    </button>
                  )}
                  <button
                    onClick={() => handleSendInvites(d.id)}
                    disabled={sendingId === d.id}
                    className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {sendingId === d.id ? "Sending…" : "Send invite emails"}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedId(null);
                      setTimeout(() => setSelectedId(d.id), 100);
                    }}
                    className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Refresh
                  </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Total", value: d.total_payments },
                    { label: "Successful", value: d.successful_payments },
                    { label: "Failed", value: d.failed_payments },
                    { label: "Disbursed", value: `${d.disbursed_amount} ${d.asset.code}` },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2"
                    >
                      <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
                      <p className="text-base font-semibold text-gray-900 dark:text-white">
                        {s.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Payments table */}
                {detailLoading && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Loading payments…</p>
                )}
                {detailError && (
                  <p className="text-sm text-red-600 dark:text-red-400">{detailError}</p>
                )}
                {!detailLoading && detail?.disbursement.id === d.id && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">
                            Recipient
                          </th>
                          <th className="text-right py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">
                            Amount
                          </th>
                          <th className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">
                            Status
                          </th>
                          <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">
                            Tx hash
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.payments.map((p) => (
                          <tr
                            key={p.id}
                            className="border-b border-gray-100 dark:border-gray-800 last:border-0"
                          >
                            <td className="py-2 pr-4 text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
                              {p.receiver.email ?? p.receiver.phone_number ?? p.receiver.id.slice(0, 8)}
                            </td>
                            <td className="py-2 pr-4 text-right text-gray-900 dark:text-white font-medium">
                              {p.amount} {d.asset.code}
                            </td>
                            <td className="py-2 pr-4">
                              <span
                                className={`text-xs font-medium ${
                                  PAYMENT_STATUS_COLORS[p.status] ?? "text-gray-500"
                                }`}
                              >
                                {p.status}
                              </span>
                            </td>
                            <td className="py-2">
                              {p.stellar_transaction_id ? (
                                <a
                                  href={`${STELLAR_EXPERT}/tx/${p.stellar_transaction_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-xs text-blue-600 hover:underline"
                                  title={p.stellar_transaction_id}
                                >
                                  {p.stellar_transaction_id.slice(0, 12)}…
                                </a>
                              ) : (
                                <span className="text-xs text-gray-400">pending</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {detail.payments.length === 0 && (
                          <tr>
                            <td
                              colSpan={4}
                              className="py-4 text-center text-sm text-gray-400"
                            >
                              No payments yet. Upload a CSV to populate recipients.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
