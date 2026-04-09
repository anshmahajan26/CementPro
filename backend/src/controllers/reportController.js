import path from "path";
import { getActiveDataset } from "../services/datasetService.js";
import { calculateCarbon, calculateProcurement } from "../services/analyticsService.js";
import { predictDemand } from "../services/mlService.js";
import { generateExcelReport, generatePdfReport } from "../services/reportService.js";

const EXPORT_DIR = path.resolve("exports");

const buildRowsByType = async (type, rows) => {
  const forecast = await predictDemand(7);
  if (type === "demand") {
    return forecast.predictions;
  }

  if (type === "procurement") {
    const procurement = calculateProcurement(forecast.predictions, rows);
    return procurement.recommendation;
  }

  if (type === "emission") {
    const procurement = calculateProcurement(forecast.predictions, rows);
    const carbon = calculateCarbon(forecast.predictions, rows, procurement);
    return carbon.daily;
  }

  throw new Error(`Invalid report type: ${type}. Use demand, procurement, or emission.`);
};

export const getReport = async (req, res) => {
  try {
    const type = req.body?.type || req.params?.type;
    const format = (req.body?.format || req.query?.format || "excel").toLowerCase();
    
    console.log(`[API] Report Report - Start | Type: ${type}, Format: ${format}`);
    
    // Validate request inputs
    if (!type || !["demand", "procurement", "emission"].includes(type)) {
      console.warn(`[API] Invalid report type requested: ${type}`);
      return res.status(400).json({ success: false, message: "Invalid report type requested" });
    }

    const rows = await getActiveDataset();
    if (!rows || !rows.length) {
      console.warn("[API] Report API - No dataset available");
      return res.status(400).json({ success: false, message: "No dataset available. Upload CSV first." });
    }

    const reportRows = await buildRowsByType(type, rows);

    if (format === "pdf") {
      const report = await generatePdfReport(type, reportRows, EXPORT_DIR);
      console.log(`[API] PDF Report generated at ${report.filePath}`);
      return res.download(report.filePath, report.fileName);
    }

    const report = await generateExcelReport(type, reportRows, EXPORT_DIR);
    console.log(`[API] Excel Report generated at ${report.filePath}`);
    return res.download(report.filePath, report.fileName);
  } catch (error) {
    console.error(`[API Error] Report API failed:`, error.stack || error.message);
    
    // Distinguish between bad requests and internal server errors
    if (error.message.includes("Invalid report")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: error.message || "Internal Server Error"
    });
  }
};
