const express = require('express');
const multer = require('multer');
const path = require('path');
const dotenv = require('dotenv');
const { recognize } = require('./gemini');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return cb(new Error('僅支援 JPG、PNG 或 WebP 圖片'));
    }
    cb(null, true);
  }
});

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '2mb' }));
app.disable('x-powered-by');
app.get('/health', (_, res) => res.json({ status: 'ok' }));

function extractJson(text) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced) return JSON.parse(fenced[1]);
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
  throw new Error('No JSON found in model response');
}

const extractionPrompt = `
You are reading a monthly shift schedule image.
Your task is to locate the employee row whose employee ID is exactly 25001104.
Do not choose a different employee. If the row cannot be found reliably, return found=false.

Important requirements:
1. Read the month from the table header if possible.
2. Read the year if possible. If the year is not visible or not reliable, set year to null and yearInferred to false.
3. Extract each calendar day shown for that employee row only.
4. Convert time values like 1030 to 10:30 and 1930 to 19:30.
5. If a day contains two stacked times, treat them as start and end for one shift.
6. Recognize the Chinese markers:
   - 休 => kind = "rest"
   - 例 => kind = "regular_leave"
   - 國 => kind = "holiday"
7. If a day contains a work shift, use kind = "shift" and include label formatted like "10:30-19:30".
8. Preserve blank / unavailable days as omitted items; do not invent shifts.
9. Output strict JSON only.

Return exactly this JSON shape:
{
  "found": true,
  "employeeId": "25001104",
  "month": 10,
  "year": 2026,
  "yearInferred": true,
  "days": [
    {"day": 1, "kind": "shift", "label": "12:30-21:30", "start": "12:30", "end": "21:30"},
    {"day": 2, "kind": "shift", "label": "13:00-22:00", "start": "13:00", "end": "22:00"},
    {"day": 5, "kind": "regular_leave", "label": "例"},
    {"day": 9, "kind": "rest", "label": "休"},
    {"day": 17, "kind": "holiday", "label": "國"}
  ],
  "notes": "short note about uncertainty if any"
}

If the row is not found, return:
{
  "found": false,
  "employeeId": "25001104",
  "month": null,
  "year": null,
  "yearInferred": false,
  "days": [],
  "notes": "reason"
}
`;

app.post('/api/extract-schedule', upload.single('image'), async (req, res) => {
  
  try {
    if (!apiKey) {
      return res.status(503).json({ error: 'Google 照片辨識尚未啟用，請先設定後端 GEMINI_API_KEY。' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded.' });
    }

    const imageBuffer = req.file.buffer;
    const base64 = imageBuffer.toString('base64');
    const mime = req.file.mimetype || 'image/jpeg';

    const outputText = await recognize({ apiKey, model, prompt: extractionPrompt, mime, base64 });
    const data = extractJson(outputText);
    if (data.found !== true || data.employeeId !== '25001104') {
      return res.json({ found: false, notes: '找不到指定班表列，請重新拍攝。' });
    }
    const month = Number(data.month);
    const year = data.year == null ? null : Number(data.year);
    if (!Number.isInteger(month) || month < 1 || month > 12 ||
        (year !== null && (!Number.isInteger(year) || year < 2000 || year > 2100))) {
      return res.status(422).json({ error: '無法可靠辨識年月，請重新拍攝含年月標題的班表。' });
    }
    const daysInMonth = new Date(year || new Date().getFullYear(), month, 0).getDate();
    const allowed = new Set(['shift', 'rest', 'regular_leave', 'holiday']);
    const days = [];
    const seen = new Set();
    for (const entry of Array.isArray(data.days) ? data.days : []) {
      const day = Number(entry.day);
      if (!Number.isInteger(day) || day < 1 || day > daysInMonth || !allowed.has(entry.kind) || seen.has(day)) continue;
      const label = String(entry.label || '');
      if (entry.kind === 'shift' && !/^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(label)) continue;
      if (entry.kind !== 'shift' && !['休','例','國'].includes(label)) continue;
      seen.add(day);
      days.push({ day, kind: entry.kind, label });
    }
    if (days.length < 1) return res.status(422).json({ error: '未能讀到可確認的班別，請重新拍攝。' });
    res.json({ found: true, month, year, yearInferred: !!data.yearInferred, days, notes: '' });
  } catch (error) {
    const timeout = error.name === 'TimeoutError' || error.name === 'AbortError';
    console.error('Schedule recognition failed', { type: error.name, status: error.status || 500 });
    res.status(timeout ? 504 : (error.status || 502)).json({ error: timeout ? '辨識逾時，請稍後再試。' : (error.status ? error.message : '辨識未完成，請重新上傳清晰班表。') });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: '圖片不可超過 8MB。' });
  }
  if (err) return res.status(400).json({ error: err.message || '上傳失敗。' });
  next();
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Shift calendar app running at http://localhost:${port}`);
});
