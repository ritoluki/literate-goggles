import assert from 'node:assert/strict'
import { existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright-core'

/* global document, getComputedStyle */
const chromePath = process.env.LOCAL_CHROME_PATH ??
  'C:/Program Files/Google/Chrome/Application/chrome.exe'
if (!existsSync(chromePath)) throw new Error('Local Chrome unavailable; set LOCAL_CHROME_PATH')

const artifactDir = resolve('state/artifacts')
mkdirSync(artifactDir, { recursive: true })
const browser = await chromium.launch({ executablePath: chromePath, headless: true })
try {
  for (const width of [360, 390, 768, 1280, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    const page = await context.newPage()
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' })
    await page.waitForSelector('.site-header[data-hydrated="true"]')
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important }' })
    const metrics = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      contentWidth: document.documentElement.scrollWidth,
    }))
    assert.equal(metrics.width, width, 'Unexpected browser viewport at ' + width)
    assert(metrics.contentWidth <= width, 'Horizontal overflow at ' + width +
      ': document width ' + metrics.contentWidth)
    if (width === 390) {
      const button = page.getByRole('button', { name: 'Mở menu' })
      await button.click()
      const dialog = page.locator('dialog.mobile-drawer')
      assert(await dialog.isVisible(), 'Mobile navigation dialog did not open: ' +
        JSON.stringify(await dialog.evaluate((element) => ({
          open: element.open,
          display: getComputedStyle(element).display,
          rect: element.getBoundingClientRect().toJSON(),
        }))))
      assert.equal(await dialog.getAttribute('aria-label'), 'Menu điều hướng')
      const closeButton = page.getByRole('button', { name: 'Đóng menu' })
      await closeButton.focus()
      await page.keyboard.press('Tab')
      assert(await dialog.evaluate((element) => element.contains(document.activeElement)),
        'Focus escaped the modal dialog')
      await page.keyboard.press('Escape')
      assert(!await dialog.isVisible(), 'Escape did not close the mobile navigation dialog')
      assert(await button.evaluate((element) => document.activeElement === element),
        'Menu focus did not return to trigger')
      await page.screenshot({ path: resolve(artifactDir, 't015-mobile.png'), fullPage: true })
    }
    if (width === 1280) {
      const summary = page.locator('.nav-disclosure summary')
      await summary.click()
      assert(await page.locator('.nav-disclosure').evaluate((element) => element.open))
      await page.keyboard.press('Escape')
      assert(!await page.locator('.nav-disclosure').evaluate((element) => element.open))
      assert(await summary.evaluate((element) => document.activeElement === element),
        'Category focus did not return to trigger')
      await page.screenshot({ path: resolve(artifactDir, 't015-desktop.png'), fullPage: true })
    }
    await context.close()
  }
  console.log('PASS layout: 360/390/768/1280/1440 no overflow; mobile dialog and desktop categories close with Escape/focus restore')
} finally {
  await browser.close()
}
