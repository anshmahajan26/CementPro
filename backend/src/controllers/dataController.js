import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  addDatasetRecord,
  getActiveDataset,
  getDatasetSnapshotStats,
  REQUIRED_COLUMNS,
  parseCsvFile,
  saveDatasetBatch
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

    const rows = await parseCsvFile(req.file.path);
    const saveInfo = await saveDatasetBatch(rows);

    try {
      fs.mkdirSync(path.dirname(ML_DATA_FILE), { recursive: true });
      fs.copyFileSync(req.file.path, ML_DATA_FILE);
    } catch (fsError) {
      console.warn(`[Data Controller Warning] Could not copy uploaded dataset to local ML_DATA_FILE: ${fsError.message}`);
    }

    const dbRows = await getActiveDataset();
    
    // 🔥 FIX: Fire-and-forget training to prevent 502 Gateway Timeout on Render (max 30-60s)
    trainModel(dbRows).catch((err) => console.error("[Background Training Error]:", err.message));

    return res.status(201).json({
      message:
        saveInfo.skipped > 0
          ? `Dataset uploaded with preprocessing (${saveInfo.skipped} rows skipped). Model training started in background.`
          : "Dataset uploaded. Model training started in background.",
      upload: saveInfo
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
    
    // 🔥 FIX: Fire-and-forget training to prevent timeout
    trainModel(useDbRows ? rows : []).catch((err) => console.error("[Background Training Error]:", err.message));

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
    const stats = getDatasetSnapshotStats(rows);

    return res.json({
      stats,
      rows
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
