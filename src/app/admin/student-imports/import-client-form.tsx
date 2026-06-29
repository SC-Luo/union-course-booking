"use client";

import { useState, useRef, type FormEvent } from "react";
import * as XLSX from "xlsx";

type ImportMode = "studentsOnly" | "withEnrollment";

type CourseOffering = {
  id: string;
  displayTitle?: string;
  displayName?: string;
  title?: string;
  isActive?: boolean;
  year?: string | number;
};

type Props = {
  action: (formData: FormData) => void;
  offerings: CourseOffering[];
};

export function ImportClientForm({ action, offerings }: Props) {
  const [mode, setMode] = useState<ImportMode>("studentsOnly");
  const [rosterText, setRosterText] = useState("");
  const [fileName, setFileName] = useState("");
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setValidationErrors([]);

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return;

    const sheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

    const rows: string[][] = rawRows.map((row) =>
      (Array.isArray(row) ? row : []).map((cell) => {
        if (cell === null || cell === undefined) return "";
        if (cell instanceof Date) return cell.toISOString().slice(0, 10);
        return String(cell);
      }),
    );

    if (rows.length < 2) return;

    const lines = rows.map((row) => row.join("\t"));
    setRosterText(lines.join("\n"));
    setParsedRows(rows);
  }

  function handleClearFile() {
    setFileName("");
    setRosterText("");
    setParsedRows([]);
    setValidationErrors([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setValidationErrors([]);

    const errors: string[] = [];

    if (parsedRows.length < 2) {
      errors.push("請先上傳 Excel 檔案");
    } else {
      const headerRow = parsedRows[0];
      const nameIdx = headerRow.findIndex((h) => /姓名|學員|name/.test(h));
      const idIdx = headerRow.findIndex((h) => /末三碼|證件|idNumberLast3|idLast3/.test(h));
      const phoneIdx = headerRow.findIndex((h) => /手機|電話|phone/.test(h));

      if (nameIdx < 0 || idIdx < 0 || phoneIdx < 0) {
        errors.push("Excel 缺少必要欄位（姓名、證件末三碼、手機），請確認使用下載的範本格式。");
      } else {
        for (let i = 1; i < parsedRows.length; i++) {
          const row = parsedRows[i];
          const emptyCells: string[] = [];
          if (!row[nameIdx]?.trim()) emptyCells.push("姓名");
          if (!row[idIdx]?.trim()) emptyCells.push("證件末三碼");
          if (!row[phoneIdx]?.trim()) emptyCells.push("手機");
          if (emptyCells.length > 0) {
            errors.push(`第 ${i + 1} 列缺少 ${emptyCells.join("、")}`);
          }
        }
      }
    }

    if (mode === "withEnrollment") {
      const sel = document.getElementById("targetOfferingId") as HTMLSelectElement | null;
      if (!sel?.value) errors.push("請選擇指定班級");
    }

    setValidationErrors(errors);
    if (errors.length > 0) return;

    const formData = new FormData();
    formData.set("importMode", mode);
    formData.set("redirectTo", "/admin/student-imports");
    formData.set("rosterText", rosterText);
    if (mode === "withEnrollment") {
      const sel = document.getElementById("targetOfferingId") as HTMLSelectElement | null;
      if (sel?.value) formData.set("targetOfferingId", sel.value);
    }
    action(formData);
  }

  const isClassImport = mode === "withEnrollment";
  const lineCount = parsedRows.length >= 2 ? parsedRows.length - 1 : 0;
  const previewRows = parsedRows.length >= 2
    ? parsedRows.slice(0, Math.min(6, parsedRows.length))
    : [];

  return (
    <>
      {/* Step 1: download template */}
      <section className="mt-6 rounded-[1.75rem] border border-[#ead7c6] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-black text-zinc-700">1. 下載範本</h2>
        <p className="mt-1 text-xs text-zinc-400">
          範本包含學員所有可填欄位，★ 標示為必填（姓名、證件末三碼、手機）。
        </p>
        <a
          href="/admin/student-imports/template"
          download
          className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-[#6b3b25] px-5 py-2.5 text-sm font-bold text-white"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0-3-3m3 3 3-3m2 8H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
          </svg>
          下載 Excel 範本
        </a>
      </section>

      {/* Step 2: import settings */}
      <section className="mt-4 rounded-[1.75rem] border border-[#ead7c6] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-black text-zinc-700">2. 匯入設定</h2>
        <div className="mt-3 flex gap-6">
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
            <input
              type="radio"
              name="importModeRadio"
              value="studentsOnly"
              checked={mode === "studentsOnly"}
              onChange={() => setMode("studentsOnly")}
              className="accent-[#ef6c00]"
            />
            只建立 / 更新學員資料
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
            <input
              type="radio"
              name="importModeRadio"
              value="withEnrollment"
              checked={mode === "withEnrollment"}
              onChange={() => setMode("withEnrollment")}
              className="accent-[#ef6c00]"
            />
            匯入後加入年度班級
          </label>
        </div>

        {mode === "withEnrollment" ? (
          <div className="mt-4 md:w-1/2">
            <label className="grid gap-2 text-sm font-bold text-zinc-700">
              指定班級
              <select
                id="targetOfferingId"
                defaultValue=""
                className="rounded-2xl border border-[#e8d4c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#ef6c00]"
              >
                <option value="">請選擇班級</option>
                {offerings.map((offering) => (
                  <option key={offering.id} value={offering.id}>
                    {offering.displayTitle ?? offering.displayName ?? offering.title ?? offering.id}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </section>

      {/* Step 3: upload Excel */}
      <section className="mt-4 rounded-[1.75rem] border border-[#ead7c6] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-black text-zinc-700">3. 上傳 Excel</h2>
        <p className="mt-1 text-xs text-zinc-400">
          上傳填寫完成的 Excel 檔案（.xlsx / .xls），系統會自動解析資料。
        </p>

        <div className="mt-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="block w-full text-sm text-zinc-500 file:mr-4 file:cursor-pointer file:rounded-2xl file:border-0 file:bg-[#6b3b25] file:px-5 file:py-2.5 file:text-sm file:font-bold file:text-white hover:file:bg-[#8b5b45]"
          />
        </div>

        {fileName ? (
          <div className="mt-3 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm">
            <span className="text-emerald-800">
              已選取：{fileName}（{lineCount} 筆）
            </span>
            <button
              type="button"
              onClick={handleClearFile}
              className="text-xs font-bold text-rose-600 underline"
            >
              清除
            </button>
          </div>
        ) : null}
      </section>

      {/* Step 4: preview & validate */}
      <section className="mt-4 rounded-[1.75rem] border border-[#ead7c6] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-black text-zinc-700">4. 檢查預覽</h2>

        {validationErrors.length > 0 ? (
          <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <p className="mb-1 font-bold">匯入前請修正以下問題：</p>
            {validationErrors.map((err, i) => (
              <p key={i} className="ml-2 leading-6">{err}</p>
            ))}
          </div>
        ) : null}

        {previewRows.length === 0 ? (
          <p className="mt-2 text-xs text-zinc-400">上傳 Excel 檔案後，此區會顯示前幾筆資料供確認。</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#ead7c6] text-zinc-500">
                  {previewRows[0].map((cell, i) => (
                    <th key={i} className="whitespace-nowrap px-2 py-1 font-semibold">
                      {cell || `欄${i + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(1).map((row, ri) => (
                  <tr key={ri} className="border-b border-[#f0e8e0]">
                    {row.map((cell, ci) => (
                      <td key={ci} className="whitespace-nowrap px-2 py-1 text-zinc-700">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {parsedRows.length > 6 ? (
              <p className="mt-2 text-xs text-zinc-400">
                ... 其餘 {parsedRows.length - 6} 列，共 {lineCount} 列資料
              </p>
            ) : null}
          </div>
        )}
      </section>

      {/* submit */}
      <form onSubmit={handleSubmit} className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.75rem] border border-[#ead7c6] bg-white p-5 shadow-sm">
          <div className="text-sm text-zinc-500">
            {lineCount === 0
              ? "請先上傳 Excel 檔案"
              : `共 ${lineCount} 列資料待匯入`}
          </div>
          <button
            disabled={lineCount === 0}
            className="rounded-2xl bg-[#6b3b25] px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {isClassImport ? "匯入並加入班級" : "匯入學員主檔"}
          </button>
        </div>
      </form>
    </>
  );
}
