# CCNA Progress Tracker - Project Instructions

Foundational mandates for the `ccna-progress` repository.

## Application Summary
A self-hosted web application to track progress through the "Summer of CCNA Study Plan". It serves a vanilla HTML/CSS/JS PWA from a dependency-free Node.js backend. Progress is persisted in a local JSON file.

## Tech Stack & Standards
- **Backend:** Node.js 20+ (native `http` server, no external npm dependencies).
- **Frontend:** Plain HTML5, CSS3 (Vanilla), and ES6 JavaScript.
- **Data:** JSON-based disk persistence.
- **PWA:** Service worker (`sw.js`) and Web Manifest.
- **Conventions:**
  - Strictly **dependency-free** runtime. Do not add npm packages.
  - Use `node:prefix` for built-in module imports (e.g., `node:http`).
  - Dark-themed UI using CSS custom properties defined in `styles.css`.
  - Functional, event-driven frontend in `app.js` with manual DOM manipulation.

## Architecture & Key Files
- `server.js`: The core backend. Handles static file serving, API routes (`/api/checklist`), and atomic-ish JSON persistence.
- `public/`: All frontend assets.
  - `index.html`: Main UI shell.
  - `app.js`: State management, rendering logic, and API interaction.
  - `sw.js`: Caching strategy (Network-first for static, bypass for API).
- `data/checklist.json`: The default progress data.
- `scripts/extract_checklist.py`: Python script for PDF extraction (requires `pypdf`).

## Key Workflows

### Local Development
- Run with `npm start` (defaults to `http://127.0.0.1:8088`).
- Configuration via environment variables: `HOST`, `PORT`, `CCNA_DATA_FILE`.

### Data Persistence
- Backend uses a temp-file-and-rename strategy for "atomic" writes to `checklist.json`.
- Validation is performed in `server.js` (`validatePlan`) before writing.

### Frontend Rendering
- The app uses a "render everything" approach for filter/search changes.
- **Surgical DOM Updates:** For simple task toggles (individual, day, or week) when no filters are active, the app updates only the affected DOM nodes and stats to maintain performance on low-resource hardware.
- Uses `Intl.DateTimeFormat` for dates, normalized to T12:00:00 to avoid timezone shifts.

## Key Features
- **Progress Tracking:** Interactive checklist with auto-save.
- **Filtering:** Search by title, filter by week or completion status.
- **Data Export:** Client-side "Export" button to download `checklist.json` backups.

## Constraints & Security
- **No Authentication:** The app is open by default. Security should be handled at the network/proxy level.
- **No Concurrency Control:** Last-write-wins for checklist updates.
- **Sanitization:** Be cautious with `innerHTML` in `app.js`. Use text content where possible to prevent XSS if notes are sourced from untrusted inputs.
- **Static Safety:** `server.js` performs path normalization and prefix checks to prevent directory traversal.

## Deployment
- Intended for Ubuntu/systemd/nginx environments.
- Production data should be stored in `/var/lib/ccna-progress/checklist.json` to persist across app updates.
