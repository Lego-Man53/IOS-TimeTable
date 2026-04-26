const STORAGE_KEY = 'jamea-timetable-v1';
const PDF_META_KEY = 'jamea-timetable-pdf-meta-v1';
const PDF_DB_NAME = 'jamea-timetable-pdf-db';
const PDF_STORE_NAME = 'pdfs';
const LIVE_TIMETABLE_URL = 'https://beta.jameasaifiyah.org/student/studentjadwalreport?mmid=1372';
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const els = {
  nowTime: document.querySelector('#nowTime'),
  nowDate: document.querySelector('#nowDate'),
  currentTitle: document.querySelector('#currentTitle'),
  currentMeta: document.querySelector('#currentMeta'),
  nextTitle: document.querySelector('#nextTitle'),
  nextMeta: document.querySelector('#nextMeta'),
  progressBar: document.querySelector('#progressBar'),
  todayList: document.querySelector('#todayList'),
  liveOpenLink: document.querySelector('#liveOpenLink'),
  pdfInput: document.querySelector('#pdfInput'),
  addPdfButton: document.querySelector('#addPdfButton'),
  openPdfButton: document.querySelector('#openPdfButton'),
  removePdfButton: document.querySelector('#removePdfButton'),
  pdfStatus: document.querySelector('#pdfStatus'),
  installButton: document.querySelector('#installButton'),
  installDialog: document.querySelector('#installDialog'),
};

let deferredInstallPrompt = null;
let pdfObjectUrl = null;

function parseTimetable(text) {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [day, start, end, subject, room = '', teacher = ''] = line.split(',').map(part => part.trim());
      if (!DAYS.includes(day) || !start || !end || !subject) {
        throw new Error(`Line ${index + 1} needs: day,start,end,subject,room,teacher`);
      }
      return { day, start, end, subject, room, teacher };
    })
    .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.start.localeCompare(b.start));
}

function stringifyTimetable(items) {
  return items.map(item => [item.day, item.start, item.end, item.subject, item.room, item.teacher].join(',')).join('\n');
}

function getSavedText() {
  return localStorage.getItem(STORAGE_KEY) || '';
}

function getTimetable() {
  const saved = getSavedText();
  return saved ? parseTimetable(saved) : [];
}

function toMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function describe(item) {
  const details = [item.room, item.teacher].filter(Boolean).join(' • ');
  return `${item.start}–${item.end}${details ? ` • ${details}` : ''}`;
}

function minutesUntil(item, now) {
  const itemDay = DAYS.indexOf(item.day);
  const today = now.getDay();
  const dayOffset = (itemDay - today + 7) % 7;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return dayOffset * 1440 + toMinutes(item.start) - currentMinutes;
}

function findCurrentAndNext(items, now) {
  const todayName = DAYS[now.getDay()];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const todayItems = items.filter(item => item.day === todayName);
  const current = todayItems.find(item => currentMinutes >= toMinutes(item.start) && currentMinutes < toMinutes(item.end));
  const upcoming = items
    .map(item => ({ item, wait: minutesUntil(item, now) }))
    .filter(entry => entry.wait >= 0 && entry.item !== current)
    .sort((a, b) => a.wait - b.wait)[0]?.item || null;
  return { current, next: upcoming, todayItems };
}

function render() {
  const now = new Date();
  const items = getTimetable();
  const { current, next, todayItems } = findCurrentAndNext(items, now);

  els.nowTime.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  els.nowDate.textContent = now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });

  if (current) {
    const start = toMinutes(current.start);
    const end = toMinutes(current.end);
    const currentMinute = now.getHours() * 60 + now.getMinutes();
    const progress = Math.max(0, Math.min(100, ((currentMinute - start) / (end - start)) * 100));
    els.currentTitle.textContent = current.subject;
    els.currentMeta.textContent = describe(current);
    els.progressBar.style.width = `${progress}%`;
  } else {
    els.currentTitle.textContent = items.length ? 'Free right now' : 'No class saved';
    els.currentMeta.textContent = items.length ? 'No saved class is active at this minute.' : 'Add your timetable PDF to keep it saved on this phone.';
    els.progressBar.style.width = '0%';
  }

  if (next) {
    const wait = minutesUntil(next, now);
    const when = wait < 1440 ? `in ${Math.max(0, wait)} min` : `on ${next.day}`;
    els.nextTitle.textContent = next.subject;
    els.nextMeta.textContent = `${when} • ${describe(next)}`;
  } else {
    els.nextTitle.textContent = 'Nothing scheduled';
    els.nextMeta.textContent = items.length ? 'No upcoming class found.' : 'Your PDF timetable will be the main saved backup.';
  }

  els.todayList.innerHTML = '';
  if (!todayItems.length) {
    const empty = document.createElement('article');
    empty.className = 'slot';
    empty.innerHTML = '<div class="slot-time">PDF backup</div><div><p class="slot-title">Add your timetable PDF</p><p class="slot-meta">Use Add PDF above to save or replace your timetable.</p></div>';
    els.todayList.append(empty);
    return;
  }

  for (const item of todayItems) {
    const slot = document.createElement('article');
    slot.className = `slot${item === current ? ' active' : ''}`;
    const time = document.createElement('div');
    const content = document.createElement('div');
    const title = document.createElement('p');
    const meta = document.createElement('p');
    time.className = 'slot-time';
    title.className = 'slot-title';
    meta.className = 'slot-meta';
    time.innerHTML = `${item.start}<br>${item.end}`;
    title.textContent = item.subject;
    meta.textContent = [item.room, item.teacher].filter(Boolean).join(' • ') || 'No room saved';
    content.append(title, meta);
    slot.append(time, content);
    els.todayList.append(slot);
  }
}

function openPdfDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PDF_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(PDF_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function savePdf(file) {
  const db = await openPdfDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(PDF_STORE_NAME, 'readwrite');
    transaction.objectStore(PDF_STORE_NAME).put(file, 'current');
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
  localStorage.setItem(PDF_META_KEY, JSON.stringify({
    name: file.name,
    size: file.size,
    savedAt: new Date().toISOString()
  }));
}

async function getPdf() {
  const db = await openPdfDb();
  const file = await new Promise((resolve, reject) => {
    const request = db.transaction(PDF_STORE_NAME, 'readonly').objectStore(PDF_STORE_NAME).get('current');
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return file;
}

async function deletePdf() {
  const db = await openPdfDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(PDF_STORE_NAME, 'readwrite');
    transaction.objectStore(PDF_STORE_NAME).delete('current');
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
  localStorage.removeItem(PDF_META_KEY);
}

function getPdfMeta() {
  try {
    return JSON.parse(localStorage.getItem(PDF_META_KEY)) || null;
  } catch {
    return null;
  }
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderPdfStatus() {
  const meta = getPdfMeta();
  if (!meta) {
    els.pdfStatus.textContent = 'No PDF added yet.';
    els.openPdfButton.disabled = true;
    els.removePdfButton.disabled = true;
    return;
  }
  const savedAt = new Date(meta.savedAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
  els.pdfStatus.textContent = `${meta.name} • ${formatFileSize(meta.size)} • saved ${savedAt}`;
  els.openPdfButton.disabled = false;
  els.removePdfButton.disabled = false;
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
});

els.installButton.addEventListener('click', async () => {
  if (!deferredInstallPrompt) {
    els.installDialog.showModal();
    return;
  }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
});

els.liveOpenLink.href = LIVE_TIMETABLE_URL;
els.addPdfButton.addEventListener('click', () => {
  els.pdfInput.click();
});

els.pdfInput.addEventListener('change', async () => {
  const file = els.pdfInput.files[0];
  if (!file) return;
  if (file.type !== 'application/pdf') {
    alert('Please choose a PDF file.');
    els.pdfInput.value = '';
    return;
  }
  try {
    await savePdf(file);
    renderPdfStatus();
  } catch {
    alert('Could not save this PDF on this device.');
  } finally {
    els.pdfInput.value = '';
  }
});

els.openPdfButton.addEventListener('click', async () => {
  try {
    const file = await getPdf();
    if (!file) {
      renderPdfStatus();
      return;
    }
    if (pdfObjectUrl) URL.revokeObjectURL(pdfObjectUrl);
    pdfObjectUrl = URL.createObjectURL(file);
    window.open(pdfObjectUrl, '_blank', 'noopener');
  } catch {
    alert('Could not open the saved PDF.');
  }
});

els.removePdfButton.addEventListener('click', async () => {
  await deletePdf();
  if (pdfObjectUrl) {
    URL.revokeObjectURL(pdfObjectUrl);
    pdfObjectUrl = null;
  }
  renderPdfStatus();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js');
}

render();
renderPdfStatus();
setInterval(render, 15000);
