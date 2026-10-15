// learn67 — בדיקת עשן בדפדפן אמיתי (Playwright).
// תופסת את הבאג מ־15.10.2026: נושא שלא נפתח (renderTopic קרס)
// ומוודאת שכל נושא לחיץ, מציג 10 שאלות עם ווידג׳ט מענה,
// ושתשובה נכונה / שלוש טעויות מסמנות סטטוס אוטומטית.
// הרצה מקומית: npm run test:e2e  (דורש: npx playwright install chromium)
const { test, expect } = require("@playwright/test");

async function register(page) {
  await page.goto("/");
  await page.fill("#childName", "בדיקה");
  await page.click("#setupGo");
  await expect(page.locator("#view-home.active")).toBeVisible();
}

async function openSubject(page) {
  await page.locator("#testsBoard .card.test").first().click();
  await expect(page.locator("#view-subject.active")).toBeVisible();
}

async function openTopic(page, index) {
  await page.locator("#subjectBody .card.tap").nth(index).click();
  await expect(page.locator("#view-topic.active")).toBeVisible();
  await expect(page.locator("#topicBody .qcard")).toHaveCount(10);
}

test("every topic opens with 10 questions and answer widgets", async ({ page }) => {
  await register(page);
  await openSubject(page);
  await expect(page.locator("#subjectBody .card.tap")).toHaveCount(5);
  for (let i = 0; i < 5; i++) {
    await openTopic(page, i);
    // לכל שאלה יש ווידג׳ט מענה (שדה / כפתורי השוואה / הערת הורה)
    const cards = page.locator("#topicBody .qcard");
    for (let j = 0; j < 10; j++) {
      await expect(cards.nth(j).locator(".ansfield, .cmpbtn, .parentonly-note").first()).toBeVisible();
    }
    await page.locator('[data-back="subject"]').click();
    await expect(page.locator("#view-subject.active")).toBeVisible();
  }
});

test("correct answer marks the question correct", async ({ page }) => {
  await register(page);
  await openSubject(page);
  await openTopic(page, 2); // ישר המספרים — שאלה 7 (אינדקס 6): 250
  const card = page.locator("#topicBody .qcard").nth(6);
  await card.locator(".ansfield").click();
  for (const d of "250") {
    await page.locator("#numpad .np-key", { hasText: d }).click();
  }
  await card.getByRole("button", { name: /בדוק/ }).click();
  await expect(card.locator(".badge.green")).toBeVisible();
});

test("three wrong attempts auto-mark needs-review", async ({ page }) => {
  await register(page);
  await openSubject(page);
  await openTopic(page, 2); // ישר המספרים — שאלה 7 (אינדקס 6): 250
  const card = page.locator("#topicBody .qcard").nth(6);
  for (let attempt = 0; attempt < 3; attempt++) {
    await card.locator(".ansfield").click();
    for (let i = 0; i < 5; i++) {
      await page.locator("#numpad .np-key", { hasText: "⌫" }).click();
    }
    for (const d of "999") {
      await page.locator("#numpad .np-key", { hasText: d }).click();
    }
    await card.getByRole("button", { name: /בדוק/ }).click();
  }
  await expect(card.locator(".badge.yellow")).toBeVisible();
});
