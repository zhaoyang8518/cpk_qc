import { invoke } from "@tauri-apps/api/core";
import {
  Activity,
  Building2,
  Database,
  Layers,
  Palette,
  Plus,
  Settings,
  Sliders,
  Trash2,
  X,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { Locale, t, useLocale } from "../i18n";
import { Supplier } from "../types";
import { DEFAULT_RF_MAPPINGS, RfMappingConfig } from "../utils/rfParser";
import { useTheme, Theme } from "../theme";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  chartTheme: string;
  onChangeTheme: (theme: string) => void;
  lineWidth: number;
  onChangeLineWidth: (width: number) => void;
  rfMappings: RfMappingConfig;
  onChangeRfMappings: (mappings: RfMappingConfig) => void;
  onResetRfMappings: () => void;
  postgresUri: string;
  onChangePostgresUri: (uri: string) => void;
  suppliers: Supplier[];
  onChangeSuppliers: (suppliers: Supplier[]) => void;
}

const THEMES = [
  { name: "经典深蓝", value: "#5470c6", bg: "bg-blue-600" },
  { name: "翡翠常绿", value: "#10b981", bg: "bg-emerald-500" },
  { name: "暗夜罗兰", value: "#8b5cf6", bg: "bg-purple-500" },
  { name: "落日霞光", value: "#f97316", bg: "bg-orange-500" },
  { name: "赛博青芒", value: "#06b6d4", bg: "bg-cyan-500" },
];

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  chartTheme,
  onChangeTheme,
  lineWidth,
  onChangeLineWidth,
  rfMappings,
  onChangeRfMappings,
  onResetRfMappings,
  postgresUri,
  onChangePostgresUri,
  suppliers,
  onChangeSuppliers,
}) => {
  const { locale, setLocale } = useLocale();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<
    "general" | "rfMapping" | "database" | "suppliers"
  >("general");
  const [dbStatus, setDbStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [dbError, setDbError] = useState("");

  const [dbHost, setDbHost] = useState("localhost");
  const [dbPort, setDbPort] = useState("5432");
  const [dbUser, setDbUser] = useState("postgres");
  const [dbPassword, setDbPassword] = useState("");
  const [dbName, setDbName] = useState("cpk_db");
  const [supplierDrafts, setSupplierDrafts] = useState<Supplier[]>([]);

  const parsePgUri = (uri: string) => {
    const defaults = {
      host: "localhost",
      port: "5432",
      user: "postgres",
      password: "",
      database: "cpk_db",
    };
    if (!uri) return defaults;
    try {
      const match = uri.match(
        /^postgres(?:ql)?:\/\/([^:]+)(?::([^@]+))?@([^:/]+)(?::(\d+))?\/([^?]+)/,
      );
      if (match) {
        return {
          user: decodeURIComponent(match[1] || defaults.user),
          password: decodeURIComponent(match[2] || defaults.password),
          host: match[3] || defaults.host,
          port: match[4] || defaults.port,
          database: match[5] || defaults.database,
        };
      }
    } catch (e) {
      console.error("Failed to parse PG URI", e);
    }
    return defaults;
  };

  const getAssembledUri = () => {
    const pwd = dbPassword ? encodeURIComponent(dbPassword) : "";
    return `postgres://${encodeURIComponent(dbUser)}:${pwd}@${dbHost}:${dbPort}/${dbName}`;
  };

  const getMaskedUri = () => {
    return `postgres://${dbUser}:******@${dbHost}:${dbPort}/${dbName}`;
  };

  // Local state for aliases
  const [bleAliases, setBleAliases] = useState("");
  const [pwrAliases, setPwrAliases] = useState("");
  const [evmAliases, setEvmAliases] = useState("");
  const [frqAliases, setFrqAliases] = useState("");
  const [mskAliases, setMskAliases] = useState("");
  const [perAliases, setPerAliases] = useState("");
  const [rsiAliases, setRsiAliases] = useState("");

  // Sync state when modal is opened or mappings change
  useEffect(() => {
    if (isOpen) {
      if (postgresUri) {
        const parsed = parsePgUri(postgresUri);
        setDbHost(parsed.host);
        setDbPort(parsed.port);
        setDbUser(parsed.user);
        setDbPassword(parsed.password);
        setDbName(parsed.database);
      }
      setDbStatus("idle");
      setDbError("");
      setSupplierDrafts(suppliers.length > 0 ? suppliers : [{ supplier_key: "", supplier_name: "" }]);

      if (rfMappings) {
        setBleAliases(rfMappings.protocols.BLE.join(", "));
        setPwrAliases(rfMappings.parameters.PWR.join(", "));
        setEvmAliases(rfMappings.parameters.EVM.join(", "));
        setFrqAliases(rfMappings.parameters.FRQ.join(", "));
        setMskAliases(rfMappings.parameters.MSK.join(", "));
        setPerAliases(rfMappings.parameters.PER.join(", "));
        setRsiAliases(rfMappings.parameters.RSI.join(", "));
      }
    }
  }, [isOpen, rfMappings, postgresUri, suppliers]);

  if (!isOpen) return null;

  const parseAliases = (val: string) => {
    return val
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  };

  const handleSave = () => {
    const newMappings: RfMappingConfig = {
      protocols: {
        BLE: parseAliases(bleAliases),
      },
      parameters: {
        PWR: parseAliases(pwrAliases),
        EVM: parseAliases(evmAliases),
        FRQ: parseAliases(frqAliases),
        MSK: parseAliases(mskAliases),
        PER: parseAliases(perAliases),
        RSI: parseAliases(rsiAliases),
      },
    };
    onChangeRfMappings(newMappings);
    onChangePostgresUri(getAssembledUri());
    const normalizedSuppliers = supplierDrafts
      .map((supplier) => ({
        supplier_key: supplier.supplier_key.trim(),
        supplier_name: supplier.supplier_name.trim(),
      }))
      .filter((supplier) => supplier.supplier_key && supplier.supplier_name);
    const dedupedSuppliers = Array.from(
      new Map(normalizedSuppliers.map((supplier) => [supplier.supplier_key, supplier])).values(),
    );
    onChangeSuppliers(dedupedSuppliers);
    onClose();
  };

  const updateSupplierDraft = (index: number, field: keyof Supplier, value: string) => {
    setSupplierDrafts((current) =>
      current.map((supplier, idx) => (idx === index ? { ...supplier, [field]: value } : supplier)),
    );
  };

  const addSupplierDraft = () => {
    setSupplierDrafts((current) => [...current, { supplier_key: "", supplier_name: "" }]);
  };

  const removeSupplierDraft = (index: number) => {
    setSupplierDrafts((current) => current.filter((_, idx) => idx !== index));
  };

  const handleReset = () => {
    onResetRfMappings();
    setBleAliases(DEFAULT_RF_MAPPINGS.protocols.BLE.join(", "));
    setPwrAliases(DEFAULT_RF_MAPPINGS.parameters.PWR.join(", "));
    setEvmAliases(DEFAULT_RF_MAPPINGS.parameters.EVM.join(", "));
    setFrqAliases(DEFAULT_RF_MAPPINGS.parameters.FRQ.join(", "));
    setMskAliases(DEFAULT_RF_MAPPINGS.parameters.MSK.join(", "));
    setPerAliases(DEFAULT_RF_MAPPINGS.parameters.PER.join(", "));
    setRsiAliases(DEFAULT_RF_MAPPINGS.parameters.RSI.join(", "));
  };

  const handleTestConnection = async () => {
    const uri = getAssembledUri();
    setDbStatus("testing");
    setDbError("");
    try {
      await invoke("test_db_connection", { postgresUri: uri });
      setDbStatus("success");
    } catch (e: any) {
      setDbStatus("error");
      setDbError(String(e));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm select-none animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 w-[560px] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-scaleUp">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800/60 border-b border-slate-700/60">
          <div className="flex items-center space-x-2 text-slate-100">
            <Settings className="w-5 h-5 text-blue-400" />
            <h2 className="font-bold text-base tracking-wide">
              {t("modalTitle", locale)}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-700/60 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/20 px-6">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 ${
              activeTab === "general"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{t("tabGeneral", locale)}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("rfMapping")}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 ${
              activeTab === "rfMapping"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t("tabRfMapping", locale)}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("database")}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 ${
              activeTab === "database"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>PostgreSQL</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("suppliers")}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-1.5 ${
              activeTab === "suppliers"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>{t("tabSuppliers", locale)}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
          {activeTab === "general" ? (
            <>
              {/* Section 0: Language */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-sm font-bold text-slate-300">
                  <span className="text-blue-400 font-bold">🌐</span>
                  <span>{t("language", locale)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  {[
                    { label: t("english", locale), value: "en" as Locale },
                    { label: t("chinese", locale), value: "zh" as Locale },
                  ].map((lang) => (
                    <button
                      key={lang.value}
                      onClick={() => setLocale(lang.value)}
                      className={`flex items-center justify-center space-x-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                        locale === lang.value
                          ? "border-blue-500 bg-blue-600/20 text-blue-300 shadow-lg shadow-blue-500/10 scale-105"
                          : "border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                      }`}
                    >
                      <span>{lang.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Section 0.5: Interface Theme */}
              <div className="space-y-3 border-t border-slate-800 pt-5">
                <div className="flex items-center space-x-2 text-sm font-bold text-slate-300">
                  <span className="text-blue-400 font-bold">🌓</span>
                  <span>{t("theme", locale)}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-1">
                  {[
                    { label: t("theme_light", locale), value: "light" as Theme },
                    { label: t("theme_dark", locale), value: "dark" as Theme },
                    { label: t("theme_system", locale), value: "system" as Theme },
                  ].map((tOpt) => (
                    <button
                      key={tOpt.value}
                      onClick={() => setTheme(tOpt.value)}
                      className={`flex items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all ${
                        theme === tOpt.value
                          ? "border-blue-500 bg-blue-600/20 text-blue-300 shadow-lg shadow-blue-500/10 scale-105"
                          : "border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                      }`}
                    >
                      <span>{tOpt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Section 1: Chart Theme */}
              <div className="space-y-3 border-t border-slate-800 pt-5">
                <div className="flex items-center space-x-2 text-sm font-bold text-slate-300">
                  <Palette className="w-4 h-4 text-emerald-400" />
                  <span>{t("chartTheme", locale)}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-1">
                  {THEMES.map((themeItem) => (
                    <button
                      key={themeItem.value}
                      onClick={() => onChangeTheme(themeItem.value)}
                      className={`flex items-center space-x-2 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                        chartTheme === themeItem.value
                          ? "border-blue-500 bg-blue-600/20 text-white shadow-lg shadow-blue-500/10 scale-105"
                          : "border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                      }`}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded-full ${themeItem.bg} flex-shrink-0 shadow`}
                      />
                      <span className="truncate">{themeItem.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Section 2: Normal Curve Line Width */}
              <div className="space-y-3 border-t border-slate-800 pt-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-sm font-bold text-slate-300">
                    <Activity className="w-4 h-4 text-rose-400" />
                    <span>{t("lineWidthTitle", locale)}</span>
                  </div>
                  <span className="text-xs font-mono bg-slate-800 px-2 py-0.5 rounded text-blue-400 font-bold border border-slate-700">
                    {lineWidth} px
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={0.5}
                  value={lineWidth}
                  onChange={(e) =>
                    onChangeLineWidth(parseFloat(e.target.value))
                  }
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono px-1">
                  <span>{t("thin", locale)}</span>
                  <span>{t("medium", locale)}</span>
                  <span>{t("thick", locale)}</span>
                </div>
              </div>

              {/* Section 3: SPC Algorithm Info */}
              <div className="space-y-2 border-t border-slate-800 pt-5 text-xs text-slate-400 leading-relaxed">
                <div className="font-bold text-slate-300 mb-1">
                  {t("spcEngineTitle", locale)}
                </div>
                <p>
                  {t("spcEngineDesc1", locale)}
                  <code className="bg-slate-800 px-1.5 py-0.5 rounded ml-1 font-mono text-slate-300">
                    K = ⌈1 + 3.322 log₁₀ N⌉
                  </code>
                </p>
                <p>{t("spcEngineDesc2", locale)}</p>
              </div>
            </>
          ) : activeTab === "rfMapping" ? (
            <div className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed bg-slate-950/30 p-3 rounded-lg border border-slate-800">
                {t("rfMappingDesc", locale)}
              </p>

              <div className="space-y-4.5">
                {/* BLE Protocol */}
                <div className="flex flex-col space-y-1.5">
                  <label className="text-xs font-bold text-blue-400 font-mono flex items-center justify-between">
                    <span>Protocol: BLE</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      Standard Key: BLE
                    </span>
                  </label>
                  <input
                    type="text"
                    value={bleAliases}
                    onChange={(e) => setBleAliases(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs focus:outline-none focus:border-blue-500 transition-colors font-mono text-slate-300"
                    placeholder="BLE, TBLE, BLUE..."
                  />
                </div>

                {/* PWR Parameter */}
                <div className="flex flex-col space-y-1.5 border-t border-slate-800/80 pt-3">
                  <label className="text-xs font-bold text-cyan-400 font-mono flex items-center justify-between">
                    <span>Parameter: PWR (Power)</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      Standard Key: PWR
                    </span>
                  </label>
                  <input
                    type="text"
                    value={pwrAliases}
                    onChange={(e) => setPwrAliases(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs focus:outline-none focus:border-blue-500 transition-colors font-mono text-slate-300"
                    placeholder="PWR, POWER, TXPWR..."
                  />
                </div>

                {/* EVM Parameter */}
                <div className="flex flex-col space-y-1.5 border-t border-slate-800/80 pt-3">
                  <label className="text-xs font-bold text-emerald-400 font-mono flex items-center justify-between">
                    <span>Parameter: EVM (Modulation Accuracy)</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      Standard Key: EVM
                    </span>
                  </label>
                  <input
                    type="text"
                    value={evmAliases}
                    onChange={(e) => setEvmAliases(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs focus:outline-none focus:border-blue-500 transition-colors font-mono text-slate-300"
                    placeholder="EVM, TEVM, MOD..."
                  />
                </div>

                {/* FRQ Parameter */}
                <div className="flex flex-col space-y-1.5 border-t border-slate-800/80 pt-3">
                  <label className="text-xs font-bold text-purple-400 font-mono flex items-center justify-between">
                    <span>Parameter: FRQ (Frequency Error)</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      Standard Key: FRQ
                    </span>
                  </label>
                  <input
                    type="text"
                    value={frqAliases}
                    onChange={(e) => setFrqAliases(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs focus:outline-none focus:border-blue-500 transition-colors font-mono text-slate-300"
                    placeholder="FRQ, FREQ, ERROR, OFFSET..."
                  />
                </div>

                {/* MSK Parameter */}
                <div className="flex flex-col space-y-1.5 border-t border-slate-800/80 pt-3">
                  <label className="text-xs font-bold text-amber-400 font-mono flex items-center justify-between">
                    <span>Parameter: MSK (Spectrum Mask)</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      Standard Key: MSK
                    </span>
                  </label>
                  <input
                    type="text"
                    value={mskAliases}
                    onChange={(e) => setMskAliases(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs focus:outline-none focus:border-blue-500 transition-colors font-mono text-slate-300"
                    placeholder="MSK, MASK, SPEC_MASK..."
                  />
                </div>

                {/* PER Parameter */}
                <div className="flex flex-col space-y-1.5 border-t border-slate-800/80 pt-3">
                  <label className="text-xs font-bold text-rose-400 font-mono flex items-center justify-between">
                    <span>Parameter: PER (Packet Error Rate)</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      Standard Key: PER
                    </span>
                  </label>
                  <input
                    type="text"
                    value={perAliases}
                    onChange={(e) => setPerAliases(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs focus:outline-none focus:border-blue-500 transition-colors font-mono text-slate-300"
                    placeholder="PER, BER, LOSS..."
                  />
                </div>

                {/* RSI Parameter */}
                <div className="flex flex-col space-y-1.5 border-t border-slate-800/80 pt-3">
                  <label className="text-xs font-bold text-teal-400 font-mono flex items-center justify-between">
                    <span>Parameter: RSI (RSSI / RX Sensitivity)</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      Standard Key: RSI
                    </span>
                  </label>
                  <input
                    type="text"
                    value={rsiAliases}
                    onChange={(e) => setRsiAliases(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs focus:outline-none focus:border-blue-500 transition-colors font-mono text-slate-300"
                    placeholder="RSI, RSSI, SENS..."
                  />
                </div>

                <div className="pt-4 border-t border-slate-850">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-750 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-medium transition-all shadow-inner active:scale-98"
                  >
                    {t("resetDefaults", locale)}
                  </button>
                </div>
              </div>
            </div>
          ) : activeTab === "database" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-6 gap-4 pt-2">
                <div className="col-span-4 flex flex-col space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    {t("dbHost", locale)}
                  </label>
                  <input
                    type="text"
                    value={dbHost}
                    onChange={(e) => setDbHost(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs focus:outline-none focus:border-blue-500 transition-colors font-mono text-slate-300"
                    placeholder="localhost"
                  />
                </div>
                <div className="col-span-2 flex flex-col space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    {t("dbPort", locale)}
                  </label>
                  <input
                    type="text"
                    value={dbPort}
                    onChange={(e) => setDbPort(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs focus:outline-none focus:border-blue-500 transition-colors font-mono text-slate-300"
                    placeholder="5432"
                  />
                </div>

                <div className="col-span-3 flex flex-col space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    {t("dbUser", locale)}
                  </label>
                  <input
                    type="text"
                    value={dbUser}
                    onChange={(e) => setDbUser(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs focus:outline-none focus:border-blue-500 transition-colors font-mono text-slate-300"
                    placeholder="postgres"
                  />
                </div>
                <div className="col-span-3 flex flex-col space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    {t("dbPassword", locale)}
                  </label>
                  <input
                    type="password"
                    value={dbPassword}
                    onChange={(e) => setDbPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs focus:outline-none focus:border-blue-500 transition-colors font-mono text-slate-300"
                    placeholder={t("dbPasswordPlaceholder", locale)}
                  />
                </div>

                <div className="col-span-6 flex flex-col space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    {t("dbName", locale)}
                  </label>
                  <input
                    type="text"
                    value={dbName}
                    onChange={(e) => setDbName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs focus:outline-none focus:border-blue-500 transition-colors font-mono text-slate-300"
                    placeholder="cpk_db"
                  />
                </div>
              </div>

              <div className="pt-2 flex flex-col space-y-2">
                <label className="text-[10px] font-bold text-slate-500 font-mono">
                  {t("dbUriPreview", locale)}
                </label>
                <div className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-[10px] font-mono text-slate-400 select-all overflow-x-auto whitespace-nowrap">
                  {getMaskedUri()}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={dbStatus === "testing"}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-750 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-medium transition-all shadow-inner flex items-center space-x-2"
                >
                  <Activity
                    className={`w-3.5 h-3.5 ${dbStatus === "testing" ? "animate-spin" : ""}`}
                  />
                  <span>
                    {dbStatus === "testing" ? t("dbTesting", locale) : t("dbTestConnection", locale)}
                  </span>
                </button>
              </div>

              {dbStatus === "success" && (
                <div className="text-xs text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/50 mt-4 font-mono">
                  {t("dbTestSuccess", locale)}
                </div>
              )}
              {dbStatus === "error" && (
                <div className="text-xs text-rose-800 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-3 rounded-lg border border-rose-200 dark:border-rose-900/50 mt-4 font-mono break-all">
                  {t("dbTestError", locale)}{dbError}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed bg-slate-950/30 p-3 rounded-lg border border-slate-800">
                {t("supplierDesc", locale)}
              </p>

              <div className="space-y-3">
                {supplierDrafts.map((supplier, index) => (
                  <div key={index} className="grid grid-cols-12 gap-3 items-end">
                    <div className="col-span-5 flex flex-col space-y-1.5">
                      <label className="text-xs font-bold text-slate-300">
                        {t("supplierKey", locale)}
                      </label>
                      <input
                        type="text"
                        value={supplier.supplier_key}
                        onChange={(e) => updateSupplierDraft(index, "supplier_key", e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs focus:outline-none focus:border-blue-500 transition-colors font-mono text-slate-300"
                        placeholder="vendor_a"
                      />
                    </div>
                    <div className="col-span-6 flex flex-col space-y-1.5">
                      <label className="text-xs font-bold text-slate-300">
                        {t("supplierName", locale)}
                      </label>
                      <input
                        type="text"
                        value={supplier.supplier_name}
                        onChange={(e) => updateSupplierDraft(index, "supplier_name", e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs focus:outline-none focus:border-blue-500 transition-colors text-slate-300"
                        placeholder={t("supplierNamePlaceholder", locale)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSupplierDraft(index)}
                      className="col-span-1 h-9 flex items-center justify-center rounded-xl border border-slate-700 text-slate-400 hover:text-rose-300 hover:border-rose-500/60 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addSupplierDraft}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-750 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-medium transition-all shadow-inner flex items-center justify-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>{t("supplierAdd", locale)}</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end px-6 py-4 bg-slate-800/40 border-t border-slate-800 space-x-3">
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 border border-blue-500/50"
          >
            {t("completeSettings", locale)}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
