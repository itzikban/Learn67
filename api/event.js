// POST /api/event — רישום אירוע שימוש (register / visit / mock)
// שומר רשומה אחת למכשיר ב-Blob: devices/<deviceId>.json
// בלי תלויות npm — קריאות REST ישירות ל-Vercel Blob.

const BLOB_API = "https://vercel.com/api/blob";
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

function headers() {
  return { authorization: "Bearer " + TOKEN, "x-api-version": "11" };
}

// קריאה הגנתית: מחזיר את תוכן ה-JSON, או null אם לא קיים.
// אם ה-GET מחזיר מטא-דאטה עם url — עוקב אחריו.
async function readJson(pathname) {
  const r = await fetch(BLOB_API + "/?pathname=" + encodeURIComponent(pathname), { headers: headers() });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("blob read failed: " + r.status);
  const j = await r.json().catch(() => null);
  if (j && typeof j === "object" && j.url && !("child" in j) && !("visits" in j)) {
    const d = await fetch(j.url);
    if (!d.ok) throw new Error("blob download failed: " + d.status);
    return await d.json().catch(() => null);
  }
  return j;
}

async function writeJson(pathname, obj) {
  const r = await fetch(BLOB_API + "/?pathname=" + encodeURIComponent(pathname), {
    method: "PUT",
    headers: Object.assign(headers(), {
      "x-add-random-suffix": "0",
      "x-allow-overwrite": "1",
      "x-access": "private",
      "content-type": "application/json",
      "x-content-type": "application/json",
    }),
    body: JSON.stringify(obj),
  });
  if (!r.ok) throw new Error("blob write failed: " + r.status);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ ok: false });
  if (!TOKEN) return res.status(500).json({ ok: false, error: "no token" });
  try {
    const body = req.body || {};
    const deviceId = String(body.deviceId || "");
    if (!/^[A-Za-z0-9-]{8,64}$/.test(deviceId)) return res.status(400).json({ ok: false });
    const child = String(body.child || "").slice(0, 30);
    const type = String(body.type || "");
    if (!["register", "visit", "mock"].includes(type)) return res.status(400).json({ ok: false });

    const pathname = "devices/" + deviceId + ".json";
    const now = new Date().toISOString();
    let rec = await readJson(pathname);
    if (!rec || typeof rec !== "object") {
      rec = { child: child, firstSeen: now, visits: 0, mocks: 0 };
    }
    if (child) rec.child = child;
    rec.lastSeen = now;
    if (type === "visit") rec.visits = (rec.visits || 0) + 1;
    if (type === "mock") rec.mocks = (rec.mocks || 0) + 1;
    await writeJson(pathname, rec);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false });
  }
};
