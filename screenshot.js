const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  console.log('Navigating to http://localhost:3000/map...');
  await page.goto('http://localhost:3000/map', { waitUntil: 'networkidle0', timeout: 30000 });
  
  // Wait a couple of seconds for the map to finish processing
  await new Promise(r => setTimeout(r, 5000));
  
  console.log('Taking screenshot...');
  await page.screenshot({ path: 'screenshot.png' });
  
  await browser.close();
  console.log('Screenshot saved to screenshot.png');
})();
