# CCNA Progress Tracker Context

## Application Summary

This repository contains a small self-hosted web application named `ccna-progress`. Its purpose is to track progress through the `Summer of CCNA Study Plan.pdf` checklist. The app is intentionally simple: a dependency-free Node.js HTTP server serves a vanilla HTML/CSS/JavaScript progressive web app, and progress is persisted by writing a JSON checklist file to disk.

The user-facing app is titled **Summer of CCNA 2026 Progress** and shows the imported **Academy CCNA Study Plan**. The default plan starts on `2026-05-04`, targets completion by `2026-08-28`, and contains 17 weeks, 83 scheduled days, and 457 checklist tasks. The initial bundled data has 0 completed tasks.

## Tech Stack

- Runtime: Node.js 20 or newer.
- Backend: native Node.js `http` server in `server.js`.
- Frontend: plain HTML, CSS, and JavaScript in `public/`.
- Data storage: JSON file on disk.
- PWA support: web manifest, service worker, and app icons.
- Deployment examples: Ubuntu `systemd` service and nginx reverse proxy config.
- Runtime dependencies: none.
- Package manager install step: none required.

## Repository Structure

```text
.
|-- Context.md
|-- README.md
|-- package.json
|-- server.js
|-- Summer of CCNA Study Plan.pdf
|-- data/
|   `-- checklist.json
|-- deploy/
|   |-- ccna-progress.service
|   `-- nginx.conf
|-- images/
|   `-- ss1.png
|-- public/
|   |-- app.js
|   |-- index.html
|   |-- manifest.webmanifest
|   |-- styles.css
|   |-- sw.js
|   `-- icons/
|       |-- icon-192.png
|       |-- icon-512.png
|       `-- maskable-512.png
`-- scripts/
    `-- extract_checklist.py
```

## Important Files

- `server.js`: dependency-free Node.js web server, static file server, JSON API, validation, and disk persistence.
- `public/index.html`: single-page app shell and DOM targets for the progress tracker.
- `public/app.js`: frontend state management, rendering, filtering, task toggling, notes editing, save behavior, and service worker registration.
- `public/styles.css`: dark responsive UI styling.
- `public/sw.js`: service worker that caches the app shell and static assets while bypassing API requests.
- `public/manifest.webmanifest`: PWA metadata and icon declarations.
- `data/checklist.json`: default checklist data generated from the PDF.
- `scripts/extract_checklist.py`: PDF-to-checklist extraction script.
- `deploy/ccna-progress.service`: example production `systemd` unit.
- `deploy/nginx.conf`: example nginx reverse proxy config.
- `README.md`: user setup, deployment, update, backup, and troubleshooting instructions.
- `images/ss1.png`: screenshot used by the README.
- `Summer of CCNA Study Plan.pdf`: source PDF for the checklist data.

## Local Commands

Run the app locally:

```bash
npm start
```

The app defaults to:

```text
http://127.0.0.1:8088
```

Useful environment variables:

```bash
HOST=127.0.0.1 PORT=8088 CCNA_DATA_FILE=/path/to/checklist.json npm start
```

On Windows PowerShell, the equivalent is:

```powershell
$env:HOST="127.0.0.1"; $env:PORT="8088"; $env:CCNA_DATA_FILE="C:\path\to\checklist.json"; npm start
```

## package.json

The package is named `ccna-progress`, version `1.0.0`, with description `A small self-hosted CCNA study plan progress tracker.` It is marked `UNLICENSED`.

Scripts:

- `npm start`: runs `node server.js`.
- `npm run dev`: also runs `node server.js`.

Engine requirement:

- `node >=20`.

There are no dependencies or dev dependencies.

## Backend Details

`server.js` uses only Node.js built-ins:

- `node:http`
- `node:fs/promises`
- `node:path`
- `node:crypto`

Configuration constants:

- `ROOT`: repository directory via `__dirname`.
- `PUBLIC_DIR`: `public/`.
- `DATA_FILE`: `process.env.CCNA_DATA_FILE` or `data/checklist.json`.
- `PORT`: `process.env.PORT` or `8088`.
- `HOST`: `process.env.HOST` or `127.0.0.1`.

Supported static MIME types:

- `.html`: `text/html; charset=utf-8`
- `.css`: `text/css; charset=utf-8`
- `.js`: `text/javascript; charset=utf-8`
- `.json`: `application/json; charset=utf-8`
- `.webmanifest`: `application/manifest+json; charset=utf-8`
- `.svg`: `image/svg+xml`
- `.png`: `image/png`

All responses sent through `send()` include `Cache-Control: no-store`, even static responses. The service worker may still cache static responses client-side.

### Backend Routes

- `GET /health`: returns `{"ok":true}`.
- `GET /api/checklist`: reads and returns the checklist JSON from `DATA_FILE`.
- `PUT /api/checklist`: reads the request body, parses JSON, validates the plan, writes it to `DATA_FILE`, and returns the saved plan.
- `GET /`: serves `public/index.html`.
- `GET` or `HEAD` for any other path: attempts to serve a matching static file from `public/`.
- Other HTTP methods: return `405` JSON with `{ "error": "Method not allowed" }`.
- Any thrown error in request handling returns `500` JSON with `{ "error": "<message>" }`.

### Request Body Handling

`readBody(req)` streams request chunks, accumulates them into memory, and rejects bodies larger than 2,000,000 bytes with `Request body is too large`.

### Checklist Validation

`validatePlan(plan)` requires:

- `plan` is an object.
- `plan.weeks` is an array.
- Each week has an integer `number` and a `days` array.
- Each day has a string `date` and a `tasks` array.
- Each task has a string `id` and string `title`.

During validation, task fields are normalized:

- `task.completed` is coerced to a boolean.
- `task.completedAt` is preserved or set to `null`.
- `task.notes` is preserved only if it is a string, otherwise set to an empty string.

The plan-level `updatedAt` is set to the current ISO timestamp on every save.

### Disk Persistence

Checklist writes are atomic-ish:

1. Validate and normalize the incoming plan.
2. Ensure the data directory exists.
3. Write formatted JSON to a temporary file named `.checklist.<uuid>.tmp` in the data directory.
4. Rename the temporary file to the configured `DATA_FILE`.

This avoids partially written JSON files in normal operation.

### Static File Safety

Static file requests are normalized and joined under `PUBLIC_DIR`. If the resulting path does not start with `PUBLIC_DIR`, the server returns `403 Forbidden`. Missing files return `404 Not found`.

## Frontend Details

The frontend is a single-page app driven by `public/app.js`.

### DOM Elements

`app.js` expects these IDs from `index.html`:

- `planTitle`
- `saveState`
- `saveButton`
- `completeCount`
- `remainingCount`
- `percentCount`
- `deadlineLabel`
- `searchInput`
- `weekFilter`
- `statusFilter`
- `progressBar`
- `weeks`

### Frontend State

The frontend state object contains:

- `plan`: the loaded checklist plan.
- `filters.query`: lowercase search query.
- `filters.week`: selected week number as a string or `all`.
- `filters.status`: `all`, `open`, or `done`.
- `saveTimer`: debounce timer for auto-save.

### App Initialization

`init()`:

1. Fetches `/api/checklist`.
2. Stores the returned plan in state.
3. Sets the page title text from `plan.title` or `CCNA Progress`.
4. Renders the week filter options.
5. Binds event handlers.
6. Renders the checklist.
7. Sets save status to `Ready`.

If loading fails, the save/status label displays the error and receives the `error` class.

### Rendering Behavior

- `allTasks()` flattens the plan into `{ week, day, task }` objects.
- `updateSummary()` calculates complete count, remaining count, percent complete, deadline label, and progress bar width.
- `renderWeekFilter()` creates the `All weeks` option plus one option per plan week.
- `render()` clears and rebuilds the week/day/task markup from the current state.
- If no tasks match the filters, the app displays `No checklist items match these filters.`

Week cards show:

- `Week <number>`
- `<done> of <total> complete`
- `Toggle week` button

Day panels show:

- formatted date
- day completion count
- `Toggle day` button
- visible task checkboxes and note textareas

### Filters

Search:

- Updates on input.
- Searches only task titles.
- Converts the query to lowercase.

Week filter:

- `all` shows all weeks.
- A week number string shows only that week.

Status filter:

- `all`: all tasks.
- `open`: only incomplete tasks.
- `done`: only completed tasks.

### Task Updates

Checking or unchecking a task:

- Finds the task by `data-task`.
- Sets `completed` from checkbox state.
- Sets `completedAt` to the current ISO timestamp when completed, or `null` when reopened.
- Renders immediately.
- Queues an auto-save.

Editing notes:

- Finds the task by `data-notes`.
- Updates `task.notes`.
- Queues an auto-save without re-rendering the textarea.

Toggling a day or week:

- If any included task is incomplete, all included tasks are marked complete.
- If every included task is complete, all included tasks are reopened.
- `completedAt` is set to one shared current ISO timestamp for completed batch updates, or `null` when reopened.

### Saving Behavior

`queueSave()`:

- Sets status to `Unsaved`.
- Clears any existing save timer.
- Schedules `saveNow()` after 500 ms.

`saveNow()`:

- Clears the debounce timer.
- Sets status to `Saving`.
- Sends `PUT /api/checklist` with the full plan as JSON.
- On success, replaces local state with the server response.
- Sets status to `Saved <HH:MM>`.
- Re-renders the app.
- On failure, displays the error in the status label with the `error` class.

The Save button triggers `saveNow()` immediately.

### Date Formatting

Dates are formatted with `Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" })`. The code appends `T12:00:00` to each date string before constructing the `Date`, which avoids timezone edge cases around midnight for date-only values.

## UI and Styling

The app uses a dark theme with green, teal, and yellow progress accents.

CSS custom properties:

- `--bg`: `#090d12`
- `--bg-soft`: `#0f151d`
- `--ink`: `#eef5ef`
- `--muted`: `#91a09a`
- `--line`: `#24313c`
- `--panel`: `#111923`
- `--panel-strong`: `#172230`
- `--field`: `#0b1118`
- `--green`: `#46d58d`
- `--teal`: `#49c7d5`
- `--yellow`: `#f2c35d`
- `--danger`: `#ff8a78`
- `--shadow`: `0 18px 60px rgba(0, 0, 0, 0.28)`

Layout details:

- `.shell` is constrained to `min(1180px, calc(100% - 32px))`.
- `.topbar`, `.summary`, `.controls`, and `.day` use 8px rounded panels with borders and shadows.
- Summary uses a 4-column grid on desktop.
- Controls use `1fr 180px 150px` columns on desktop.
- Days use responsive `repeat(auto-fit, minmax(300px, 1fr))`.
- Under 760px, header/status/day controls stack vertically, summary and controls become two columns, and the search field spans both columns.

## PWA Details

The app registers `/sw.js` after window load if `navigator.serviceWorker` is available. Registration failures are intentionally ignored because the app can still work as a normal web shortcut.

### Manifest

`public/manifest.webmanifest` defines:

- `name`: `CCNA Progress`
- `short_name`: `CCNA`
- `description`: `Track progress through the Summer of CCNA study plan.`
- `start_url`: `/`
- `scope`: `/`
- `display`: `standalone`
- `background_color`: `#090d12`
- `theme_color`: `#111923`
- `orientation`: `portrait-primary`

Icons:

- `/icons/icon-192.png`, 192x192, purpose `any`
- `/icons/icon-512.png`, 512x512, purpose `any`
- `/icons/maskable-512.png`, 512x512, purpose `maskable`

### Service Worker

`public/sw.js` uses cache name `ccna-progress-v1`.

App shell cached on install:

- `/`
- `/index.html`
- `/styles.css`
- `/app.js`
- `/manifest.webmanifest`

Lifecycle behavior:

- Install opens the cache, adds the app shell, and calls `self.skipWaiting()`.
- Activate deletes all caches except `ccna-progress-v1` and calls `self.clients.claim()`.
- Fetch handler bypasses any URL whose path starts with `/api/`.
- Non-API requests use network-first behavior.
- Successful GET responses are copied into the cache.
- If the network fails, the service worker falls back to a matching cached request or `/`.

## Data Model

The checklist JSON has this shape:

```json
{
  "title": "Academy CCNA Study Plan",
  "source": "Summer of CCNA Study Plan.pdf",
  "startDate": "2026-05-04",
  "targetDeadline": "2026-08-28",
  "updatedAt": "2026-05-01T13:38:50.265Z",
  "weeks": [
    {
      "number": 1,
      "days": [
        {
          "date": "2026-05-04",
          "label": "Monday, May 4, 2026",
          "tasks": [
            {
              "id": "task-001",
              "title": "Skill 00 Lesson 00 - What is a Network?",
              "completed": false,
              "completedAt": null,
              "notes": ""
            }
          ]
        }
      ]
    }
  ]
}
```

Important data details:

- Task IDs are strings in the format `task-001`, `task-002`, and so on.
- The bundled checklist currently ends at `task-457`.
- Week numbers are integers.
- Dates are ISO date strings.
- Day labels are human-readable full dates.
- `completedAt` is `null` for incomplete tasks and an ISO timestamp for completed tasks.
- `notes` is a free-form string.

Bundled plan statistics:

- Title: `Academy CCNA Study Plan`
- Source: `Summer of CCNA Study Plan.pdf`
- Start date: `2026-05-04`
- Target deadline: `2026-08-28`
- Weeks: 17
- Scheduled days: 83
- Tasks: 457
- Completed tasks in default data: 0
- First task: `Skill 00 Lesson 00 - What is a Network?`
- Last task: `Skill 26 Lesson 05 - Quiz 1 questions`

## PDF Extraction Script

`scripts/extract_checklist.py` converts the source PDF into `data/checklist.json`.

It requires `pypdf`, which is not listed in `package.json` because the Node app itself has no dependencies.

Usage:

```bash
python scripts/extract_checklist.py "Summer of CCNA Study Plan.pdf" data/checklist.json
```

The script:

- Reads text from each PDF page with `PdfReader`.
- Cleans lines by normalizing en/em dashes to `-`.
- Fixes the extracted typo `APls` to `APIs`.
- Detects date headings like `Monday, May 4, 2026`.
- Detects week headings like `Week 1`.
- Ignores summary/noise lines such as `Scheduled Tasks`, `Learner Summary`, `Powered by NetworkChuck`, and count lines like `6 tasks | 6 due`.
- Starts tasks from lines beginning with `Skill`, `Practice`, `Final`, `Review`, `Exam`, `Bonus`, or `Course`.
- Appends continuation lines onto the previous task title.
- Generates task IDs sequentially.
- Initializes each task as incomplete with blank notes.
- Writes formatted JSON to the output path.
- Prints the number of tasks and weeks written.

## Deployment Context

The README describes an Ubuntu deployment that installs the app at:

```text
/opt/ccna-progress
```

Production progress data should live outside the app folder:

```text
/var/lib/ccna-progress/checklist.json
```

This prevents app updates from overwriting progress.

### systemd Service

`deploy/ccna-progress.service`:

- Description: `CCNA Progress Tracker`
- Runs after `network.target`.
- Working directory: `/opt/ccna-progress`
- Environment:
  - `NODE_ENV=production`
  - `HOST=127.0.0.1`
  - `PORT=8088`
  - `CCNA_DATA_FILE=/var/lib/ccna-progress/checklist.json`
- ExecStart: `/usr/bin/node /opt/ccna-progress/server.js`
- Restart policy: `always`
- Restart delay: 5 seconds
- User/group: `ccna-progress`
- Install target: `multi-user.target`

### nginx Config

`deploy/nginx.conf`:

- Listens on IPv4 and IPv6 port 80.
- Uses placeholder server name `ccna.example.com`.
- Proxies all requests to `http://127.0.0.1:8088`.
- Sets standard proxy headers:
  - `Host`
  - `X-Real-IP`
  - `X-Forwarded-For`
  - `X-Forwarded-Proto`

### HTTPS

The README recommends using Certbot with nginx after DNS points at the server:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d ccna.example.com
```

## Operational Notes

Back up this file in production:

```text
/var/lib/ccna-progress/checklist.json
```

Do not overwrite the production checklist file during redeploys unless intentionally resetting progress.

Health check:

```bash
curl http://127.0.0.1:8088/health
```

Expected response:

```json
{"ok":true}
```

Useful troubleshooting commands from the README:

```bash
sudo journalctl -u ccna-progress -f
sudo systemctl restart ccna-progress
curl http://127.0.0.1:8088/health
```

Common deployment checks:

- The `ccna-progress` service is running.
- Port `8088` is free locally.
- `/var/lib/ccna-progress/checklist.json` exists.
- The data file is owned by the `ccna-progress` user.
- nginx `server_name` matches the deployed domain.
- DNS points to the server before running Certbot.

## Current Git Snapshot

The latest commit at the time this context file was created was:

```text
7c52475 Adde Home Bae button in index.htrml
```

The working tree was clean before creating this file.

## Known Constraints and Risks

- There is no authentication. Anyone who can reach the app can read and write progress.
- There is no multi-user model; all users share the same JSON checklist file.
- Concurrent saves are last-write-wins.
- The API saves the full checklist document on every update.
- The backend returns raw error messages in JSON responses.
- Static responses are sent with `Cache-Control: no-store`, while the service worker performs its own cache behavior.
- The service worker cache name is manually versioned; update `CACHE_NAME` when changing app shell assets and needing a clean cache migration.
- The frontend renders task titles and notes through `innerHTML`, so user-entered notes could become an injection risk if untrusted users can write data.
- The server validates shape but does not sanitize text content.
- The static path safety check uses `startsWith(PUBLIC_DIR)` after normalization; this is intended to prevent traversal, but path-prefix checks should be reviewed carefully if the app is refactored.
- `HEAD` requests are handled through the same static path code and currently write a body like `GET`; Node will suppress or ignore the body depending on behavior, but there is no explicit HEAD-specific handling.
- The extraction script depends on `pypdf`, which must be installed separately when regenerating checklist data.

## Likely Future Improvements

- Add authentication or put the app behind trusted access control before exposing it publicly.
- Escape user-provided notes before rendering, or render notes by setting element values with DOM APIs instead of `innerHTML`.
- Add optimistic save conflict protection if multiple devices will edit progress at once.
- Add export/import backup controls in the UI.
- Add tests for checklist validation, API routes, and frontend task mutations.
- Add explicit cache-busting or service worker versioning guidance for deploys.
- Consider separating immutable study-plan data from mutable progress data.
- Add a small admin reset or restore workflow for the JSON data file.
