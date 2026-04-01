const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('https://zherenzhenyouyisi.feishu.cn/wiki/D18mwRlfZiL0sJkmCWgc6xcVn7b?from=from_copylink', { waitUntil: 'networkidle0' });
  
  // 等待可能包含图片的块加载
  await new Promise(r => setTimeout(r, 3000));

  const imagesInfo = await page.evaluate(() => {
    // 飞书图片常常包裹在特定类名的 div 中，且可能不在直接的 img 里
    const nodes = Array.from(document.querySelectorAll('img, [data-block-type="image"], .ace-image, .docx-image, div[style*="background-image"]'));
    return nodes.map(el => {
      let src = '';
      if (el.tagName === 'IMG') {
        src = el.src;
      } else if (el.style.backgroundImage) {
        src = el.style.backgroundImage;
      }
      return {
        tag: el.tagName,
        className: el.className,
        src: src,
        dataset: Object.assign({}, el.dataset),
        html: el.outerHTML.substring(0, 300) // 截取部分HTML以便分析
      };
    }).filter(info => info.src || info.html.includes('src') || info.html.includes('url'));
  });

  console.log(JSON.stringify(imagesInfo, null, 2));
  await browser.close();
})();
