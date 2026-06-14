"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckoutPreviewCard } from "@/components/CheckoutPreviewCard";

type Session = {
  id: string;
  status: string;
  amountUsd: string;
  reference: string | null;
  createdAt: string;
  paymentMethod?: string | null;
  allowDebit?: boolean;
  allowCredit?: boolean;
  allowBankTransfer?: boolean;
  stellarTxHash?: string | null;
  completedPaymentMethod?: string | null;
};

export default function CheckoutPage() {
  const t = useTranslations("checkoutPage");
  const [amountUsd, setAmountUsd] = useState("");
  const [reference, setReference] = useState("");
  const [allowDebit, setAllowDebit] = useState(true);
  const [allowCredit, setAllowCredit] = useState(true);
  const [allowBankTransfer, setAllowBankTransfer] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ checkoutUrl: string; id: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editReference, setEditReference] = useState("");
  const [editAllowDebit, setEditAllowDebit] = useState(true);
  const [editAllowCredit, setEditAllowCredit] = useState(true);
  const [editAllowBankTransfer, setEditAllowBankTransfer] = useState(true);
  const [editBusy, setEditBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const loadSessions = useCallback(() => {
    setLoadingSessions(true);
    fetch("/api/checkout/list")
      .then((r) => (r.ok ? r.json() : { sessions: [] }))
      .then((d) => setSessions(d.sessions ?? []))
      .finally(() => setLoadingSessions(false));
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    const amount = parseFloat(amountUsd);
    if (!isFinite(amount) || amount <= 0) {
      setError(t("invalidAmount"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          amountUsd: amountUsd.trim(), 
          reference: reference.trim() || undefined,
          allowDebit,
          allowCredit,
          allowBankTransfer,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data.error as string) ?? t("createFailed"));
        return;
      }
      setResult({ checkoutUrl: data.checkoutUrl, id: data.id });
      setAmountUsd("");
      setReference("");
      setAllowDebit(true);
      setAllowCredit(true);
      setAllowBankTransfer(true);
      loadSessions();
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = (session: Session) => {
    setEditingId(session.id);
    setEditAmount(session.amountUsd);
    setEditReference(session.reference ?? "");
    setEditAllowDebit(session.allowDebit ?? true);
    setEditAllowCredit(session.allowCredit ?? true);
    setEditAllowBankTransfer(session.allowBankTransfer ?? true);
  };

  const handleSaveEdit = async (id: string) => {
    const amount = parseFloat(editAmount);
    if (!isFinite(amount) || amount <= 0) {
      setError(t("invalidAmount"));
      return;
    }
    setEditBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/checkout/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountUsd: editAmount.trim(),
          reference: editReference.trim() || undefined,
          allowDebit: editAllowDebit,
          allowCredit: editAllowCredit,
          allowBankTransfer: editAllowBankTransfer,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data.error as string) ?? "Update failed");
        return;
      }
      setEditingId(null);
      loadSessions();
    } finally {
      setEditBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("confirmDelete") ?? "Delete this payment link?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/checkout/${id}`, { method: "DELETE" });
      if (res.ok) {
        loadSessions();
      }
    } finally {
      setDeletingId(null);
    }
  };

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: no-op
    }
  };

  const handleViewReceipt = (session: Session) => {
    setSelectedSession(session);
    setShowReceipt(true);
  };

  const handleDownloadPDF = async () => {
    if (!selectedSession) return;
    // TODO: Implement PDF download functionality
    alert("PDF download functionality to be implemented");
  };

  const handleSendReceipt = async () => {
    if (!selectedSession) return;
    // TODO: Implement send receipt functionality
    alert("Send receipt functionality to be implemented");
  };

  const statusColor = (s: string) =>
    s === "completed"
      ? "text-emerald-600 dark:text-emerald-400"
      : s === "failed"
        ? "text-red-600 dark:text-red-400"
        : "text-amber-600 dark:text-amber-400";

  const checkoutBaseUrl =
    process.env.NEXT_PUBLIC_SOZUCREDIT_URL?.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "");

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t("title")}</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("subtitle")}</p>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create form */}
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-6 space-y-4"
        >
          <h2 className="font-semibold text-gray-900 dark:text-white">{t("newLink")}</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("amountLabel")}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 dark:text-gray-400 font-medium">$</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amountUsd}
                onChange={(e) => setAmountUsd(e.target.value)}
                placeholder="0.00"
                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">USD</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("referenceLabel")}
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={t("referencePlaceholder")}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Payment methods
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={allowDebit}
                  onChange={(e) => setAllowDebit(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="text-gray-700 dark:text-gray-300">Debit card</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={allowCredit}
                  onChange={(e) => setAllowCredit(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="text-gray-700 dark:text-gray-300">Credit card</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={allowBankTransfer}
                  onChange={(e) => setAllowBankTransfer(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="text-gray-700 dark:text-gray-300">Bank transfer</span>
              </label>
            </div>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 text-sm transition-colors"
          >
            {busy ? t("creating") : t("createButton")}
          </button>
        </form>

        {/* Preview */}
        {amountUsd && (
          <CheckoutPreviewCard
            amountUsd={amountUsd || "0.00"}
            reference={reference}
            allowDebit={allowDebit}
            allowCredit={allowCredit}
            allowBankTransfer={allowBankTransfer}
          />
        )}
      </div>

      {/* Created link */}
      {result && (
        <div className="mt-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4">
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">{t("linkReady")}</p>
          <p className="mt-1 text-xs break-all text-gray-700 dark:text-gray-300">{result.checkoutUrl}</p>
          <button
            onClick={() => copyLink(result.checkoutUrl)}
            className="mt-3 rounded-lg border border-emerald-400 dark:border-emerald-600 px-4 py-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-800/40 transition-colors"
          >
            {copied ? t("copied") : t("copyLink")}
          </button>
        </div>
      )}

      {/* History */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("historyTitle")}</h2>
        {loadingSessions ? (
          <div className="mt-3 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{t("noHistory")}</p>
        ) : (
          <div className="mt-3 space-y-2">
            {sessions.map((s) => (
              <div 
                key={s.id} 
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-4"
              >
                {editingId === s.id ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 dark:text-gray-400 text-sm">$</span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                      />
                      <span className="text-sm text-gray-500">USD</span>
                    </div>
                    <input
                      type="text"
                      value={editReference}
                      onChange={(e) => setEditReference(e.target.value)}
                      placeholder="Reference"
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    />
                    <div className="space-y-1">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editAllowDebit}
                          onChange={(e) => setEditAllowDebit(e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-gray-700 dark:text-gray-300">Debit card</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editAllowCredit}
                          onChange={(e) => setEditAllowCredit(e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-gray-700 dark:text-gray-300">Credit card</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editAllowBankTransfer}
                          onChange={(e) => setEditAllowBankTransfer(e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-gray-700 dark:text-gray-300">Bank transfer</span>
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveEdit(s.id)}
                        disabled={editBusy}
                        className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 text-sm font-medium"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        disabled={editBusy}
                        className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    className="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    onClick={() => handleViewReceipt(s)}
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-gray-900 dark:text-white">${s.amountUsd}</span>
                        {s.reference && (
                          <span className="text-sm text-gray-600 dark:text-gray-400">{s.reference}</span>
                        )}
                        <span className={`text-sm font-medium capitalize ${statusColor(s.status)}`}>
                          {s.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {s.createdAt && !Number.isNaN(Date.parse(s.createdAt))
                          ? new Date(s.createdAt).toLocaleDateString()
                          : "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); copyLink(`${checkoutBaseUrl}/checkout/${s.id}`); }}
                        className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        Copy link
                      </button>
                      {s.status === "pending" && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEdit(s); }}
                            className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                            disabled={deletingId === s.id}
                            className="rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 px-3 py-1.5 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Receipt Modal */}
      {showReceipt && selectedSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Payment Receipt</h3>
              <button
                onClick={() => setShowReceipt(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Amount</span>
                  <span className="font-medium text-gray-900 dark:text-white">${selectedSession.amountUsd} USD</span>
                </div>
                {selectedSession.reference && (
                  <div className="flex justify-between mt-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Reference</span>
                    <span className="text-sm text-gray-900 dark:text-white">{selectedSession.reference}</span>
                  </div>
                )}
                <div className="flex justify-between mt-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
                  <span className={`text-sm font-medium capitalize ${statusColor(selectedSession.status)}`}>
                    {selectedSession.status}
                  </span>
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Date</span>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {selectedSession.createdAt && !Number.isNaN(Date.parse(selectedSession.createdAt))
                      ? new Date(selectedSession.createdAt).toLocaleString()
                      : "—"}
                  </span>
                </div>
                {selectedSession.stellarTxHash && (
                  <div className="flex justify-between mt-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Transaction</span>
                    <span className="text-xs text-gray-900 dark:text-white font-mono break-all max-w-[200px]">
                      {selectedSession.stellarTxHash}
                    </span>
                  </div>
                )}
                {selectedSession.completedPaymentMethod && (
                  <div className="flex justify-between mt-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Payment Method</span>
                    <span className="text-sm text-gray-900 dark:text-white capitalize">
                      {selectedSession.completedPaymentMethod}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleDownloadPDF}
                  className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Download PDF
                </button>
                <button
                  onClick={handleSendReceipt}
                  className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-medium transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
