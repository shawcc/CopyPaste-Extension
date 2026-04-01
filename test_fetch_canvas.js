const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('https://zherenzhenyouyisi.feishu.cn/wiki/D18mwRlfZiL0sJkmCWgc6xcVn7b?from=from_copylink', { waitUntil: 'networkidle0' });
  
  await new Promise(r => setTimeout(r, 6000));

  const content = await page.evaluate(() => {
    // 飞书云文档可能是基于 Canvas 的新型渲染 (Space 2.0 / Bitable)
    const canvases = Array.from(document.querySelectorAll('canvas'));
    const allDivs = Array.from(document.querySelectorAll('div'));
    
    // 寻找可能是图片的节点 (通过类名包含 img, image 等)
    const possibleImages = allDivs.filter(d => 
      (d.className && typeof d.className === 'string' && d.className.toLowerCase().includes('image')) ||
      (d.dataset && (d.dataset.src || d.dataset.imageUrl)) ||
      (d.style && d.style.backgroundImage && d.style.backgroundImage !== 'none')
    ).slice(0, 10);
    
    return {
      canvasCount: canvases.length,
      canvasHtml: canvases.slice(0, 2).map(c => c.outerHTML.substring(0, 200)),
      possibleImages: possibleImages.map(el => ({
        className: el.className,
        style: el.getAttribute('style'),
        dataset: Object.assign({}, el.dataset),
        html: el.outerHTML.substring(0, 300)
      }))
    };
  });

  console.log(JSON.stringify(content, null, 2));
  await browser.close();
})();
