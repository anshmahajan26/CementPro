import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  addDatasetRecord,
  getActiveDataset,
  getGlobalDatasetStats,
  REQUIRED_COLUMNS,
  streamAndSaveCsv,
  exportDatasetAsCsvStream
} from "../services/datasetService.js";
import { trainModel } from "../services/mlService.js";

// ✅ FIX: Use import.meta.url instead of CWD-relative path — prevents breakage
// when the server is started from a different working directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ML_DATA_FILE = path.resolve(__dirname, "..", "..", "..", "ml-model", "data", "latest.csv");

const csvEscape = (value) => {
  const stringValue = value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? "");
  if (stringValue.includes(",") || stringValue.includes("\"") || stringValue.includes("\n")) {
    return `"${stringValue.replace(/\"/g, "\"\"")}"`;
  }
  return stringValue;
};

const syncMlDataFileFromRows = (rows) => {
  try {
    fs.mkdirSync(path.dirname(ML_DATA_FILE), { recursive: true });

    const header = REQUIRED_COLUMNS.join(",");
    const body = rows
      .map((row) =>
        REQUIRED_COLUMNS.map((col) => {
          if (col === "date") {
            return csvEscape(new Date(row.date));
          }
          return csvEscape(row[col]);
        }).join(",")
      )
      .join("\n");

    fs.writeFileSync(ML_DATA_FILE, `${header}\n${body}`, "utf-8");
  } catch (error) {
    console.warn(`[Data Controller Warning] Could not sync local ML_DATA_FILE: ${error.message}`);
  }
};

export const uploadDataset = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "CSV file is required" });
    }

    const filePath = req.file.path;

    // 🔥 FIX: Move the ENTIRE parsing and saving process to the background
    // A 26MB CSV takes too long to parse and save to MongoDB synchronously, causing Render 502 Timeout.
    (async () => {
      try {
        console.log(`[Background] Starting to process and stream uploaded file: ${filePath}`);
        const saveInfo = await streamAndSaveCsv(filePath);
        console.log(`[Background] Saved to DB. Copied: ${saveInfo.count}, Skipped: ${saveInfo.skipped}.`);

        try {
          fs.mkdirSync(path.dirname(ML_DATA_FILE), { recursive: true });
          fs.copyFileSync(filePath, ML_DATA_FILE);
        } catch (fsError) {
          console.warn(`[Background Warning] Could not copy dataset to local ML_DATA_FILE: ${fsError.message}`);
        }

        console.log(`[Background] Triggering model training via streaming URL...`);
        const downloadUrl = `${req.protocol}://${req.get("host")}/api/data/internal/export`;
        await trainModel([], downloadUrl);
        console.log(`[Background] Processing and model training fully complete!`);
      } catch (err) {
        console.error(`[Background Error] Failed to process dataset:`, err.message);
      }
    })();

    return res.status(202).json({
      message: "File uploaded successfully! Data processing and model training are running in the background. Your dashboard will update in a few minutes.",
      upload: { status: "processing" }
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

export const addDailyRecord = async (req, res) => {
  try {
    const createdRecord = await addDatasetRecord(req.body);
    const rows = await getActiveDataset();

    syncMlDataFileFromRows(rows);
    const useDbRows = rows.length >= 20;
    
    // 🔥 FIX: Fire-and-forget training using CSV streaming
    const downloadUrl = `${req.protocol}://${req.get("host")}/api/data/internal/export`;
    trainModel([], downloadUrl).catch((err) => console.error("[Background Training Error]:", err.message));

    return res.status(201).json({
      message: useDbRows
        ? "Daily record added and model retraining started in background"
        : "Daily record added. Model retraining started in background.",
      createdRecord,
      totalRows: rows.length
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

export const getDataset = async (req, res) => {
  try {
    const rows = await getActiveDataset();
    const stats = await getGlobalDatasetStats();

    return res.json({
      stats,
      rows
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const exportCsv = async (req, res) => {
  try {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="dataset.csv"');
    exportDatasetAsCsvStream(res);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
