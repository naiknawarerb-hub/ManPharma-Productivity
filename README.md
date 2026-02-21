# ManPharma Offline Mobile Dashboard

Mobile-first productivity dashboard with clean native-style UI, working forms/buttons, due alerts, and full PWA offline shell.

## Run locally
1. Open terminal:
   ```bash
   cd "/Users/raman/Documents/New project/manpharma-offline-app"
   ```
2. Start server:
   ```bash
   python3 -m http.server 8080
   ```
3. Open:
   - [http://localhost:8080](http://localhost:8080)

## PWA install (iPhone Safari)
1. Open app on Safari using localhost or hosted URL.
2. Tap Share icon.
3. Tap **Add to Home Screen**.
4. Launch from home screen for standalone app mode.

## Offline behavior
- First online load caches app shell via `service-worker.js`.
- App data is saved in localStorage only (`manpharma_data`, `manpharma_meta`).
- No backend/API dependency.
- If network is unavailable, cached shell + `offline.html` fallback is used.

## Folder structure (static hosting ready)
- `index.html`
- `styles.css`
- `storage.js`
- `ui.js`
- `main.js`
- `manifest.json`
- `service-worker.js`
- `offline.html`
- `assets/icons/icon-192.png`
- `assets/icons/icon-512.png`
- `run-local.sh`

## Features
- Clean top app bar (no fake status bar).
- In-app branding settings with offline logo upload (JPG/PNG/SVG), replace, and remove.
- Advanced branding: top-center circular logo, logo crop toggle, and logo position controls.
- Header brand title + tagline persist across refresh.
- Optimized icon sizes and typography for mobile.
- High-contrast action buttons for readability.
- Fully working quick-action modals and bottom navigation.
- Bottom nav icons with improved iPhone tap area.
- Dynamic custom categories in New Idea modal.
- Complete/undo + delete system for tasks, notes, ideas, posts, and videos.
- Collapsible Completed section with completion date tracking.
- Due-date notifications panel + browser notification support.
- Data persistence in `localStorage`.

## Reset app data
Run in browser console:
```js
localStorage.removeItem("manpharma_data")
localStorage.removeItem("manpharma_meta")
localStorage.removeItem("manpharma_last_notification")
```
Then refresh.
