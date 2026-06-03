const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:3000/map', { waitUntil: 'networkidle0' });
  
  const boxes = await page.evaluate(() => {
    const serializeRect = (el) => {
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };

    const h1 = document.querySelector('h1');
    const mapWrap = document.querySelector('.maplibregl-map')?.parentElement;
    const mapCanvas = document.querySelector('.maplibregl-canvas');
    const sidebar = document.querySelector('.glass-panel');
    
    return {
      h1: serializeRect(h1),
      mapWrap: serializeRect(mapWrap),
      mapCanvas: serializeRect(mapCanvas),
      sidebar: serializeRect(sidebar),
      sidebarDisplay: sidebar ? window.getComputedStyle(sidebar).display : null,
      sidebarZIndex: sidebar ? window.getComputedStyle(sidebar).zIndex : null,
      mapZIndex: mapCanvas ? window.getComputedStyle(mapCanvas).zIndex : null
    };
  });
  console.log(boxes);
  
  console.log('Taking screenshot...');
  await page.screenshot({ path: 'screenshot_after.png' });
  
  await browser.close();
})();
