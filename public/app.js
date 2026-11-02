const input = document.getElementById('imageInput');
const statusEl = document.getElementById('status');
const root = document.getElementById('calendarRoot');
const downloadBtn = document.getElementById('downloadBtn');

let currentData = null;

const shiftColors = {
  '10:30-19:30': '#ece6ff',
  '12:30-21:30': '#fde9dd',
  '13:00-22:00': '#dff0ff'
};
const kindColors = {
  rest: '#def5dd',
  regular_leave: '#fbe0e7',
  holiday: '#fff1bf'
};
const weekdayNames = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];

function setStatus(text, cls = 'idle') {
  statusEl.textContent = text;
  statusEl.className = `status ${cls}`;
}

function normalizeLabel(label) {
  return String(label || '').replace(/[–—]/g, '-').replace(/\s+/g, '');
}

function pastelForLabel(label) {
  const normalized = normalizeLabel(label);
  if (shiftColors[normalized]) return shiftColors[normalized];
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 70% 92%)`;
}

function mondayFirstOffset(year, month) {
  const d = new Date(year, month - 1, 1);
  return (d.getDay() + 6) % 7;
}

function buildCell(entry, dayNumber) {
  const cell = document.createElement('div');
  cell.className = 'day-cell';
  const num = document.createElement('div');
  num.className = 'day-number';
  num.textContent = dayNumber;
  cell.appendChild(num);

  if (entry) {
    if (entry.kind === 'shift') {
      cell.style.background = pastelForLabel(entry.label);
      const label = document.createElement('div');
      label.className = 'day-label';
      const times = String(entry.label || '').split('-');
      label.textContent = times.length === 2 ? `${times[0]}\n${times[1]}` : entry.label;
      cell.appendChild(label);
    } else {
      cell.style.background = kindColors[entry.kind] || '#ffffff';
      const label = document.createElement('div');
      label.className = `day-label marker marker-${entry.kind}`;
      label.textContent = entry.label || '';
      cell.appendChild(label);
    }
  }
  return cell;
}

function leafSvg(cls) {
  return `
  <div class="leaf ${cls}" aria-hidden="true">
    <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 64c9-19 15-29 33-45 1 14-4 25-15 34 11-4 18-7 27-6-5 8-12 13-21 15 8 0 14 1 20 4-8 4-17 4-26 1-8 5-13 7-18 8z"/>
    </svg>
  </div>`;
}

function renderCalendar(data) {
  currentData = data;
  root.classList.remove('empty-state');

  const month = data.month || new Date().getMonth() + 1;
  const year = data.year || new Date().getFullYear();

  const daysInMonth = new Date(year, month, 0).getDate();
  const offset = mondayFirstOffset(year, month);
  const map = new Map((data.days || []).map(item => [Number(item.day), item]));

  const content = document.createElement('div');
  content.className = 'calendar-content';

  const header = document.createElement('div');
  header.className = 'calendar-header';
  header.innerHTML = `
    ${leafSvg('left')}
    ${leafSvg('right')}
    <h2 class="calendar-title">${month}月班表</h2>
    <div class="calendar-badge">${year}.${String(month).padStart(2, '0')}</div>
  `;
  content.appendChild(header);

  const weekdayRow = document.createElement('div');
  weekdayRow.className = 'weekday-row';
  weekdayNames.forEach(name => {
    const el = document.createElement('div');
    el.className = 'weekday';
    el.textContent = name;
    weekdayRow.appendChild(el);
  });
  content.appendChild(weekdayRow);

  const grid = document.createElement('div');
  grid.className = 'calendar-grid';

  const totalSlots = Math.ceil((offset + daysInMonth) / 7) * 7;
  for (let i = 0; i < totalSlots; i++) {
    if (i < offset || i >= offset + daysInMonth) {
      const blank = document.createElement('div');
      blank.className = 'day-cell';
      grid.appendChild(blank);
      continue;
    }
    const day = i - offset + 1;
    grid.appendChild(buildCell(map.get(day), day));
  }

  content.appendChild(grid);
  root.innerHTML = '';
  root.appendChild(content);

  const status = data.year ? `已完成：${year} 年 ${month} 月班表` : `已完成：${month} 月班表（年份未清楚辨識，暫用 ${year}）`;
  setStatus(status + (data.notes ? `｜${data.notes}` : ''), 'ok');
  downloadBtn.disabled = false;
}

async function handleUpload(file) {
  if (!file) return;
  setStatus('辨識中，請稍候…', 'working');
  currentData = null;
  root.classList.add('empty-state');
  root.innerHTML = '<div class="placeholder">正在辨識照片…</div>';
  downloadBtn.disabled = true;

  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch('/api/extract-schedule', {
      method: 'POST',
      body: formData
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '辨識失敗');
    if (!data.found) {
      currentData = null;
      root.innerHTML = '<div class="placeholder"><div class="placeholder-icon">⚠️</div><div>找不到指定班表列，請重新拍攝。</div></div>';
      root.classList.add('empty-state');
      setStatus(data.notes || '找不到指定班表列，請重新拍攝。', 'error');
      return;
    }
    renderCalendar(data);
  } catch (error) {
    console.error(error);
    setStatus(error.message || '處理失敗，請再試一次。', 'error');
  }
}

input.addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  handleUpload(file);
});

downloadBtn.addEventListener('click', async () => {
  if (!currentData) return;
  setStatus('正在輸出 PNG…', 'working');
  const canvas = await html2canvas(root, {
    backgroundColor: null,
    scale: 3,
    useCORS: true
  });
  const link = document.createElement('a');
  const month = currentData.month || new Date().getMonth() + 1;
  link.download = `${month}月班表.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  setStatus('PNG 已準備完成，可再次上傳新照片。', 'ok');
});
