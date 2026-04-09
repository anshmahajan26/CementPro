import path from "path";
import fs from "fs";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

export const generateExcelReport = async (type, rows, outputDir) => {
  ensureDir(outputDir);
  const fileName = `${type}-report-${Date.now()}.xlsx`;
  const filePath = path.join(outputDir, fileName);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`${type}-report`);

  if (!rows.length) {
    sheet.addRow(["No data available"]);
  } else {
    const keys = Object.keys(rows[0]);
    sheet.columns = keys.map((key) => ({ header: key, key, width: 22 }));
    rows.forEach((row) => sheet.addRow(row));
  }

  await workbook.xlsx.writeFile(filePath);
  return { fileName, filePath };
};

export const generatePdfReport = async (type, rows, outputDir) => {
  ensureDir(outputDir);
  const fileName = `${type}-report-${Date.now()}.pdf`;
  const filePath = path.join(outputDir, fileName);

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30 });
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);
    doc.fontSize(16).text(`${type.toUpperCase()} REPORT`, { underline: true });
    doc.moveDown();

    if (!rows.length) {
      doc.fontSize(12).text("No data available");
    } else {
      rows.forEach((row, idx) => {
        doc.fontSize(10).text(`${idx + 1}. ${JSON.stringify(row)}`);
        doc.moveDown(0.4);
      });
    }

    doc.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  return { fileName, filePath };
};
