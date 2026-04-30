"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

interface Wall {
  id: string;
  name: string;
  defaultAmount: string;
  reference: string;
  createdAt: string;
  lastUsedAt: string | null;
  totalVolume: string;
  archived: boolean;
}

const baseUrl =
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default function WallsPage() {
  const t = useTranslations("wallsPage");
  const tc = useTranslations("common");
  const [walls, setWalls] = useState<Wall[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [defaultAmount, setDefaultAmount] = useState("");
  const [reference, setReference] = useState("");

  function load() {
    fetch("/api/walls")
      .then((r) => (r.ok ? r.json() : { walls: [] }))
      .then((d) => setWalls(d.walls ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    fetch("/api/walls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name || t("unnamed"),
        defaultAmount: defaultAmount || "0",
        reference,
      }),
    })
      .then((r) => r.json())
      .then(() => {
        setName("");
        setDefaultAmount("");
        setReference("");
        setShowForm(false);
        load();
      })
      .catch(() => {});
  }

  function toggleArchive(w: Wall) {
    fetch(`/api/walls/${w.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !w.archived }),
    }).then(() => load());
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-1 text-gray-600 dark:text-gray-400">
        {t("subtitle")}
      </p>

      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mt-6 rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2 font-medium"
        >
          {t("createWall")}
        </button>
      ) : (
        <form onSubmit={handleCreate} className="mt-6 max-w-md space-y-4 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div>
            <label className="block text-sm font-medium">{t("name")}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">{t("defaultAmount")}</label>
            <input
              type="text"
              inputMode="decimal"
              value={defaultAmount}
              onChange={(e) => setDefaultAmount(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">{t("reference")}</label>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2"
            >
              {tc("create")}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2"
            >
              {tc("cancel")}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="mt-6 animate-pulse h-24 rounded-lg border border-gray-200 dark:border-gray-700" />
      ) : (
        <ul className="mt-6 space-y-4">
          {walls.map((w) => {
            const shareUrl = `${baseUrl}/pay/${w.id}`;
            return (
              <li
                key={w.id}
                className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex flex-wrap items-start justify-between gap-4"
              >
                <div>
                  <h2 className="font-semibold">{w.name}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t("defaultLine", { amount: w.defaultAmount })}
                    {w.reference ? ` · ${w.reference}` : ""}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {t("lastUsed", {
                      when: w.lastUsedAt ? new Date(w.lastUsedAt).toLocaleDateString() : tc("never"),
                      vol: w.totalVolume,
                    })}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <a
                    href={shareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {shareUrl}
                  </a>
                  <a
                    href={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-600 dark:text-gray-400"
                  >
                    {t("qrCode")}
                  </a>
                  <button
                    type="button"
                    onClick={() => toggleArchive(w)}
                    className="text-sm text-amber-600 dark:text-amber-400"
                  >
                    {w.archived ? t("unarchive") : t("archive")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
