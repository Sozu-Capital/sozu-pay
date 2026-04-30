"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { CreditPoolSegmentId } from "@/lib/credit/mock-org-dashboard";
import {
  MOCK_CREDIT_POOL_SEGMENTS,
  MOCK_CREDIT_POOL_TOTAL_USD,
  MOCK_POOL_SEGMENT_STROKES,
} from "@/lib/credit/mock-org-dashboard";

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function annulusSectorPath(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startAngle: number,
  endAngle: number
): string {
  const p1 = polar(cx, cy, rOuter, startAngle);
  const p2 = polar(cx, cy, rOuter, endAngle);
  const p3 = polar(cx, cy, rInner, endAngle);
  const p4 = polar(cx, cy, rInner, startAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${p4.x} ${p4.y}`,
    "Z",
  ].join(" ");
}

const SEGMENT_LABEL_KEY: Record<CreditPoolSegmentId, string> = {
  available: "segmentAvailable",
  allocated: "segmentAllocated",
  in_repayment: "segmentRepayment",
  overdue: "segmentOverdue",
};

export function CreditPoolDonut() {
  const t = useTranslations("creditPage");
  const [activeId, setActiveId] = useState<CreditPoolSegmentId | null>(null);

  const total = MOCK_CREDIT_POOL_TOTAL_USD;
  const segments = MOCK_CREDIT_POOL_SEGMENTS;

  const arcs = useMemo(() => {
    let angle = 0;
    return segments.map((seg) => {
      const sweep = (seg.amountUsd / total) * 360;
      const start = angle;
      const end = angle + sweep;
      angle = end;
      return { ...seg, start, end, path: annulusSectorPath(50, 50, 28, 45, start, end) };
    });
  }, [segments, total]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);

  const active = activeId
    ? segments.find((s) => s.id === activeId)
    : null;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col items-center sm:flex-row sm:items-start sm:gap-8">
          <div className="relative shrink-0">
            <svg
              viewBox="0 0 100 100"
              className="h-48 w-48"
              role="img"
              aria-label={t("poolSummary")}
            >
              {arcs.map((a) => (
                <path
                  key={a.id}
                  d={a.path}
                  fill={MOCK_POOL_SEGMENT_STROKES[a.id]}
                  className="cursor-pointer transition-opacity hover:opacity-90"
                  opacity={activeId && activeId !== a.id ? 0.35 : 1}
                  onClick={() => setActiveId((id) => (id === a.id ? null : a.id))}
                />
              ))}
              <circle cx="50" cy="50" r="24" className="fill-white dark:fill-gray-900" />
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t("totalPool")}
              </p>
              <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-white">
                {fmt(total)}
              </p>
            </div>
          </div>
          <div className="mt-4 w-full max-w-sm space-y-2 sm:mt-0">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t("clickSegment")}</p>
            <ul className="space-y-2 text-sm">
              {segments.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId((id) => (id === s.id ? null : s.id))}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                      activeId === s.id
                        ? "border-gray-900 bg-gray-50 dark:border-white dark:bg-gray-800"
                        : "border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/80"
                    }`}
                  >
                    <span className={`font-medium ${s.colorClass}`}>
                      {t(SEGMENT_LABEL_KEY[s.id] as "segmentAvailable")}
                    </span>
                    <span className="tabular-nums text-gray-900 dark:text-white">
                      {fmt(s.amountUsd)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="min-h-[4rem] rounded-lg border border-dashed border-gray-200 bg-gray-50/80 p-4 text-sm dark:border-gray-600 dark:bg-gray-900/40">
          {active ? (
            <p className="text-gray-700 dark:text-gray-200">
              <span className="font-semibold text-gray-900 dark:text-white">
                {t(SEGMENT_LABEL_KEY[active.id] as "segmentAvailable")}
              </span>
              {": "}
              {fmt(active.amountUsd)} ({((active.amountUsd / total) * 100).toFixed(1)}%)
            </p>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">{t("poolSummary")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
