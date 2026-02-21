# Installable Link Setup (iPhone + PWA)

## Ready hosting target
Use static hosting (recommended: GitHub Pages).

## GitHub Pages quick setup
1. Push folder contents to your GitHub repo root (or `/docs`).
2. In GitHub repo:
   - `Settings` -> `Pages`
   - Source: `Deploy from a branch`
   - Branch: `main` (or your branch), folder: `/root` (or `/docs`)
3. Save and wait for publish.

## Installable link format
- If repo is `https://github.com/<username>/<repo>`
- Your installable app link will be:
  - `https://<username>.github.io/<repo>/`

## iPhone install steps
1. Open the published link in Safari.
2. Keep internet on for first load (required once for cache install).
3. Tap Share -> `Add to Home Screen`.
4. Open from Home Screen.
5. Turn internet off and reopen app -> it should still work offline.

## Offline validation checklist
- Open app once online.
- Add/edit/delete any item.
- Close app, disable internet.
- Reopen from Home Screen.
- Verify existing data still visible and editable.

