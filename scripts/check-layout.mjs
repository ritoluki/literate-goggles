import assert from 'node:assert/strict'
import { existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright-core'

/* global document, getComputedStyle, location, URLSearchParams, structuredClone, HTMLElement, window */
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
    await page.addStyleTag({ content: 'nextjs-portal,.skip-link { display: none !important }' })
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

      const handle = 'tham-ban-co-ban'
      const detailUrl = `http://localhost:3000/api/v1/products/${handle}`
      const detailResponse = await fetch(detailUrl)
      assert.equal(detailResponse.status, 200)
      const detailBody = await detailResponse.json()
      const variantPrices = detailBody.data.variants.map((variant) => variant.priceVnd)
      assert(variantPrices.length >= 2 && new Set(variantPrices).size > 1,
        'Demo product should exercise variant-specific prices')
      await page.goto(`http://localhost:3000/san-pham/${handle}`, { waitUntil: 'networkidle' })
      await page.getByRole('heading', { name: 'Thảm bàn Cơ Bản' }).waitFor()
      const addButton = page.getByRole('button', { name: 'Thêm vào giỏ' })
      assert(await addButton.isDisabled(), 'Add-to-cart must be disabled before selecting a variant')
      const firstVariant = detailBody.data.variants[0]
      const secondVariant = detailBody.data.variants[1]
      const firstRadio = page.locator(`input[name="product-variant"][value="${firstVariant.id}"]`)
      const secondRadio = page.locator(`input[name="product-variant"][value="${secondVariant.id}"]`)
      await firstRadio.check()
      assert((await page.locator('.product-price').innerText()).includes(String(firstVariant.priceVnd).slice(0, 3)))
      await page.getByLabel('Số lượng').fill('2')
      await secondRadio.check()
      assert.equal(await page.getByLabel('Số lượng').inputValue(), '2', 'Changing variant must preserve the selected quantity')
      assert((await page.locator('.product-price').innerText()).includes(String(secondVariant.priceVnd).slice(0, 3)))
      const secondPrice = moneyForTest(secondVariant.priceVnd)
      assert((await page.locator('.product-price').innerText()).includes(secondPrice))
      await page.evaluate(() => {
        document.documentElement.style.scrollBehavior = 'auto'
        window.scrollTo(0, 0)
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      })
      await page.waitForFunction(() => window.scrollY === 0)
      await page.addStyleTag({ content: 'nextjs-portal,.skip-link { display: none !important }' })
      await page.screenshot({ path: resolve(artifactDir, 't017-product-mobile.png'), fullPage: true })
      await page.getByRole('button', { name: 'Thêm vào giỏ' }).click()
      await page.getByText('Đã thêm sản phẩm vào giỏ hàng.').waitFor({ timeout: 15_000 })
      await page.getByRole('link', { name: 'Giỏ hàng, 2 sản phẩm' }).waitFor()
      await page.goto('http://localhost:3000/gio-hang', { waitUntil: 'networkidle' })
      await page.getByRole('heading', { name: 'Giỏ hàng' }).waitFor()
      await page.getByText('Thảm bàn Cơ Bản', { exact: true }).waitFor()
      await page.reload({ waitUntil: 'networkidle' })
      const cartQuantity = page.getByLabel('Số lượng Thảm bàn Cơ Bản')
      await cartQuantity.waitFor()
      assert.equal(await cartQuantity.inputValue(), '2', 'Cart contents must persist after reload')
      await page.getByLabel('Mã ưu đãi').fill('BGDEMO10')
      await page.getByRole('button', { name: 'Áp dụng' }).click()
      await page.getByText('Đang áp dụng: BGDEMO10').waitFor()
      await page.getByRole('button', { name: 'Gỡ mã' }).click()
      await page.getByRole('status').filter({ hasText: 'Giỏ hàng đã được cập nhật.' }).waitFor()
      await cartQuantity.selectOption('3')
      await page.getByRole('status').filter({ hasText: 'Giỏ hàng đã được cập nhật.' }).waitFor()
      await page.reload({ waitUntil: 'networkidle' })
      assert.equal(await page.getByLabel('Số lượng Thảm bàn Cơ Bản').inputValue(), '3',
        'Updated quantity must persist after reload')
      await page.getByRole('button', { name: 'Xóa' }).click()
      await page.getByRole('heading', { name: 'Giỏ hàng đang trống' }).waitFor()
      await page.goto(`http://localhost:3000/san-pham/${handle}`, { waitUntil: 'networkidle' })
      await page.getByRole('heading', { name: 'Thảm bàn Cơ Bản' }).waitFor()
      await page.goto('http://localhost:3000/chinh-sach', { waitUntil: 'networkidle' })
      await page.getByText('BẢN DỰ THẢO NỘI BỘ').waitFor()
      assert((await page.locator('meta[name="robots"]').getAttribute('content')).includes('noindex'))
      assert.equal((await fetch('http://localhost:3000/robots.txt').then((response) => response.text())).includes('Disallow: /'), true)
      assert.equal((await fetch('http://localhost:3000/sitemap.xml').then((response) => response.text())).includes('<url>'), false)
      await page.goto(`http://localhost:3000/san-pham/${handle}`, { waitUntil: 'networkidle' })

      const unavailableDetail = structuredClone(detailBody)
      for (const variant of unavailableDetail.data.variants) {
        variant.available = false
        variant.maxOrderQuantity = 0
      }
      await page.route(`**/api/v1/products/${handle}`, (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(unavailableDetail),
      }))
      await page.reload({ waitUntil: 'networkidle' })
      await page.locator(`input[name="product-variant"][value="${firstVariant.id}"]`).check()
      const soldOutButton = page.getByRole('button', { name: 'Tạm hết hàng' })
      assert(await soldOutButton.isDisabled(), 'Unavailable variant must not be addable')
      await page.unroute(`**/api/v1/products/${handle}`)
      if (width === 390) {
        await page.goto(`http://localhost:3000/san-pham/${handle}`, { waitUntil: 'networkidle' })
        await page.locator(`input[name="product-variant"][value="${firstVariant.id}"]`).check()
        await page.getByRole('button', { name: 'Thêm vào giỏ' }).click()
        await page.getByText('Đã thêm sản phẩm vào giỏ hàng.').waitFor()
        await page.goto('http://localhost:3000/gio-hang', { waitUntil: 'networkidle' })
        await page.getByRole('link', { name: 'Tiếp tục tới thông tin giao hàng' }).click()
        await page.getByRole('heading', { name: 'Thông tin giao hàng' }).waitFor()
        const optionsBeforeAddress = await page.evaluate(async () =>
          (await fetch('/api/v1/checkout/shipping-options')).status)
        assert.equal(optionsBeforeAddress, 409, 'Shipping options must not be quoted before address is provided')
        const csrf = await page.evaluate(async () => (await (await fetch('/api/v1/session')).json()).data.csrfToken)
        const unsupported = await page.evaluate(async (csrfToken) => {
          const response = await fetch('/api/v1/checkout/address', {
          method: 'PUT', headers: { 'content-type': 'application/json', 'x-bg-csrf-token': csrfToken },
          body: JSON.stringify({ email: 'fixture@invalid.example', address: {
            firstName: 'Demo', lastName: 'Test', phone: '+84900000000', countryCode: 'us',
            province: 'Synthetic', city: 'Synthetic', address1: '1 Test Street',
          } }),
          })
          return response.status
        }, csrf)
        assert.equal(unsupported, 400, 'Unsupported country must be rejected by checkout API')
        await page.getByLabel('Email').fill('checkout-fixture@invalid.example')
        await page.getByLabel('Tên', { exact: true }).fill('Demo')
        await page.getByLabel('Họ', { exact: true }).fill('Tester')
        await page.getByLabel('Số điện thoại').fill('+84900000000')
        await page.getByLabel('Tỉnh / thành phố').fill('TP Hồ Chí Minh')
        await page.getByLabel('Thành phố / địa phương').fill('TP Hồ Chí Minh')
        await page.getByLabel('Quận / huyện (nếu có)').fill('Quận 1')
        await page.getByLabel('Phường / xã (nếu có)').fill('Phường Bến Nghé')
        await page.getByLabel('Địa chỉ đường, số nhà').fill('123 Đường Kiểm thử')
        await page.getByRole('button', { name: 'Lưu địa chỉ và xem phí giao hàng' }).click()
        await page.getByRole('status').filter({ hasText: 'Địa chỉ đã lưu. Phí vận chuyển' }).waitFor()
        await page.reload({ waitUntil: 'networkidle' })
        await page.getByLabel('Email').waitFor()
        assert.equal(await page.getByLabel('Email').inputValue(), 'checkout-fixture@invalid.example',
          'Session-owned guest email should be restored after reload')
        assert.equal(await page.getByLabel('Địa chỉ đường, số nhà').inputValue(), '123 Đường Kiểm thử',
          'Session-owned delivery address should be restored after reload')
        const shippingRadio = page.getByRole('radio', { name: /Bàn Gọn Demo Standard Shipping/ })
        await shippingRadio.waitFor()
        await shippingRadio.click()
        await page.getByRole('status').filter({ hasText: 'Phương thức vận chuyển đã được xác nhận' }).waitFor()
        assert.equal(await shippingRadio.isChecked(), true)
        assert((await page.locator('.checkout-summary').innerText()).includes('30.000'))
        await page.getByRole('button', { name: 'Xem lại đơn COD' }).click()
        await page.getByRole('status').filter({ hasText: 'Đã chốt bản xem lại COD trong 5 phút.' }).waitFor()
        assert((await page.locator('.checkout-summary').innerText()).includes('Thanh toán khi nhận hàng (COD)'))
      }
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
      await page.goto('http://localhost:3000/san-pham/tham-ban-co-ban', { waitUntil: 'networkidle' })
      await page.getByRole('heading', { name: 'Thảm bàn Cơ Bản' }).waitFor()
      await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 0) })
      await page.waitForFunction(() => window.scrollY === 0)
      await page.addStyleTag({ content: 'nextjs-portal,.skip-link { display: none !important }' })
      await page.screenshot({ path: resolve(artifactDir, 't017-product-desktop.png'), fullPage: true })
    }
    await context.close()
  }
  console.log('PASS T015–T021: responsive catalog/PDP/cart; guest address, Medusa shipping quote/selection and COD review; policy and noindex/robots/sitemap')
} finally {
  await browser.close()
}

function moneyForTest(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)
}
