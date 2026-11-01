// Optional real-browser check. Start Vite on port 5175 before running this script.
const { spawn } = require('node:child_process')
const { mkdtemp, readFile, writeFile } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const path = require('node:path')
const assert = require('node:assert/strict')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const key = 'lpg-fuel-log:records:v1'

async function main() {
  const profile = await mkdtemp(path.join(tmpdir(), 'lpg-ui-check-'))
  const chrome = spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore', windowsHide: true })
  let socket
  try {
    let port
    for (let attempt = 0; attempt < 100; attempt++) {
      try { port = Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break }
      catch { await sleep(100) }
    }
    if (!port) throw new Error('Chrome did not expose its testing connection')
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl)
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
    let id = 0
    const pending = new Map()
    const exceptions = []
    socket.onmessage = ({ data }) => {
      const response = JSON.parse(data)
      if (response.method === 'Runtime.exceptionThrown') exceptions.push(response.params.exceptionDetails.text)
      if (pending.has(response.id)) {
        const { resolve, reject, timer } = pending.get(response.id)
        clearTimeout(timer); pending.delete(response.id)
        if (response.error) reject(new Error(response.error.message))
        else resolve(response.result)
      }
    }
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const messageId = ++id
      const timer = setTimeout(() => { pending.delete(messageId); reject(new Error(`Timeout: ${method}`)) }, 10000)
      pending.set(messageId, { resolve, reject, timer })
      socket.send(JSON.stringify({ id: messageId, method, params }))
    })
    const evaluate = async (expression) => {
      const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
      if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text)
      return response.result.value
    }
    const waitFor = async (expression) => {
      for (let attempt = 0; attempt < 100; attempt++) { if (await evaluate(expression)) return; await sleep(100) }
      throw new Error(`Not ready: ${expression}`)
    }
    const fill = async (name, value) => {
      await evaluate(`(() => {const input=document.getElementById(${JSON.stringify(name)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)}); input.dispatchEvent(new Event('input',{bubbles:true}));})()`)
      await sleep(40)
    }
    const click = async (selector) => { await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); await sleep(100) }
    const records = () => evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(key)}))?.records || []`)
    await send('Runtime.enable')
    await send('Page.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: process.env.APP_URL || 'http://127.0.0.1:5175/' })
    await waitFor('Boolean(document.getElementById("distanceKm"))')
    assert.ok(await evaluate('parseFloat(getComputedStyle(document.querySelector(".field-hint")).fontSize) >= 18'), 'Essential instructions must be at least 18px')
    await click('button[type=submit]')
    assert.equal((await records()).length, 0)
    assert.equal(await evaluate('document.activeElement.id'), 'distanceKm')
    for (const [name, value] of Object.entries({ distanceKm: '320.5', amount: '500', liters: '32.5' })) await fill(name, value)
    await click('button[type=submit]')
    const [first] = await records()
    assert.equal(first.amount, 500)
    await send('Page.reload')
    await waitFor('Boolean(document.querySelector(".edit-button"))')
    assert.equal((await records())[0].id, first.id)
    // Simulate a record from an earlier day to exercise edit immutability across days.
    await evaluate(`(() => {const data=JSON.parse(localStorage.getItem(${JSON.stringify(key)}));data.records[0].filledDate='2026-10-20';data.records[0].createdAt='2026-10-20T09:00:00Z';localStorage.setItem(${JSON.stringify(key)},JSON.stringify(data));})()`)
    await send('Page.reload'); await waitFor('Boolean(document.querySelector(".edit-button"))')
    await click('.edit-button')
    for (const [name, value] of Object.entries({ distanceKm: '350.25', amount: '550', liters: '35.25' })) await fill(name, value)
    await click('button[type=submit]')
    const edited = await records()
    assert.equal(edited.length, 1); assert.equal(edited[0].id, first.id)
    assert.equal(edited[0].filledDate, '2026-10-20'); assert.equal(edited[0].amount, 550)
    assert.equal(edited[0].distanceKm, 350.25); assert.equal(edited[0].liters, 35.25)
    assert.equal(await evaluate('document.querySelectorAll("input[type=date]").length'), 0)
    await click('.edit-button'); await fill('amount', '999'); await click('.button-secondary')
    assert.equal((await records())[0].amount, 550)
    // Failed browser writes must retain typed input and the existing saved row.
    await evaluate('window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new Error("quota")}')
    for (const [name, value] of Object.entries({ distanceKm: '100', amount: '200', liters: '15' })) await fill(name, value)
    await click('button[type=submit]')
    assert.equal(await evaluate('document.getElementById("amount").value'), '200')
    assert.equal((await records()).length, 1)
    assert.ok(await evaluate('Boolean(document.querySelector("[role=alert]"))'))
    await evaluate('Storage.prototype.setItem=window.originalSetItem')
    await send('Page.reload'); await waitFor('Boolean(document.querySelector(".edit-button"))')
    for (const width of [320, 375, 768, 1024, 1280]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false })
      await sleep(80)
      assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), `overflow at ${width}px`)
    }
    if (process.env.SCREENSHOT_DIR) {
      for (const [name, width] of [['desktop', 1280], ['mobile', 375]]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false })
        await sleep(100)
        const metrics = await send('Page.getLayoutMetrics')
        const image = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: metrics.cssContentSize.height, scale: 1 } })
        await writeFile(path.join(process.env.SCREENSHOT_DIR, `lpg-${name}.png`), Buffer.from(image.data, 'base64'))
      }
    }
    assert.deepEqual(exceptions, [])
    console.log('Browser PASS: validation, create, reload, edit all fields, immutable date/id, cancel, storage failure, 5 responsive widths, no runtime exceptions.')
    await send('Browser.close').catch(() => {})
  } finally { socket?.close(); chrome.kill() }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
