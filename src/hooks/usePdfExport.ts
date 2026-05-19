import { useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as echarts from "echarts";
import { ExportProgressState } from "../components/ExportProgressModal";
import { Locale, t } from "../i18n";
import { CpkStatus, SheetData } from "../types";
import { getCpkStatus } from "../utils/cpk";
import { parseRFIndicator, RfMappingConfig } from "../utils/rfParser";

interface UsePdfExportOptions {
  sheets: SheetData[];
  activeSheetIdx: number;
  displayFileName: string;
  rfMappings: RfMappingConfig;
  locale: Locale;
}

const emptyProgress: ExportProgressState = { visible: false, percent: 0, text: "" };

export const usePdfExport = ({
  sheets,
  activeSheetIdx,
  displayFileName,
  rfMappings,
  locale,
}: UsePdfExportOptions) => {
  const [exportProgress, setExportProgress] = useState<ExportProgressState>(emptyProgress);

  const handleExport = async () => {
    if (!sheets || sheets.length === 0) {
      alert(t("noDataExport", locale));
      return;
    }

    const sheet = sheets[activeSheetIdx];
    if (!sheet || !sheet.indicators || sheet.indicators.length === 0) {
      alert(t("noIndicatorExport", locale));
      return;
    }

    const cpkStatusCounts: Record<CpkStatus, number> = { red: 0, yellow: 0, green: 0, cyan: 0 };
    sheet.indicators.forEach((indicator) => {
      cpkStatusCounts[getCpkStatus(indicator.cpk)] += 1;
    });

    try {
      setExportProgress({ visible: true, percent: 5, text: t("exportInit", locale) });
      await new Promise((resolve) => setTimeout(resolve, 10));

      const pdf = new jsPDF("p", "mm", "a4");
      const margin = 14;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const contentW = pageWidth - margin * 2;

      setExportProgress({ visible: true, percent: 10, text: t("exportFont", locale) });
      try {
        const fontRes = await fetch("/fonts/SimHei_subset.ttf");
        const fontBlob = await fontRes.blob();
        const fontBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(",")[1];
            resolve(base64);
          };
          reader.readAsDataURL(fontBlob);
        });

        pdf.addFileToVFS("SimHei.ttf", fontBase64);
        pdf.addFont("SimHei.ttf", "SimHei", "normal");
        pdf.setFont("SimHei");
      } catch (fontErr) {
        console.warn("Failed to load SimHei font, falling back to default jsPDF font", fontErr);
      }

      let y = margin + 12;
      pdf.setFontSize(24);
      pdf.setTextColor(15, 23, 42);
      pdf.text(t("reportMainTitle", locale), margin, y);

      y += 6;
      pdf.setFontSize(10);
      pdf.setTextColor(100, 115, 130);
      pdf.text(t("reportSubtitle", locale), margin, y);

      y += 12;
      pdf.setFontSize(14);
      pdf.setTextColor(30, 41, 59);
      pdf.text(t("reportInfoTitle", locale), margin, y);
      y += 6;

      const now = new Date();
      const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      const infoRows = [
        [t("infoFileName", locale), displayFileName || t("noFile", locale)],
        [t("infoSheetName", locale), sheet.sheet_name],
        [t("infoTime", locale), ts],
        [t("infoIndCount", locale), String(sheet.indicators.length)],
        [t("infoSampleCount", locale), String(sheet.pcbasn_list.length)],
      ];

      pdf.setFontSize(10);
      for (const [label, value] of infoRows) {
        pdf.setTextColor(100, 110, 130);
        pdf.text(label, margin, y);
        pdf.setTextColor(30, 41, 59);
        pdf.text(value, margin + 40, y);
        y += 6.5;
      }

      y += 6;
      pdf.setFontSize(14);
      pdf.setTextColor(30, 41, 59);
      pdf.text(t("execSummaryTitle", locale), margin, y);
      y += 6;
      pdf.setFontSize(9);
      pdf.setTextColor(71, 85, 105);
      const splitSummary = pdf.splitTextToSize(t("execSummaryText", locale), contentW);
      pdf.text(splitSummary, margin, y);
      y += splitSummary.length * 5 + 8;

      setExportProgress({ visible: true, percent: 15, text: t("exportCapSummaryTable", locale) });
      pdf.setFontSize(14);
      pdf.text(t("capSummaryTitle", locale), margin, y);
      y += 4;

      const totalInds = sheet.indicators.length;
      const statusSummaryData = [
        [t("worldClass", locale), "CPK ≥ 2.00 (≥ 6 Sigma)", String(cpkStatusCounts.cyan), `${((cpkStatusCounts.cyan / totalInds) * 100 || 0).toFixed(1)}%`, t("capWorldClassDesc", locale)],
        [t("good", locale), "1.33 ≤ CPK < 2.00 (4~6 Sigma)", String(cpkStatusCounts.green), `${((cpkStatusCounts.green / totalInds) * 100 || 0).toFixed(1)}%`, t("capGoodDesc", locale)],
        [t("passable", locale), "1.00 ≤ CPK < 1.33 (3~4 Sigma)", String(cpkStatusCounts.yellow), `${((cpkStatusCounts.yellow / totalInds) * 100 || 0).toFixed(1)}%`, t("capPassableDesc", locale)],
        [t("fail", locale), "CPK < 1.00 (< 3 Sigma)", String(cpkStatusCounts.red), `${((cpkStatusCounts.red / totalInds) * 100 || 0).toFixed(1)}%`, t("capFailDesc", locale)],
      ];

      autoTable(pdf, {
        startY: y,
        head: [[t("capLevelName", locale), t("capCriteria", locale), t("capIndCount", locale), t("capRatio", locale), t("capDesc", locale)]],
        body: statusSummaryData,
        theme: "grid",
        styles: { font: "SimHei" },
        headStyles: { fillColor: [15, 23, 42] },
      });

      y = (pdf as any).lastAutoTable.finalY + 12;
      setExportProgress({ visible: true, percent: 25, text: t("exportIndIndexTable", locale) });
      pdf.setFontSize(14);
      pdf.text(t("indIndexTitle", locale), margin, y);
      y += 4;

      const sorted = [...sheet.indicators].sort((a, b) => (b.cpk ?? -Infinity) - (a.cpk ?? -Infinity));
      const indTableData = sorted.map((indicator, idx) => {
        const parsed = parseRFIndicator(indicator.name, rfMappings);
        return [
          String(idx + 1),
          parsed.displayName,
          indicator.average?.toFixed(2) ?? "-",
          indicator.stdev?.toFixed(4) ?? "-",
          indicator.cpk?.toFixed(2) ?? "-",
        ];
      });

      autoTable(pdf, {
        startY: y,
        head: [["#", t("indName", locale), t("indMean", locale), t("indStdev", locale), t("indCpk", locale)]],
        body: indTableData,
        theme: "striped",
        styles: { font: "SimHei" },
      });

      const targetIndicators = sheet.indicators
        .map((indicator, index) => ({ indicator, index }))
        .filter(({ indicator }) => {
          const status = getCpkStatus(indicator.cpk);
          return status === "red" || status === "yellow";
        });

      if (targetIndicators.length > 0) {
        for (let i = 0; i < targetIndicators.length; i++) {
          const { indicator, index } = targetIndicators[i];
          const parsed = parseRFIndicator(indicator.name, rfMappings);
          setExportProgress({
            visible: true,
            percent: 30 + (i / targetIndicators.length) * 60,
            text: `${t("exportExtractChart", locale)}: ${parsed.displayName.slice(0, 15)}`,
          });

          const cardEl = document.getElementById(`indicator-card-${index}`);
          if (!cardEl) continue;
          const chartDom = cardEl.querySelector(".echarts-for-react") || cardEl.querySelector("div[_echarts_instance_]") || cardEl;
          const chartInstance = echarts.getInstanceByDom(chartDom as HTMLElement);
          let imgData: string | null;
          let imgW = 160;
          let imgH = 100;

          if (chartInstance) {
            imgData = chartInstance.getDataURL({
              type: "png",
              pixelRatio: 2,
              backgroundColor: "#0f172a",
            });
          } else {
            const canvas = await html2canvas(cardEl as HTMLElement, {
              scale: 2,
              backgroundColor: "#0f172a",
              logging: false,
            });
            imgData = canvas.toDataURL("image/png");
            imgW = 160;
            imgH = (canvas.height / canvas.width) * imgW;
          }

          if (y + imgH + 15 > pdf.internal.pageSize.getHeight() - margin) {
            pdf.addPage();
            y = margin;
          } else {
            y += 10;
          }

          pdf.setFontSize(12);
          pdf.setTextColor(30, 41, 59);
          pdf.text(`[${t("abnormalAnalysisTitle", locale)}] #${index + 1} - ${parsed.displayName}`, margin, y);
          y += 5;

          pdf.addImage(imgData, "PNG", margin, y, imgW, imgH);
          y += imgH + 5;
        }
      }

      setExportProgress({ visible: true, percent: 92, text: t("exportSaveLoc", locale) });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const defaultFileName = `CPK_Report_${sheet.sheet_name}_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}.pdf`;
      const savePath = await save({
        defaultPath: defaultFileName,
        filters: [{ name: "PDF Report", extensions: ["pdf"] }],
      });

      if (!savePath) {
        setExportProgress(emptyProgress);
        return;
      }

      setExportProgress({ visible: true, percent: 95, text: t("exportWriteDisk", locale) });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const pdfBuffer = pdf.output("arraybuffer");
      await writeFile(savePath, new Uint8Array(pdfBuffer));

      setExportProgress({ visible: true, percent: 100, text: t("exportSuccess", locale) });
      await new Promise((resolve) => setTimeout(resolve, 500));

      alert(t("exportSuccess", locale));
    } catch (err: unknown) {
      alert(`${t("exportFailed", locale)}${err}`);
    } finally {
      setExportProgress(emptyProgress);
    }
  };

  return {
    exportProgress,
    handleExport,
  };
};
