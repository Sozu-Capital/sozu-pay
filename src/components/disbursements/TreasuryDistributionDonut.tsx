"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

type Props = {
  treasuryUsdc: string;
  distributionUsdc: string;
  className?: string;
};

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

export function TreasuryDistributionDonut({
  treasuryUsdc,
  distributionUsdc,
  className = "",
}: Props) {
  const t = useTranslations("disbursementsPage.distributionTreasury");

  const treasury = Math.max(0, parseFloat(treasuryUsdc) || 0);
  const distribution = Math.max(0, parseFloat(distributionUsdc) || 0);
  const total = treasury + distribution;

  const segments = useMemo(() => {
    if (total <= 0) {
      return [
        { id: "treasury" as const, amount: 0, pct: 50, color: "#6366f1" },
        { id: "distribution" as const, amount: 0, pct: 50, color: "#10b981" },
      ];
    }
    const treasuryPct = (treasury / total) * 100;
    return [
      {
        id: "treasury" as const,
        amount: treasury,
        pct: treasuryPct,
        color: "#6366f1",
      },
      {
        id: "distribution" as const,
        amount: distribution,
        pct: 100 - treasuryPct,
        color: "#10b981",
      },
    ];
  }, [treasury, distribution, total]);

  const arcs = useMemo(() => {
    let angle = 0;
    return segments.map((seg) => {
      const sweep = total > 0 ? (seg.amount / total) * 360 : 180;
      const start = angle;
      const end = angle + sweep;
      angle = end;
      return {
        ...seg,
        start,
        end,
        path: annulusSectorPath(50, 50, 28, 45, start, end),
      };
    });
  }, [segments, total]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);

  return (
    <div className={`flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6 ${className}`}>
      <div className="relative shrink-0">
        <svg viewBox="0 0 100 100" className="h-36 w-36" aria-hidden>
          {arcs.map((arc) => (
            <path key={arc.id} d={arc.path} fill={arc.color} opacity={total > 0 ? 1 : 0.25} />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">{fmt(total)}</span>
        </div>
      </div>
      <ul className="space-y-2 text-sm min-w-[10rem]">
        {segments.map((seg) => (
          <li key={seg.id} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: seg.color }}
              />
              {seg.id === "treasury" ? t("orgTreasury") : t("sdpDistribution")}
            </span>
            <span className="font-medium text-gray-900 dark:text-white tabular-nums">
              {total > 0 ? `${seg.pct.toFixed(0)}%` : "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
