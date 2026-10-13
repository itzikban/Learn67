// GET /api/audit?key=... — מסך מעקב שימוש לאור.
// מוגן במפתח ניהול (AUDIT_KEY). סופר אירועים משמות הקבצים — בלי לקרוא תוכן.

const BLOB_API = "https://vercel.com/api/blob";
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

function headers() {
  return { authorization: "Bearer " + TOKEN, "x-api-version": "11" };
}

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ ok: false });
  const key = (req.query && req.query.key) || req.headers["x-audit-key"] || "";
  if (!process.env.AUDIT_KEY || key !== process.env.AUDIT_KEY) {
    return res.status(403).json({ ok: false });
  }
  if (!TOKEN) return res.status(500).json({ ok: false, error: "no token" });
  try {
    const byDevice = {};
    let cursor = null;
    for (let page = 0; page < 20; page++) {
      const params = new URLSearchParams({ prefix: "events/", limit: "500" });
      if (cursor) params.set("cursor", cursor);
      const r = await fetch(BLOB_API + "/?" + params.toString(), { headers: headers() });
      if (!r.ok) throw new Error("blob list failed: " + r.status);
      const j = await r.json();
      const blobs = j.blobs || [];
      for (const b of blobs) {
        // events/<deviceId>/<childEnc>.<type>.<ts>.<rand>.json
        const m = /^events\/([^/]+)\/([^.]*)\.(register|visit|mock)\.([^.]+)\.[^.]+\.json$/.exec(b.pathname || "");
        if (!m) continue;
        const deviceId = m[1];
        let child = "—";
        try { child = decodeURIComponent(m[2]); } catch (e) {}
        const type = m[3];
        const datePart = m[4].slice(0, 10); // YYYY-MM-DD
        const rec = byDevice[deviceId] || (byDevice[deviceId] = {
          child: child, firstSeen: null, lastSeen: null, visits: 0, mocks: 0,
        });
        if (child && child !== "x") rec.child = child;
        if (!rec.firstSeen || datePart < rec.firstSeen) rec.firstSeen = datePart;
        if (!rec.lastSeen || datePart > rec.lastSeen) rec.lastSeen = datePart;
        if (type === "visit") rec.visits++;
        if (type === "mock") rec.mocks++;
      }
      cursor = j.cursor || null;
      if (!cursor || j.hasMore === false) break;
    }
    const devices = Object.values(byDevice).map((d) => ({
      child: d.child,
      firstSeen: (d.firstSeen || "").slice(0, 10),
      lastSeen: (d.lastSeen || "").slice(0, 10),
      visits: d.visits,
      mocks: d.mocks,
    }));
    devices.sort((a, b) => String(b.lastSeen).localeCompare(String(a.lastSeen)));
    return res.status(200).json({ ok: true, count: devices.length, devices });
  } catch (e) {
    return res.status(500).json({ ok: false });
  }
};
