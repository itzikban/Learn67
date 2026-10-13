// GET /api/audit?key=... — מסך מעקב שימוש לאור.
// מוגן במפתח ניהול (AUDIT_KEY). מחזיר את כל רשומות המכשירים.

const BLOB_API = "https://vercel.com/api/blob";
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

function headers() {
  return { authorization: "Bearer " + TOKEN, "x-api-version": "11" };
}

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

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ ok: false });
  const key = (req.query && req.query.key) || req.headers["x-audit-key"] || "";
  if (!process.env.AUDIT_KEY || key !== process.env.AUDIT_KEY) {
    return res.status(403).json({ ok: false });
  }
  if (!TOKEN) return res.status(500).json({ ok: false, error: "no token" });
  try {
    // רשימת כל הבלובים תחת devices/
    const devices = [];
    let cursor = null;
    for (let page = 0; page < 10; page++) {
      const params = new URLSearchParams({ prefix: "devices/", limit: "100" });
      if (cursor) params.set("cursor", cursor);
      const r = await fetch(BLOB_API + "/?" + params.toString(), { headers: headers() });
      if (!r.ok) throw new Error("blob list failed: " + r.status);
      const j = await r.json();
      const blobs = j.blobs || j.files || [];
      for (const b of blobs) {
        const pathname = b.pathname || (b.url ? new URL(b.url).pathname.slice(1) : null);
        if (!pathname) continue;
        try {
          const rec = await readJson(pathname);
          if (rec && typeof rec === "object") devices.push(rec);
        } catch (e) { /* דלג על רשומה פגומה */ }
      }
      cursor = j.cursor || null;
      if (!cursor || j.hasMore === false) break;
    }
    devices.sort((a, b) => String(b.lastSeen || "").localeCompare(String(a.lastSeen || "")));
    return res.status(200).json({ ok: true, count: devices.length, devices });
  } catch (e) {
    return res.status(500).json({ ok: false });
  }
};
