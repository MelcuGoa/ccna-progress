const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_FILE = process.env.CCNA_DATA_FILE || path.join(ROOT, "data", "checklist.json");
const PORT = Number(process.env.PORT || 8088);
const HOST = process.env.HOST || "127.0.0.1";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(body);
}

function json(res, status, value) {
  send(res, status, JSON.stringify(value), {
    "Content-Type": "application/json; charset=utf-8",
  });
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2_000_000) {
      throw new Error("Request body is too large");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

function validatePlan(plan) {
  if (!plan || typeof plan !== "object" || !Array.isArray(plan.weeks)) {
    throw new Error("Checklist must contain a weeks array");
  }

  for (const week of plan.weeks) {
    if (!Number.isInteger(week.number) || !Array.isArray(week.days)) {
      throw new Error("Every week must have a number and days array");
    }
    for (const day of week.days) {
      if (typeof day.date !== "string" || !Array.isArray(day.tasks)) {
        throw new Error("Every day must have a date and tasks array");
      }
      for (const task of day.tasks) {
        if (typeof task.id !== "string" || typeof task.title !== "string") {
          throw new Error("Every task must have an id and title");
        }
        task.completed = Boolean(task.completed);
        task.completedAt = task.completedAt || null;
        task.notes = typeof task.notes === "string" ? task.notes : "";
      }
    }
  }

  plan.updatedAt = new Date().toISOString();
  return plan;
}

async function readChecklist() {
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  return JSON.parse(raw);
}

async function writeChecklist(plan) {
  const validPlan = validatePlan(plan);
  const dir = path.dirname(DATA_FILE);
  const tempFile = path.join(dir, `.checklist.${crypto.randomUUID()}.tmp`);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(tempFile, `${JSON.stringify(validPlan, null, 2)}\n`, "utf-8");
  await fs.rename(tempFile, DATA_FILE);
  return validPlan;
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    send(res, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    send(res, 200, data, {
      "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
    });
  } catch {
    send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/health") {
      json(res, 200, { ok: true });
      return;
    }

    if (req.url === "/api/checklist" && req.method === "GET") {
      json(res, 200, await readChecklist());
      return;
    }

    if (req.url === "/api/checklist" && req.method === "PUT") {
      const body = await readBody(req);
      const plan = await writeChecklist(JSON.parse(body));
      json(res, 200, plan);
      return;
    }

    if (req.method === "GET" || req.method === "HEAD") {
      await serveStatic(req, res);
      return;
    }

    json(res, 405, { error: "Method not allowed" });
  } catch (error) {
    json(res, 500, { error: error.message || "Unexpected server error" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`CCNA progress tracker listening on http://${HOST}:${PORT}`);
});
