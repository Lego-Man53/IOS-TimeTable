# My Jamea Timetable

A small installable iPhone-friendly timetable app. It works as a Progressive Web App, so after it is hosted once, you can open it in Safari and use **Share → Add to Home Screen**. The app then opens like a normal app and keeps working offline.

## What it does

- Opens your official live Jamea timetable page:
  `https://beta.jameasaifiyah.org/student/studentjadwalreport?mmid=1372`
- Refreshes the official live view every 5 minutes while the app is open.
- Provides **Full live mode**, which replaces the app screen with the official timetable page. This avoids iframe/embed blocking because the Jamea page becomes the main page.
- Provides an **Auto-open live** toggle, so the Home Screen app can jump straight to the official live timetable on launch.
- Shows the current class in real time.
- Shows the next upcoming class.
- Works offline after the first load.
- Stores the timetable on the phone, so it does not need repeated downloads.
- Lets you copy a timetable backup and paste it back later.

## Important note

The Jamea student timetable is behind the official login. This app does not bypass that login, store your password, or scrape private school data. For the live page, sign in once if Jamea asks; Safari should keep the session. If Jamea blocks embedded viewing for security, use the **Open live page** button in the app.

No separate app can force Jamea to allow embedding or cross-site reading. Only Jamea can allow that from their server. Full live mode is the closest safe workaround because it loads the official page directly.

The offline timetable editor is still included as a backup, so you can quickly see your current/next class even when the official site is unavailable.

## Timetable format

Use one class per line:

```csv
Day,Start,End,Subject,Room,Teacher
Monday,08:00,08:45,Nahw,Room 4,
Monday,09:00,09:45,Fiqh,Room 2,
```

Valid days are `Sunday`, `Monday`, `Tuesday`, `Wednesday`, `Thursday`, `Friday`, and `Saturday`.

## Run locally

```bash
npm start
```

Then open `http://localhost:4173`.

## Put it on your iPhone

1. Host this folder on a static site host such as GitHub Pages, Netlify, Vercel, or Cloudflare Pages.
2. Open the hosted link in Safari on your iPhone.
3. Tap Share.
4. Tap Add to Home Screen.
5. Open it from your Home Screen like a normal app.
