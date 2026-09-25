import assert from 'node:assert/strict'
import { existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright-core'

/* global document, getComputedStyle, location, URLSearchParams */
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
    await page.waitForFunction(() => document.querySelectorAll('.section .product-card-link').length === 8)
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

      await page.goto('http://localhost:3000/san-pham', { waitUntil: 'networkidle' })
      await page.waitForFunction(() => document.querySelectorAll('.product-card-link').length === 12)
      assert((await page.locator('.catalog-count').innerText()).includes('20 sản phẩm'))
      await page.getByRole('button', { name: 'Trang sau' }).click()
      await page.waitForURL(/page=2/)
      await page.waitForFunction(() => document.querySelectorAll('.product-card-link').length === 8)
      await page.goBack()
      await page.waitForFunction(() => document.querySelectorAll('.product-card-link').length === 12)

      const search = page.getByRole('searchbox', { name: 'Tìm sản phẩm' })
      await search.fill('Ống bọc')
      await page.keyboard.press('Enter')
      await page.waitForURL(/q=/)
      await page.waitForFunction(() => document.querySelectorAll('.product-card-link').length === 1)
      assert((await page.locator('.product-card-link h3').innerText()).includes('Ống bọc'))
      await search.fill('')
      await page.waitForFunction(() => !new URLSearchParams(location.search).has('q'))

      await page.locator('.catalog-filters > summary').click()
      await page.locator('.filter-form select[name="category"]').selectOption('desk-mat')
      await page.locator('.filter-form select[name="color"]').selectOption('green')
      await page.locator('.filter-form input[name="minPriceVnd"]').fill('150000')
      await page.locator('.filter-form input[name="maxPriceVnd"]').fill('160000')
      await page.locator('.filter-form input[name="inStock"]').check()
      await page.getByRole('button', { name: 'Áp dụng bộ lọc' }).click()
      await page.waitForURL(/maxPriceVnd=160000/)
      await page.waitForFunction(() => document.querySelectorAll('.product-card-link').length === 1)
      assert((await page.locator('.product-card-link h3').innerText()).includes('Thảm bàn Gọn'))
      assert.equal(await page.locator('.active-filters button').count(), 5)

      await page.goto('http://localhost:3000/san-pham', { waitUntil: 'networkidle' })
      await page.waitForFunction(() => document.querySelectorAll('.product-card-link').length === 12)
      await page.locator('.catalog-filters > summary').click()
      await page.locator('.filter-form select[name="category"]').selectOption('laptop-stand')
      await page.getByRole('button', { name: 'Áp dụng bộ lọc' }).click()
      await page.waitForURL(/category=laptop-stand/)
      await page.waitForFunction(() => document.querySelectorAll('.product-card-link').length > 0)
      assert((await page.locator('.catalog-count').innerText()).includes('sản phẩm'))
      await page.getByRole('button', { name: /Giá đỡ laptop/ }).click()
      await page.waitForFunction(() => !new URLSearchParams(location.search).has('category'))
      await page.getByLabel('Sắp xếp').selectOption('price_asc')
      await page.waitForURL(/sort=price_asc/)
      await page.goBack()
      await page.waitForFunction(() => !new URLSearchParams(location.search).has('sort'))

      await page.route('**/api/v1/catalog*', (route) => route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'CATALOG_UNAVAILABLE' } }),
      }))
      await page.goto('http://localhost:3000/san-pham?category=desk-mat', { waitUntil: 'networkidle' })
      await page.locator('.inline-error[role="alert"]').waitFor()
      assert.equal(await page.getByText('Chưa tìm thấy sản phẩm').count(), 0,
        'API failure must not be presented as an empty catalog')
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
  console.log('PASS T015/T016: five responsive viewports; navigation focus/keyboard; catalog search/filter/sort/pagination/back; API error is not empty state')
} finally {
  await browser.close()
}
