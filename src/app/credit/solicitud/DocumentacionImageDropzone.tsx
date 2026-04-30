"use client";

import { useCallback, useState } from "react";

type Props = {
  fileNames: string[];
  onFilesChange: (names: string[]) => void;
  label: string;
  hint: string;
};

/**
 * Mock UX for foto upload — no backend; stores file names only for demo.
 */
export function DocumentacionImageDropzone({
  fileNames,
  onFilesChange,
  label,
  hint,
}: Props) {
  const [dragOver, setDragOver] = useState(false);

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      const arr = Array.from(list).filter((f) => f.type.startsWith("image/"));
      const names = [...new Set([...fileNames, ...arr.map((f) => f.name)])];
      onFilesChange(names);
    },
    [fileNames, onFilesChange]
  );

  return (
    <div>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</p>
      <div
        role="button"
        tabIndex={0}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            document.getElementById("doc-fotos-input")?.click();
          }
        }}
        className={`rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragOver
            ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
            : "border-gray-300 bg-gray-50/50 dark:border-gray-600 dark:bg-gray-900/40"
        }`}
      >
        <input
          id="doc-fotos-input"
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Arrastrá imágenes aquí o{" "}
          <button
            type="button"
            className="font-medium text-blue-600 underline dark:text-blue-400"
            onClick={() => document.getElementById("doc-fotos-input")?.click()}
          >
            elegí archivos
          </button>
        </p>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">{hint}</p>
      </div>
      {fileNames.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {fileNames.map((name) => (
            <li
              key={name}
              className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-2 py-1 text-xs text-gray-800 dark:bg-gray-700 dark:text-gray-200"
            >
              <span className="max-w-[180px] truncate">{name}</span>
              <button
                type="button"
                className="text-gray-600 hover:text-red-600 dark:text-gray-400"
                aria-label={`Quitar ${name}`}
                onClick={() => onFilesChange(fileNames.filter((n) => n !== name))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
