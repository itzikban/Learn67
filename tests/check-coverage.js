"use strict";
/* ============================================================
   learn67 — בדיקה סטטית (בלי דפדפן): חוזה הנתונים של השאלות
   + עקביות המטא־דאטה של בדיקת התשובות (CHECK).

   תופס את מחלקת הבאג מ־15.10.2026: הרנדרר קרא meta.fields
   לשאלות מילוליות, שהמטא־דאטה שלהן שומר finals — renderTopic
   זרק TypeError ושני הנושאים האחרונים נראו "לא לחיצים".
   לכן הבדיקה מקודדת את מיפוי מקור־השדות של הרנדרר ומוודאת
   שלכל סוג קיים בדיוק השדה שהרנדרר קורא.

   הרצה: node tests/check-coverage.js   (יוצא 1 אם יש כשל)
   ============================================================ */
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) { console.error("FAIL: no <script> block in index.html"); process.exit(1); }
const script = scriptMatch[1];

// חילוץ ערך JS (מערך/אובייקט) לפי שם הקבוע — סריקה עם ספירת סוגריים,
// מודעת למחרוזות (' " `) ול־escape.
function extractConst(src, name) {
  const start = src.indexOf(`const ${name} =`);
  if (start < 0) throw new Error(`const ${name} not found`);
  let i = src.indexOf("=", start) + 1;
  while (/\s/.test(src[i])) i++;
  const open = src[i];
  const close = open === "[" ? "]" : open === "{" ? "}" : null;
  if (!close) throw new Error(`unexpected literal for ${name}`);
  let depth = 0, quote = null, esc = false;
  for (let j = i; j < src.length; j++) {
    const ch = src[j];
    if (quote) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return new Function("return (" + src.slice(i, j + 1) + ")")();
    }
  }
  throw new Error(`unterminated literal for ${name}`);
}

const TOPICS = extractConst(script, "TOPICS");
const CHECK = extractConst(script, "CHECK");
const V = extractConst(script, "V");

const errors = [];
const fail = (msg) => errors.push(msg);

// מיפוי מקור־השדות שהרנדרר (buildFields) קורא לכל סוג — חייב להתאים לקוד!
const FIELD_SOURCE = {
  num: "fields", multi: "fields", numparent: "fields", text: "fields",
  word: "finals",
  expr: "fields", exprnum: "expr+nums",
  multiok: "nfields", mixed: "fields",
  cmp: "items", choice: "options", parent: null,
};
const PQ_KINDS = new Set(["method", "solution", "drawing", "explain"]);
const PARENT_KINDS = new Set(["drawing", "explain"]);

// 1. חוזה נתונים: כל שאלה זוג [שאלה, תשובה לא־ריקה]
let qCount = 0;
const questionKeys = new Set();
for (const t of TOPICS) {
  if (!Array.isArray(t.questions)) { fail(`topic ${t.id}: questions is not an array`); continue; }
  t.questions.forEach((qa, qi) => {
    qCount++;
    questionKeys.add(`${t.id}-${qi}`);
    if (!Array.isArray(qa) || qa.length !== 2) fail(`${t.id}-${qi}: question is not a [q, a] pair`);
    else if (!qa[1] || !String(qa[1]).trim()) fail(`${t.id}-${qi}: empty answer (data contract)`);
  });
}

// 2. כיסוי CHECK: כל שאלה ממופה, בלי יתומים
for (const k of questionKeys) {
  if (!CHECK[k]) fail(`${k}: missing CHECK entry`);
}
for (const k of Object.keys(CHECK)) {
  if (!questionKeys.has(k)) fail(`${k}: CHECK entry with no such question (orphan)`);
}

// 3. עקביות לכל רשומת CHECK
for (const [key, meta] of Object.entries(CHECK)) {
  const tag = `CHECK ${key}`;
  if (!meta || typeof meta !== "object") { fail(`${tag}: not an object`); continue; }
  if (!(meta.type in FIELD_SOURCE)) { fail(`${tag}: unknown type "${meta.type}"`); continue; }
  const src = FIELD_SOURCE[meta.type];

  // השדה שהרנדרר קורא חייב להתקיים — זה הבאג של 15.10
  if (src === "fields" || src === "finals") {
    const arr = meta[src];
    if (!Array.isArray(arr) || !arr.length) fail(`${tag}: ${src} missing/empty for type ${meta.type}`);
    else if (meta.type !== "expr" && arr.some((v) => v == null || String(v).trim() === "")) fail(`${tag}: empty value in ${src}`);
    if (meta.type === "expr" && arr.some((v) => !String(v).includes("="))) fail(`${tag}: expr field without "=": ${arr}`);
    if (meta.flabels && meta.flabels.length !== arr.length) fail(`${tag}: flabels length ${meta.flabels.length} != ${src} length ${arr.length}`);
  }
  if (src === "expr+nums") {
    if (!Array.isArray(meta.expr) || !meta.expr.length || meta.expr.some((v) => !String(v).includes("="))) fail(`${tag}: expr missing/invalid`);
    if (!Array.isArray(meta.nums) || !meta.nums.length || meta.nums.some((v) => v == null || String(v).trim() === "")) fail(`${tag}: nums missing/empty`);
  }
  if (src === "nfields") {
    if (!Number.isInteger(meta.nfields) || meta.nfields <= 0) fail(`${tag}: nfields invalid`);
    if (!(meta.v in V)) fail(`${tag}: validator "${meta.v}" not found in V`);
    if (meta.flabels && meta.flabels.length !== meta.nfields) fail(`${tag}: flabels length ${meta.flabels.length} != nfields ${meta.nfields}`);
  }
  if (src === "items") {
    if (!Array.isArray(meta.items) || !meta.items.length || meta.items.some((v) => !["<", "=", ">"].includes(v))) fail(`${tag}: items must be <, =, >`);
    if (meta.flabels) fail(`${tag}: flabels unused for cmp`);
  }
  if (src === "options") {
    if (!Array.isArray(meta.options) || meta.options.length < 2) fail(`${tag}: options need >= 2`);
    if (!Number.isInteger(meta.answer) || meta.answer < 0 || meta.answer >= meta.options.length) fail(`${tag}: answer index out of range`);
    if (meta.flabels) fail(`${tag}: flabels unused for choice`);
  }
  if (meta.type === "parent") {
    if (!PARENT_KINDS.has(meta.kind)) fail(`${tag}: parent kind must be drawing|explain, got "${meta.kind}"`);
    if (meta.hint != null) fail(`${tag}: parent-only questions must not carry a hint`);
    if (meta.flabels) fail(`${tag}: flabels unused for parent`);
  } else {
    if (!meta.hint || !String(meta.hint).trim()) fail(`${tag}: missing hint for auto-checked type ${meta.type}`);
  }
  if (meta.pq != null && !PQ_KINDS.has(meta.pq)) fail(`${tag}: unknown pq kind "${meta.pq}"`);
  if (meta.type === "mixed" && (!Array.isArray(meta.options) || !Number.isInteger(meta.answer))) fail(`${tag}: mixed needs options + answer`);
}

console.log(`checked ${qCount} questions, ${Object.keys(CHECK).length} CHECK entries, ${Object.keys(V).length} validators`);
if (errors.length) {
  console.log(`FAIL: ${errors.length} problem(s):`);
  errors.forEach((e) => console.log(" - " + e));
  process.exit(1);
}
console.log("OK: data contract + CHECK metadata consistent");
