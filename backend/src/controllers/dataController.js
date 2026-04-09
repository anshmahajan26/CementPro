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
};

export const uploadDataset = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "CSV file is required" });
    }

    const rows = await parseCsvFile(req.file.path);
    const saveInfo = await saveDatasetBatch(rows);

    fs.mkdirSync(path.dirname(ML_DATA_FILE), { recursive: true });
    fs.copyFileSync(req.file.path, ML_DATA_FILE);

    const dbRows = await getActiveDataset();
    const trainResult = await trainModel(dbRows);

    return res.status(201).json({
      message:
        saveInfo.skipped > 0
          ? `Dataset uploaded with preprocessing (${saveInfo.skipped} rows skipped) and model trained`
          : "Dataset uploaded and model trained",
      upload: saveInfo,
      trainResult
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
    const trainResult = await trainModel(useDbRows ? rows : []);

    return res.status(201).json({
      message: useDbRows
        ? "Daily record added and model retrained"
        : "Daily record added. Model retrained using available ML data source until Mongo reaches 20 rows.",
      createdRecord,
      totalRows: rows.length,
      trainResult
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
