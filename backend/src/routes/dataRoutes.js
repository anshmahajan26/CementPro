import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { addDailyRecord, getDataset, uploadDataset } from "../controllers/dataController.js";
import { authorize, protect } from "../middlewares/auth.js";

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.resolve("uploads");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.includes("csv") || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  }
});

router.post("/upload", protect, authorize("Admin", "Manager"), upload.single("file"), uploadDataset);
router.post("/add-record", protect, authorize("Admin", "Manager"), addDailyRecord);
router.get("/", protect, getDataset);

export default router;
