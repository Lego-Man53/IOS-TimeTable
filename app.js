const STORAGE_KEY = 'jamea-timetable-v1';
const AUTO_LIVE_KEY = 'jamea-auto-live-v1';
const LIVE_TIMETABLE_URL = 'https://beta.jameasaifiyah.org/student/studentjadwalreport?mmid=1372';
const LIVE_REFRESH_MS = 5 * 60 * 1000;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SAMPLE = `Monday,08:00,08:45,Nahw,Room 4,
Monday,09:00,09:45,Fiqh,Room 2,
Monday,10:15,11:00,Arabic Literature,Hall A,
Tuesday,08:00,08:45,Quran,Room 1,
Tuesday,09:00,09:45,Tareekh,Room 5,
Wednesday,08:00,08:45,Nahw,Room 4,
Wednesday,09:00,09:45,Fiqh,Room 2,
Thursday,08:00,08:45,Quran,Room 1,
Thursday,09:00,09:45,Arabic Literature,Hall A,
Saturday,08:00,08:45,Tareekh,Room 5,`;

const els = {
  nowTime: document.querySelector('#nowTime'),
  nowDate: document.querySelector('#nowDate'),
  currentTitle: document.querySelector('#currentTitle'),
  currentMeta: document.querySelector('#currentMeta'),
  nextTitle: document.querySelector('#nextTitle'),
  nextMeta: document.querySelector('#nextMeta'),
  progressBar: document.querySelector('#progressBar'),
  dayTitle: document.querySelector('#dayTitle'),
  todayList: document.querySelector('#todayList'),
  liveFrame: document.querySelector('#liveFrame'),
  liveOpenLink: document.querySelector('#liveOpenLink'),
  fullLiveButton: document.querySelector('#fullLiveButton'),
  liveRefreshButton: document.querySelector('#liveRefreshButton'),
  liveStatus: document.querySelector('#liveStatus'),
  autoLiveToggle: document.querySelector('#autoLiveToggle'),
  editButton: document.querySelector('#editButton'),
  installButton: document.querySelector('#installButton'),
  editorDialog: document.querySelector('#editorDialog'),
  installDialog: document.querySelector('#installDialog'),
  timetableInput: document.querySelector('#timetableInput'),
  saveButton: document.querySelector('#saveButton'),
  loadSample: document.querySelector('#loadSample'),
  exportButton: document.querySelector('#exportButton'),
};

let deferredInstallPrompt = null;
let lastLiveRefresh = null;

if (localStorage.getItem(AUTO_LIVE_KEY) === 'true' && !location.search.includes('stay=app')) {
  location.replace(LIVE_TIMETABLE_URL);
}

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
  const todayName = DAYS[now.getDay()];

  els.nowTime.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  els.nowDate.textContent = now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  els.dayTitle.textContent = `${todayName}'s schedule`;

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
    els.currentMeta.textContent = items.length ? 'No saved class is active at this minute.' : 'Tap Edit timetable to add your schedule once.';
    els.progressBar.style.width = '0%';
  }

  if (next) {
    const wait = minutesUntil(next, now);
    const when = wait < 1440 ? `in ${Math.max(0, wait)} min` : `on ${next.day}`;
    els.nextTitle.textContent = next.subject;
    els.nextMeta.textContent = `${when} • ${describe(next)}`;
  } else {
    els.nextTitle.textContent = 'Nothing scheduled';
    els.nextMeta.textContent = items.length ? 'No upcoming class found.' : 'Your next class will appear here after saving.';
  }

  els.todayList.innerHTML = '';
  if (!todayItems.length) {
    const empty = document.createElement('article');
    empty.className = 'slot';
    empty.innerHTML = '<div class="slot-time">No entries</div><div><p class="slot-title">Nothing saved for today</p><p class="slot-meta">Add your real timetable in the editor.</p></div>';
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

function refreshLiveFrame() {
  lastLiveRefresh = new Date();
  const separator = LIVE_TIMETABLE_URL.includes('?') ? '&' : '?';
  els.liveFrame.src = `${LIVE_TIMETABLE_URL}${separator}refresh=${Date.now()}`;
  els.liveStatus.textContent = `Live view refreshed at ${lastLiveRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
}

els.editButton.addEventListener('click', () => {
  els.timetableInput.value = getSavedText();
  els.editorDialog.showModal();
});

els.loadSample.addEventListener('click', () => {
  els.timetableInput.value = SAMPLE;
});

els.exportButton.addEventListener('click', async () => {
  await navigator.clipboard.writeText(els.timetableInput.value || getSavedText());
  els.exportButton.textContent = 'Copied';
  setTimeout(() => { els.exportButton.textContent = 'Copy backup'; }, 1300);
});

els.saveButton.addEventListener('click', event => {
  event.preventDefault();
  try {
    parseTimetable(els.timetableInput.value);
    localStorage.setItem(STORAGE_KEY, els.timetableInput.value.trim());
    els.editorDialog.close();
    render();
  } catch (error) {
    alert(error.message);
  }
});

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
els.fullLiveButton.addEventListener('click', () => {
  location.href = LIVE_TIMETABLE_URL;
});
els.liveRefreshButton.addEventListener('click', refreshLiveFrame);
els.autoLiveToggle.checked = localStorage.getItem(AUTO_LIVE_KEY) === 'true';
els.autoLiveToggle.addEventListener('change', () => {
  localStorage.setItem(AUTO_LIVE_KEY, String(els.autoLiveToggle.checked));
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js');
}

render();
setInterval(render, 15000);
setInterval(refreshLiveFrame, LIVE_REFRESH_MS);
