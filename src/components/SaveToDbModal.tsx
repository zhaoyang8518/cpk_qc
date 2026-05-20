import React, { useState, useEffect } from "react";
import { Database, Calendar, X, Save } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { t, useLocale } from "../i18n";
import { Supplier } from "../types";

interface SaveToDbModalProps {
  isOpen: boolean;
  onClose: () => void;
  filePath: string;
  fileName: string;
  postgresUri: string;
  suppliers: Supplier[];
  onSave: (dateStr: string, supplier: Supplier, forceOverwrite: boolean) => Promise<void>;
}

const SaveToDbModal: React.FC<SaveToDbModalProps> = ({
  isOpen,
  onClose,
  filePath,
  fileName,
  postgresUri,
  suppliers,
  onSave,
}) => {
  const { locale } = useLocale();
  const [testDate, setTestDate] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [selectedSupplierKey, setSelectedSupplierKey] = useState("");

  useEffect(() => {
    if (isOpen && filePath) {
      setError("");
      setShowOverwriteConfirm(false);
      setSelectedSupplierKey((current) => current || suppliers[0]?.supplier_key || "");
      setLoading(true);
      // Fetch metadata from backend
      invoke<string>("get_excel_metadata", { path: filePath })
        .then((date) => {
          // If metadata returns rfc3339 string, we slice it to local YYYY-MM-DDTHH:MM format for datetime-local input
          // e.g. "2026-05-20T14:15:30Z" -> "2026-05-20T14:15"
          if (date.includes("T")) {
            setTestDate(date.substring(0, 16));
          } else {
            setTestDate(date + "T08:00"); // default morning time
          }
        })
        .catch((e) => {
          console.error("Failed to get file metadata", e);
          const today = new Date();
          const yyyy = today.getFullYear();
          const mm = String(today.getMonth() + 1).padStart(2, '0');
          const dd = String(today.getDate()).padStart(2, '0');
          setTestDate(`${yyyy}-${mm}-${dd}T08:00`);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, filePath, suppliers]);

  if (!isOpen) return null;

  const handleSave = async (force: boolean = false) => {
    if (!testDate) {
      setError(t("dbRequireDate", locale));
      return;
    }
    const supplier = suppliers.find((item) => item.supplier_key === selectedSupplierKey);
    if (!supplier) {
      setError(t("dbRequireSupplier", locale));
      return;
    }

    setLoading(true);
    setError("");
    try {
      await onSave(testDate, supplier, force);
      setShowOverwriteConfirm(false);
      onClose();
    } catch (e: any) {
      if (String(e) === "SUPPLIER_DAY_ALREADY_IMPORTED") {
        setShowOverwriteConfirm(true);
      } else {
        setError(String(e));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm select-none animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 w-[420px] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-scaleUp">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800/60 border-b border-slate-700/60">
          <div className="flex items-center space-x-2 text-slate-100">
            <Database className="w-5 h-5 text-blue-400" />
            <h2 className="font-bold text-base tracking-wide">{t("dbSaveToDbTitle", locale)}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-700/60 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            {t("dbSaveDesc1", locale)}<strong>{fileName}</strong>{t("dbSaveDesc2", locale)}
          </p>
          
          {!postgresUri && (
             <div className="text-xs text-amber-400 bg-amber-950/30 p-3 rounded-lg border border-amber-900/50 mt-4 font-mono">
               {t("dbConfigMissing", locale)}
             </div>
          )}

          {suppliers.length === 0 && (
             <div className="text-xs text-amber-400 bg-amber-950/30 p-3 rounded-lg border border-amber-900/50 mt-4">
               {t("dbSupplierMissing", locale)}
             </div>
          )}

          <div className="space-y-2 pt-2">
            <label className="text-xs font-bold text-slate-300">
              {t("dbSupplier", locale)}
            </label>
            <select
              value={selectedSupplierKey}
              onChange={(e) => setSelectedSupplierKey(e.target.value)}
              disabled={loading || suppliers.length === 0}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-colors text-slate-300 disabled:opacity-50"
            >
              <option value="">{t("dbSelectSupplier", locale)}</option>
              {suppliers.map((supplier) => (
                <option key={supplier.supplier_key} value={supplier.supplier_key}>
                  {supplier.supplier_name} ({supplier.supplier_key})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 pt-2">
            <label className="text-xs font-bold text-slate-300 flex items-center space-x-1">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span>{t("dbConfirmDate", locale)}</span>
            </label>
            <input
              type="datetime-local"
              value={testDate}
              onChange={(e) => setTestDate(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-colors text-slate-300 disabled:opacity-50"
            />
            <p className="text-[10px] text-slate-500">
              {t("dbDateDefaultHint", locale)}
            </p>
          </div>

          {showOverwriteConfirm && (
            <div className="text-xs text-amber-400 bg-amber-955/35 p-3 rounded-lg border border-amber-900/50 mt-4">
              {t("dbOverwriteConfirm", locale)}
            </div>
          )}

          {error && (
            <div className="text-xs text-rose-400 bg-rose-950/30 p-3 rounded-lg border border-rose-900/50 font-mono break-all mt-2">
              ❌ {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end px-6 py-4 bg-slate-800/40 border-t border-slate-800 space-x-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 hover:bg-slate-700 active:bg-slate-800 text-slate-300 text-xs font-medium rounded-xl transition-all disabled:opacity-50"
          >
            {t("dbCancel", locale)}
          </button>
          {showOverwriteConfirm ? (
            <button
              onClick={() => handleSave(true)}
              disabled={loading}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-amber-600/20 transition-all active:scale-95 border border-amber-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? t("dbOverwriting", locale) : t("dbConfirmOverwriteBtn", locale)}</span>
            </button>
          ) : (
            <button
              onClick={() => handleSave(false)}
              disabled={loading || !postgresUri || suppliers.length === 0}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 border border-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? t("dbSaving", locale) : t("dbConfirmSaveBtn", locale)}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SaveToDbModal;
