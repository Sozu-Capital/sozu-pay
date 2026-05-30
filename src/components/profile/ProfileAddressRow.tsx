"use client";

type ProfileAddressRowProps = {
  label: string;
  address: string;
  explorerHref?: string;
  copiedKey: string;
  activeCopiedKey: string | null;
  onCopy: (text: string, key: string) => void;
  copyLabel: string;
  copiedLabel: string;
};

export function ProfileAddressRow({
  label,
  address,
  explorerHref,
  copiedKey,
  activeCopiedKey,
  onCopy,
  copyLabel,
  copiedLabel,
}: ProfileAddressRowProps) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="flex-1 min-w-0 font-mono text-sm break-all bg-gray-100 dark:bg-gray-700/50 px-2 py-1.5 rounded text-gray-800 dark:text-gray-200">
          {address}
        </code>
        <button
          type="button"
          onClick={() => onCopy(address, copiedKey)}
          className="shrink-0 rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          {activeCopiedKey === copiedKey ? copiedLabel : copyLabel}
        </button>
      </div>
      {explorerHref ? (
        <a
          href={explorerHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          Stellar Expert
        </a>
      ) : null}
    </div>
  );
}
