// GET /api/audit?key=... — מסך מעקב שימוש לאור.
// מוגן במפתח ניהול (AUDIT_KEY). סופר אירועים משמות הקבצים — בלי לקרוא תוכן.
// שם קובץ: events/<deviceId>/<childEnc>.<type>.<ts>.<rand>.json
// כאשר ts הוא ISO-UTC שבו : ו-. הוחלפו ב-, למשל: 2026-10-13T20-38-00-123Z

const BLOB_API = "https://vercel.com/api/blob";
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

function headers() {
  return { authorization: "Bearer " + TOKEN, "x-api-version": "11" };
}

const dtfDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit",
});
const dtfDateTime = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hour12: false,
});
function fmtDate(ms) { return dtfDate.format(new Date(ms)); } // 2026-10-13
function fmtDateTime(ms) { return dtfDateTime.format(new Date(ms)).replace(", ", " "); } // 2026-10-13 23:38

function parseTs(tsRaw) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/.exec(tsRaw || "");
  if (!m) return 0;
  return Date.parse(m[1] + "-" + m[2] + "-" + m[3] + "T" + m[4] + ":" + m[5] + ":" + m[6] + "." + m[7] + "Z") || 0;
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
        const m = /^events\/([^/]+)\/([^.]*)\.(register|visit|mock)\.([^.]+)\.[^.]+\.json$/.exec(b.pathname || "");
        if (!m) continue;
        const deviceId = m[1];
        let child = "—";
        try { child = decodeURIComponent(m[2]); } catch (e) {}
        const type = m[3];
        const epoch = parseTs(m[4]);
        const rec = byDevice[deviceId] || (byDevice[deviceId] = {
          child: child, firstSeen: 0, lastSeen: 0, visits: 0, mocks: 0, days: {},
        });
        if (child && child !== "x") rec.child = child;
        if (epoch) {
          if (!rec.firstSeen || epoch < rec.firstSeen) rec.firstSeen = epoch;
          if (!rec.lastSeen || epoch > rec.lastSeen) rec.lastSeen = epoch;
          rec.days[fmtDate(epoch)] = 1;
        }
        if (type === "visit") rec.visits++;
        if (type === "mock") rec.mocks++;
      }
      cursor = j.cursor || null;
      if (!cursor || j.hasMore === false) break;
    }
    const devices = Object.values(byDevice).map((d) => ({
      child: d.child,
      firstSeen: d.firstSeen ? fmtDate(d.firstSeen) : "",
      lastSeen: d.lastSeen ? fmtDateTime(d.lastSeen) : "",
      visits: d.visits,
      mocks: d.mocks,
      activeDays: Object.keys(d.days).length,
    }));
    devices.sort((a, b) => String(b.lastSeen).localeCompare(String(a.lastSeen)));
    return res.status(200).json({ ok: true, count: devices.length, devices });
  } catch (e) {
    return res.status(500).json({ ok: false });
  }
};
