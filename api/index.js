import pdf from "pdf-parse";
import XLSX from "xlsx";

export const config = {
  api: { bodyParser: false }
};

export default async function handler(req, res) {
  try {
    const buffer = await readBuffer(req);
    const contentType = req.headers["content-type"] || "";

    if (contentType.includes("pdf")) {
      const data = await pdf(buffer);
      const students = extractPDF(data.text);
      return res.status(200).json({ ok: true, type: "pdf", count: students.length, students });
    }

    if (contentType.includes("excel") || contentType.includes("spreadsheet") || contentType.includes("xlsx")) {
      const wb = XLSX.read(buffer, { type: "buffer" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);
      const students = extractExcel(rows);
      return res.status(200).json({ ok: true, type: "excel", count: students.length, students });
    }

    return res.status(400).json({ ok: false, message: "نوع ملف غير مدعوم" });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.toString() });
  }
}

function readBuffer(req) {
  return new Promise(resolve => {
    let chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

function extractPDF(text) {
  const lines = text.split("\n").map(t => t.trim());
  const students = [];
  let current = {};

  for (let line of lines) {
    if (/^[\u0600-\u06FF ]+$/.test(line) && line.length > 5) {
      if (current.name) students.push({ ...current });
      current = { name: line };
    }

    if (/\b\d{5,20}\b/.test(line)) {
      current.id = line.match(/\d{5,20}/)[0];
    }

    if (/\d+.*\d+/.test(line)) {
      let nums = line.match(/\d+/g);
      if (nums && nums.length >= 2) {
        current.grades = nums.map(Number);
      }
    }
  }

  if (current.name) students.push(current);
  return students;
}

function extractExcel(rows) {
  return rows.map(row => {
    const keys = Object.keys(row);

    const nameKey = keys.find(k => k.includes("اسم") || k.toLowerCase().includes("name"));
    const idKey = keys.find(k => k.includes("قيد") || k.toLowerCase().includes("id"));
    const gradeKeys = keys.filter(k => k.includes("مادة") || k.includes("درجة"));

    return {
      name: row[nameKey] || "",
      id: row[idKey] || "",
      grades: gradeKeys.map(k => Number(row[k]) || 0)
    };
  });
}
