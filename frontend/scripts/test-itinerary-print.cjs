const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const output = process.env.PRINT_TEST_OUTPUT || path.join(process.env.TEMP || '/tmp', 'ano-tara-print-results');
fs.mkdirSync(output, { recursive: true });
const date = (i) => `2026-12-${String(i + 1).padStart(2, '0')}`;
function fixture(count) {
  const itinerary = Array.from({ length: count }, (_, d) => {
    const scheduled_activities = Array.from({ length: count === 1 ? 2 : count === 2 ? 5 : 9 }, (_, i) => ({
      name: i === 0 ? 'Ayala Museum' : `Stop ${d + 1}.${i + 1} ${i === 1 ? 'A very long activity name with local cultural history and visitor information '.repeat(3) : 'Museum visit'}`,
      destination: 'Makati City', location: 'Makati City', time: `${String(8 + i).padStart(2, '0')}:00`, guests: 3,
      assignedDay: `Day ${d + 1}`, description: i === 1 ? 'Explore the collections and local history with a guided walking tour. '.repeat(count === 5 ? 60 : 5) : 'Visit the museum collections.',
      ...(i % 3 === 0 ? { price_per_pax: 100 } : i % 3 === 1 ? { price_display: 'Free' } : {}),
      exact_latitude: i === 2 ? null : i === 4 ? 10.3157 : 14.55 + i / 100,
      exact_longitude: i === 2 ? '' : i === 4 ? 123.8854 : 121.02 + i / 100,
    }));
    return { day: date(d), destination: 'Makati City', weather_forecast: { condition: 'Clear / Sunny', temperature_min: 25, temperature_max: 32 },
      expected_weather: 'Clear / Sunny', outfit_advice: 'Wear breathable clothing and comfortable walking shoes.', scheduled_activities,
      route_segments: [{ from: scheduled_activities[0].name, to: scheduled_activities[1].name, routing: { status: 'success', geometry: { type: 'LineString', coordinates: [[121.02,14.55],[120.85,14.75],[121.03,14.56]] } } }, { routing: { status: 'error', geometry: null } }] };
  });
  return { name: `Print fixture ${count} days`, createdAt: `fixture-${count}`, dateRange: { startDate: date(0), endDate: date(count-1) }, guests: 3,
    activities: itinerary.flatMap(d => d.scheduled_activities), itinerary, priceEstimate: { amount: 4200, destination: 'Makati City' },
    outfits: itinerary.flatMap((day, d) => Array.from({length: 5}, (_, i) => ({ id: `${d}-${i}`, date: day.day, day: `Day ${d+1}`, category: `Garment ${i+1}`, outfitSetName: 'Walking outfit', image: '/destination-placeholder.svg' }))) };
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = [];
  for (const scenario of [{count:1}, {count:2}, {count:5}, {count:1, coordinates:'single'}, {count:1, coordinates:'none'}]) {
    const {count, coordinates} = scenario;
    const prefix = `${count}${coordinates ? `-${coordinates}` : ''}`;
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const plan = fixture(count);
    if (coordinates) {
      plan.outfits = [];
      plan.itinerary.forEach(day => {
        day.route_segments = [];
        day.scheduled_activities.forEach((a,i) => {
          a.name = `Simple stop ${i + 1}`;
          a.description = '';
          if (coordinates === 'none' || i > 0) { a.exact_latitude = null; a.exact_longitude = ''; }
        });
      });
    }
    await context.addInitScript(plan => localStorage.setItem('anoTaraSavedPlanners', JSON.stringify([plan])), plan);
    await page.goto('http://localhost:3100/final-planner');
    await page.getByTitle('Saved plans').click();
    await page.getByRole('button', { name: 'Open', exact: true }).click();
    for (const mode of ['Overview','Detailed']) {
      await page.getByRole('button', { name: mode, exact: true }).click();
      await page.waitForFunction(() => document.querySelectorAll('.brochure-page-frame').length > 0);
      await page.waitForTimeout(1200);
      await page.evaluate(() => { window.print = () => { window.__printed = true; }; window.__printed = false; });
      await page.getByRole('button', { name: 'Print / Save PDF', exact: true }).click();
      await page.waitForFunction(() => window.__printed || document.querySelector('.brochure-pagination [role="alert"]'), { timeout: 25000 });
      const preparation = await page.evaluate(() => window.__printed ? 'ready' : document.querySelector('.brochure-pagination [role="alert"]').textContent);
      const preview = await page.evaluate(() => ({ visible: document.querySelectorAll('.brochure-page-frame.is-visible').length, pages: document.querySelectorAll('.brochure-page-frame').length }));
      assert.equal(preview.visible, Math.min(2, preview.pages));
      await page.screenshot({path: path.join(output, `${prefix}-${mode}-preview.png`)});
      await page.emulateMedia({media:'print'});
      const layout = await page.evaluate(() => {
        const sheets = [...document.querySelectorAll('.brochure-page-frame .brochure-paper')];
        return { pages: sheets.length, overflow: sheets.flatMap((sheet, i) => {
          const footer = sheet.querySelector('footer').getBoundingClientRect();
          return [...sheet.querySelectorAll(':scope > .brochure-block')].filter(block => block.getBoundingClientRect().bottom > footer.top).map(() => i+1);
        }), controls: getComputedStyle(document.querySelector('.brochure-controls')).display,
        appVisible: [...document.body.children].filter(n => n.id !== 'itinerary-print-root' && getComputedStyle(n).display !== 'none').length,
        markersOutside: [...document.querySelectorAll('.numbered-map-marker')].filter(marker => { const m=marker.getBoundingClientRect(); const box=marker.closest('.leaflet-container').getBoundingClientRect(); return m.left < box.left || m.right > box.right || m.top < box.top || m.bottom > box.bottom; }).length };
      });
      assert.deepEqual(layout.overflow, [], 'Content must not overlap footer');
      assert.equal(layout.controls, 'none'); assert.equal(layout.appVisible, 0); assert.equal(layout.markersOutside, 0);
      await page.pdf({path: path.join(output, `${prefix}-${mode}.pdf`), preferCSSPageSize:true, printBackground:true});
      await page.emulateMedia({media:'screen'});
      assert.equal(preparation, 'ready');
      assert.deepEqual(errors, []);
      results.push({count,prefix,mode,preparation,preview,layout,errors});
    }
    await page.setViewportSize({width:390,height:844});
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.brochure-page-frame.is-visible').count(),1);
    await context.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));
})().catch(err => { console.error(err); process.exit(1); });
