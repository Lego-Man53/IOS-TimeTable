const STORAGE_KEY = 'jamea-timetable-v1';
const PDF_META_KEY = 'jamea-timetable-pdf-meta-v1';
const PDF_DB_NAME = 'jamea-timetable-pdf-db';
const PDF_STORE_NAME = 'pdfs';
const LIVE_TIMETABLE_URL = 'https://beta.jameasaifiyah.org/student/studentjadwalreport?mmid=1372';
const SHARED_PDF_URL = './timetable.pdf';
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
  pdfViewerCard: document.querySelector('#pdfViewerCard'),
  pdfViewerTitle: document.querySelector('#pdfViewerTitle'),
  pdfViewerMeta: document.querySelector('#pdfViewerMeta'),
  pdfFrame: document.querySelector('#pdfFrame'),
  installButton: document.querySelector('#installButton'),
  installDialog: document.querySelector('#installDialog'),
};

let deferredInstallPrompt = null;
let pdfObjectUrl = null;
let activePdfUrl = null;
let hasPdfSource = false;
let pdfSourceLabel = '';

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
    els.currentTitle.textContent = items.length ? 'Free right now' : hasPdfSource ? 'PDF timetable ready' : 'No timetable PDF';
    els.currentMeta.textContent = items.length
      ? 'No saved class is active at this minute.'
      : hasPdfSource
        ? `${pdfSourceLabel} is ready below.`
        : 'Add your timetable PDF to show your schedule here.';
    els.progressBar.style.width = '0%';
  }

  if (next) {
    const wait = minutesUntil(next, now);
    const when = wait < 1440 ? `in ${Math.max(0, wait)} min` : `on ${next.day}`;
    els.nextTitle.textContent = next.subject;
    els.nextMeta.textContent = `${when} • ${describe(next)}`;
  } else {
    els.nextTitle.textContent = items.length ? 'Nothing scheduled' : hasPdfSource ? 'Open your PDF' : 'No PDF added';
    els.nextMeta.textContent = items.length
      ? 'No upcoming class found.'
      : hasPdfSource
        ? 'Use Open PDF or scroll down to view the timetable.'
        : 'Add a PDF to make it your saved timetable.';
  }

  els.todayList.innerHTML = '';
  if (!todayItems.length) {
    const empty = document.createElement('article');
    empty.className = 'slot';
    empty.innerHTML = hasPdfSource
      ? '<div class="slot-time">PDF ready</div><div><p class="slot-title">Your timetable PDF is shown below</p><p class="slot-meta">Use Add PDF to replace it on this device.</p></div>'
      : '<div class="slot-time">PDF backup</div><div><p class="slot-title">Add your timetable PDF</p><p class="slot-meta">Use Add PDF above to save or replace your timetable.</p></div>';
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

async function hasSharedPdf() {
  try {
    const response = await fetch(SHARED_PDF_URL, { cache: 'no-store', headers: { Accept: 'application/pdf' } });
    const contentType = response.headers.get('content-type') || '';
    return response.ok && contentType.includes('application/pdf');
  } catch {
    return false;
  }
}

function setPdfViewer(url, title, meta) {
  activePdfUrl = url;
  hasPdfSource = true;
  pdfSourceLabel = title;
  els.pdfViewerCard.hidden = false;
  els.pdfViewerTitle.textContent = title;
  els.pdfViewerMeta.textContent = meta;
  els.pdfFrame.src = url;
}

function clearPdfViewer() {
  activePdfUrl = null;
  hasPdfSource = false;
  pdfSourceLabel = '';
  els.pdfViewerCard.hidden = true;
  els.pdfFrame.removeAttribute('src');
}

async function showLocalPdf(meta) {
  const file = await getPdf();
  if (!file) return false;
  if (pdfObjectUrl) URL.revokeObjectURL(pdfObjectUrl);
  pdfObjectUrl = URL.createObjectURL(file);
  setPdfViewer(pdfObjectUrl, 'Saved on this device', `${meta.name} is shown below.`);
  return true;
}

async function renderPdfStatus() {
  const meta = getPdfMeta();
  if (meta && await showLocalPdf(meta)) {
    const savedAt = new Date(meta.savedAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
    els.pdfStatus.textContent = `${meta.name} • ${formatFileSize(meta.size)} • saved ${savedAt}`;
    els.addPdfButton.textContent = 'Replace PDF';
    els.openPdfButton.disabled = false;
    els.removePdfButton.disabled = false;
    render();
    return;
  }

  if (await hasSharedPdf()) {
    setPdfViewer(`${SHARED_PDF_URL}?v=${Date.now()}`, 'Shared GitHub PDF', 'This PDF is loaded from timetable.pdf in your GitHub Pages site.');
    els.pdfStatus.textContent = 'Using shared timetable.pdf from GitHub.';
    els.addPdfButton.textContent = 'Add local PDF';
    els.openPdfButton.disabled = false;
    els.removePdfButton.disabled = true;
    render();
    return;
  }

  clearPdfViewer();
  els.pdfStatus.textContent = 'No PDF added yet. To share one across devices, add a file named timetable.pdf to GitHub.';
  els.addPdfButton.textContent = 'Add PDF';
  els.openPdfButton.disabled = true;
  els.removePdfButton.disabled = true;
  render();
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
    await renderPdfStatus();
  } catch {
    alert('Could not save this PDF on this device.');
  } finally {
    els.pdfInput.value = '';
  }
});

els.openPdfButton.addEventListener('click', async () => {
  try {
    if (activePdfUrl) {
      window.open(activePdfUrl, '_blank', 'noopener');
      return;
    }
    await renderPdfStatus();
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
  await renderPdfStatus();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js');
}

render();
renderPdfStatus();
setInterval(render, 15000);
