import fs from "fs";
import csv from "csv-parser";
import { DatasetRecord } from "../models/DatasetRecord.js";

export const REQUIRED_COLUMNS = [
  "date",
  "daily_rmc_volume_m3",
  "project_size",
  "day_in_project",
  "latitude",
  "longitude",
  "cement_kg_m3",
  "aggregate_10mm_pct",
  "aggregate_20mm_pct",
  "agg_moisture_content_pct",
  "water_binder_ratio",
  "slump_mm",
  "batching_time_min",
  "transport_time_min",
  "truck_capacity_m3"
];

const parseNumber = (value, key) => {
  const cleaned = String(value ?? "")
    .replace(/,/g, "")
    .replace(/%/g, "")
    .trim();

  const parsed = Number(cleaned);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid numeric value in column '${key}': ${value}`);
  }
  return parsed;
};

const parseDateFlexible = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    throw new Error(`Invalid date value: ${value}`);
  }

  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  const dayFirst = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dayFirst) {
    const day = Number(dayFirst[1]);
    const month = Number(dayFirst[2]);
    const yearRaw = Number(dayFirst[3]);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    const parsed = new Date(Date.UTC(year, month - 1, day));

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  throw new Error(`Invalid date value: ${value}`);
};

const stableBucketFromText = (text) => {
  const source = String(text || "unknown");
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) % 997;
  }

  // Keep encoded category on a compact numeric scale.
  return 1 + (hash % 40) / 10;
};

export const parseProjectSizeValue = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") {
    throw new Error("Invalid project_size value: empty");
  }

  const direct = Number(value);
  if (!Number.isNaN(direct)) {
    return direct;
  }

  const normalized = String(value || "").trim().toLowerCase();
  const map = {
    micro: 0.6,
    tiny: 0.8,
    small: 1.2,
    medium: 2.2,
    large: 3.5,
    mega: 5.0
  };

  if (map[normalized] !== undefined) {
    return map[normalized];
  }

  const numericFromText = normalized.match(/\d+(\.\d+)?/);
  if (numericFromText) {
    return Number(numericFromText[0]);
  }

  return stableBucketFromText(normalized);
};

export const normalizeDatasetRow = (row, batchId) => {
  const parsedDate = parseDateFlexible(row.date);

  return {
    batchId,
    date: parsedDate,
    daily_rmc_volume_m3: parseNumber(row.daily_rmc_volume_m3, "daily_rmc_volume_m3"),
    project_size: parseProjectSizeValue(row.project_size),
    day_in_project: parseNumber(row.day_in_project, "day_in_project"),
    latitude: parseNumber(row.latitude, "latitude"),
    longitude: parseNumber(row.longitude, "longitude"),
    cement_kg_m3: parseNumber(row.cement_kg_m3, "cement_kg_m3"),
    aggregate_10mm_pct: parseNumber(row.aggregate_10mm_pct, "aggregate_10mm_pct"),
    aggregate_20mm_pct: parseNumber(row.aggregate_20mm_pct, "aggregate_20mm_pct"),
    agg_moisture_content_pct: parseNumber(row.agg_moisture_content_pct, "agg_moisture_content_pct"),
    water_binder_ratio: parseNumber(row.water_binder_ratio, "water_binder_ratio"),
    slump_mm: parseNumber(row.slump_mm, "slump_mm"),
    batching_time_min: parseNumber(row.batching_time_min, "batching_time_min"),
    transport_time_min: parseNumber(row.transport_time_min, "transport_time_min"),
    truck_capacity_m3: parseNumber(row.truck_capacity_m3, "truck_capacity_m3")
  };
};

export const streamAndSaveCsv = (filePath) =>
  new Promise(async (resolve, reject) => {
    try {
      const batchId = `batch_${Date.now()}`;
      let batch = [];
      let totalCount = 0;
      let skipped = 0;
      let headersChecked = false;
      const BATCH_SIZE = 1000;

      // Clear the collection before streaming new data
      await DatasetRecord.deleteMany({});

      const stream = fs.createReadStream(filePath).pipe(csv());

      stream.on("headers", (headers) => {
        headersChecked = true;
        const missing = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
        if (missing.length) {
          stream.destroy();
          reject(new Error(`Missing required columns: ${missing.join(", ")}`));
        }
      });

      stream.on("data", async (data) => {
        try {
          const normalized = normalizeDatasetRow(data, batchId);
          batch.push(normalized);
        } catch (error) {
          skipped += 1;
        }

        if (batch.length >= BATCH_SIZE) {
          // Pause the stream while we wait for insert
          stream.pause();
          const currentBatch = [...batch];
          batch = [];

          try {
            await DatasetRecord.insertMany(currentBatch, { ordered: false });
            totalCount += currentBatch.length;
          } catch (insertErr) {
            console.error("Batch insert error:", insertErr.message);
          }
          stream.resume();
        }
      });

      stream.on("error", (err) => {
        reject(err);
      });

      stream.on("end", async () => {
        if (!headersChecked) {
          return reject(new Error("CSV file does not contain headers."));
        }

        // Insert any remaining items in the buffer
        if (batch.length > 0) {
          try {
            await DatasetRecord.insertMany(batch, { ordered: false });
            totalCount += batch.length;
          } catch (insertErr) {
            console.error("Final batch insert error:", insertErr.message);
          }
        }

        if (totalCount === 0) {
          return reject(new Error("No valid rows found after preprocessing. Check CSV date/number formats."));
        }

        // ✅ Invalidate the in-process cache after dataset update
        _datasetCache = null;
        _cacheTimestamp = 0;

        resolve({ batchId, count: totalCount, skipped });
      });
    } catch (err) {
      reject(err);
    }
  });

export const addDatasetRecord = async (rawRow) => {
  const latest = await DatasetRecord.findOne({}).sort({ createdAt: -1 }).lean();
  const batchId = latest?.batchId || `batch_${Date.now()}`;
  const row = normalizeDatasetRow(rawRow, batchId);
  const created = await DatasetRecord.create(row);

  // ✅ Invalidate cache when a new record is added
  _datasetCache = null;
  _cacheTimestamp = 0;

  return created.toObject();
};

// ✅ FIX: In-process cache for getActiveDataset — prevents repeated MongoDB queries
// on every API request (dashboard, forecast, carbon, procurement all call this).
// Cache TTL: 30 seconds — safe because dataset only changes on upload/add-record.
let _datasetCache = null;
let _cacheTimestamp = 0;
const CACHE_TTL_MS = 30 * 1000;

export const getActiveDataset = async () => {
  const now = Date.now();
  if (_datasetCache && now - _cacheTimestamp < CACHE_TTL_MS) {
    return _datasetCache;
  }
  // ✅ FIX: Limit to 1000 records to prevent OOM server crashes, reverse for chronological order
  const latestRows = await DatasetRecord.find({}).sort({ date: -1 }).limit(1000).lean();
  const rows = latestRows.reverse();
  
  _datasetCache = rows;
  _cacheTimestamp = now;
  return rows;
};

export const getGlobalDatasetStats = async () => {
  const agg = await DatasetRecord.aggregate([
    {
      $group: {
        _id: null,
        totalRows: { $sum: 1 },
        startDate: { $min: "$date" },
        endDate: { $max: "$date" },
        avgDemand: { $avg: "$daily_rmc_volume_m3" },
        avgTransportTime: { $avg: "$transport_time_min" },
        avgCementKgM3: { $avg: "$cement_kg_m3" }
      }
    }
  ]);

  if (!agg || agg.length === 0) {
    return null;
  }

  const result = agg[0];
  delete result._id;
  return result;
};

export const exportDatasetAsCsvStream = (res) => {
  const header = REQUIRED_COLUMNS.join(",");
  res.write(`${header}\n`);

  const csvEscape = (value) => {
    const stringValue = value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? "");
    if (stringValue.includes(",") || stringValue.includes("\"") || stringValue.includes("\n")) {
      return `"${stringValue.replace(/\"/g, "\"\"")}"`;
    }
    return stringValue;
  };

  const cursor = DatasetRecord.find({}).sort({ date: 1 }).cursor();

  cursor.on('data', (row) => {
    const csvRow = REQUIRED_COLUMNS.map((col) => {
      if (col === "date") {
        return csvEscape(new Date(row.date));
      }
      return csvEscape(row[col]);
    }).join(",");
    res.write(`${csvRow}\n`);
  });

  cursor.on('end', () => {
    res.end();
  });

  cursor.on('error', (err) => {
    console.error("Cursor error streaming CSV:", err);
    res.status(500).end();
  });
};
