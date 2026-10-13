// POST /api/event — רישום אירוע שימוש (register / visit / mock)
// כל אירוע נשמר כ-blob נפרד; הפרטים מקודדים בשם הקובץ כדי שלא נצטרך לקרוא תוכן.
// events/<deviceId>/<child>.<type>.<timestamp>.<rand>.json
// בלי תלויות npm — קריאות REST ישירות ל-Vercel Blob.

const BLOB_API = "https://vercel.com/api/blob";
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ ok: false });
  if (!TOKEN) return res.status(500).json({ ok: false, error: "no token" });
  try {
    const body = req.body || {};
    const deviceId = String(body.deviceId || "");
    if (!/^[A-Za-z0-9-]{8,64}$/.test(deviceId)) return res.status(400).json({ ok: false });
    const child = String(body.child || "").slice(0, 30).replace(/\./g, "");
    const type = String(body.type || "");
    if (!["register", "visit", "mock"].includes(type)) return res.status(400).json({ ok: false });

    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const rand = Math.random().toString(36).slice(2, 8);
    const childEnc = encodeURIComponent(child || "x");
    const pathname = "events/" + deviceId + "/" + childEnc + "." + type + "." + ts + "." + rand + ".json";

    const r = await fetch(BLOB_API + "/?pathname=" + encodeURIComponent(pathname), {
      method: "PUT",
      headers: {
        authorization: "Bearer " + TOKEN,
        "x-api-version": "11",
        "x-add-random-suffix": "0",
        "x-allow-overwrite": "1",
        "x-vercel-blob-access": "private",
        "content-type": "application/json",
        "x-content-type": "application/json",
      },
      body: JSON.stringify({ v: 1 }),
    });
    if (!r.ok) throw new Error("blob put failed: " + r.status);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false });
  }
};
