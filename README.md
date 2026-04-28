# My Jamea Timetable

A small installable iPhone-friendly timetable app. It works as a Progressive Web App, so after it is hosted once, you can open it in Safari and use **Share → Add to Home Screen**. The app then opens like a normal app and keeps working offline.

## What it does

- Opens your official Jamea timetable page:
  `https://beta.jameasaifiyah.org/student/studentjadwalreport?mmid=1372`
- Shows the current class in real time.
- Shows the next upcoming class.
- Works offline after the first load.
- Shows the timetable PDF inside the app.
- Uses `timetable.pdf` from GitHub Pages as the shared PDF across devices when that file exists.
- Lets you add, replace, open, or remove a local PDF on one device.

## Important note

The Jamea student timetable is behind the official login. This app does not bypass that login, store your password, or scrape private school data. Use the **Open live page** button in the app, then sign in once if Jamea asks; Safari should keep the session.

No separate app can force Jamea to allow embedding or cross-site reading. Only Jamea can allow that from their server. This app opens the official page directly instead of embedding it.

The saved PDF is the main offline backup, so you can open your latest timetable from the app even when the official site is unavailable.

## Shared PDF across devices

GitHub Pages is a static website, so the app cannot safely upload a new PDF into the GitHub repo directly from the browser. To use the same PDF on every device, add a file named `timetable.pdf` to the root of this repository and publish it with GitHub Pages.

If `timetable.pdf` exists, the app loads and shows it automatically. The **Add PDF** button is still available for a local, device-only override.

## Open The Site

  Visit the URL: https://lego-man53.github.io/IOS-TimeTable/
