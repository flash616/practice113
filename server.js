/**
 * Guess or Splash — Node local server (static files + Gemini word API)
 * Usage: npm start
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;

function loadEnv(filePath) {
  const map = {};
  if (!fs.existsSync(filePath)) return map;
  const text = fs.readFileSync(filePath, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 1) continue;
    const name = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    map[name] = value;
  }
  return map;
}

const env = loadEnv(path.join(ROOT, ".env"));
const GEMINI_KEY = env.GEMINI_API_KEY || env.GOOGLE_API_KEY || env.API_KEY || process.env.GEMINI_API_KEY || "";
const WORD_ORB_KEY = env.WORD_ORB_KEY || env.WORDORB_API_KEY || process.env.WORD_ORB_KEY || "";

const SEED_WORDS = [
  "deadline", "interview", "schedule", "customer", "budget", "contract", "employee",
  "invoice", "refund", "shipment", "warranty", "brochure", "conference", "reservation",
  "applicant", "negotiate", "efficient", "postpone", "inventory", "colleague",
  "passenger", "advertise", "manufacture", "competent", "temporary", "acknowledge",
  "substantial", "accommodate", "commodity", "courage", "ambition", "decision",
  "evidence", "proposal", "benefit", "manager", "product", "service", "quality",
  "payment", "delivery", "purchase", "receipt", "discount", "agreement", "strategy",
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function fetchWordOrbWordList(count) {
  // Word Orb is used ONLY to confirm/select headwords. No descriptions.
  const picked = shuffle(SEED_WORDS).slice(0, Math.min(count + 20, SEED_WORDS.length));
  const words = [];

  for (const candidate of picked) {
    if (words.length >= count) break;
    const resp = await fetch(`https://wordorb.ai/api/word/${candidate}`, {
      headers: { Authorization: `Bearer ${WORD_ORB_KEY}` },
    });
    if (!resp.ok) continue;
    const data = await resp.json();
    const word = String(data.word || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z]/g, "");
    if (word.length >= 4 && !words.includes(word)) words.push(word);
  }

  if (!words.length) throw new Error("Word Orb returned no usable words");
  return words;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function serveStatic(req, res, pathname) {
  let rel = pathname === "/" ? "/index.html" : pathname;
  rel = decodeURIComponent(rel).replace(/^\/+/, "");
  const filePath = path.normalize(path.join(ROOT, rel));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404).end("Not found");
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const data = fs.readFileSync(filePath);
  res.writeHead(200, {
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  res.end(data);
}

async function invokeGeminiJson(prompt) {
  const models = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.8-flash"];
  let lastError = "Gemini request failed";

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.9,
              responseMimeType: "application/json",
            },
          }),
        });
        if (!resp.ok) {
          const errText = await resp.text();
          lastError = `Gemini(${model}) HTTP ${resp.status}: ${errText.slice(0, 200)}`;
          await new Promise((r) => setTimeout(r, 1000 * attempt));
          continue;
        }
        const data = await resp.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Empty Gemini response");
        return JSON.parse(text);
      } catch (err) {
        lastError = `Gemini(${model}) ${err.message || err}`;
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }
  throw new Error(lastError);
}

function parseGeminiItems(parsed, expectedWords) {
  const items = [];
  for (const item of parsed) {
    const word = String(item.word || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z]/g, "");
    const c1 = String(item.clues?.[0] || "").trim();
    const c2 = String(item.clues?.[1] || "").trim();
    const meaning = String(item.meaning || "").trim();
    if (word.length >= 4 && c1 && c2 && meaning) {
      if (expectedWords && !expectedWords.includes(word)) continue;
      items.push({ word, clues: [c1, c2], meaning });
    }
  }
  if (!items.length) throw new Error("No valid words parsed from Gemini");
  return items;
}

async function fetchGeminiWords(count, seedWords = []) {
  if (seedWords.length) {
    const list = seedWords.slice(0, count).join(", ");
    const prompt = `You are writing TOEIC-level English vocabulary quiz items for a guessing game.
Use EXACTLY these words (do not replace them): ${list}
Return ONLY valid JSON (no markdown) as an array with one object per word.
Each object must have:
- "word": the given English word (lowercase letters only)
- "clues": array of exactly 2 short English sentences that describe the word WITHOUT using the word itself
- "meaning": Korean meaning of the word (short)`;
    const parsed = await invokeGeminiJson(prompt);
    return parseGeminiItems(parsed, seedWords);
  }

  const prompt = `You are generating TOEIC-level English vocabulary quiz items for a guessing game.
Return ONLY valid JSON (no markdown) as an array of exactly ${count} objects.
Each object must have:
- "word": one English word (letters only, lowercase, 5 to 12 letters)
- "clues": array of exactly 2 short English sentences that describe the word WITHOUT using the word itself
- "meaning": Korean meaning of the word (short)

Make words useful for university students preparing for TOEIC.
Avoid duplicates. Avoid proper nouns.`;
  const parsed = await invokeGeminiJson(prompt);
  return parseGeminiItems(parsed, null);
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const pathname = u.pathname;

    if (pathname === "/api/health") {
      sendJson(res, 200, {
        ok: true,
        wordorb: Boolean(WORD_ORB_KEY),
        gemini: Boolean(GEMINI_KEY),
      });
      return;
    }

    if (pathname === "/api/words") {
      const count = Math.max(3, Math.min(12, Number(u.searchParams.get("count")) || 8));

      if (!GEMINI_KEY) {
        sendJson(res, 503, {
          error: "GEMINI_API_KEY missing in .env (required for clues/meanings)",
        });
        return;
      }

      const errors = [];
      let seedWords = [];
      let source = "gemini";

      if (WORD_ORB_KEY) {
        try {
          seedWords = await fetchWordOrbWordList(count);
        } catch (err) {
          errors.push(err.message || String(err));
        }
      }

      try {
        const words = seedWords.length
          ? await fetchGeminiWords(count, seedWords)
          : await fetchGeminiWords(count);
        source = seedWords.length ? "gemini+wordorb" : "gemini";
        sendJson(res, 200, { source, words });
      } catch (err) {
        errors.push(err.message || String(err));
        sendJson(res, 502, { error: errors.join(" | ") });
      }
      return;
    }

    serveStatic(req, res, pathname);
  } catch (err) {
    sendJson(res, 500, { error: err.message || String(err) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Guess or Splash server: http://127.0.0.1:${PORT}/`);
  console.log(WORD_ORB_KEY ? "Word Orb API key: loaded from .env" : "Word Orb API key: NOT FOUND");
  console.log(GEMINI_KEY ? "Gemini API key: loaded from .env" : "Gemini API key: NOT FOUND");
});
