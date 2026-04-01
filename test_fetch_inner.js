const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('https://zherenzhenyouyisi.feishu.cn/wiki/D18mwRlfZiL0sJkmCWgc6xcVn7b?from=from_copylink', { waitUntil: 'networkidle0' });
  
  // 等待渲染
  await new Promise(r => setTimeout(r, 5000));

  const content = await page.evaluate(() => {
    // 飞书图片块通常是 .block-image 或带特定的 data-block-type
    const imageBlocks = Array.from(document.querySelectorAll('[data-block-type="27"], .ace-image, .docx-image, .suite-doc-image, img'));
    
    return imageBlocks.map(el => {
      // 尝试深入挖掘内部可能存在的 src
      let possibleSrc = '';
      if (el.tagName === 'IMG') {
        possibleSrc = el.src;
      } else {
        const innerImg = el.querySelector('img');
        if (innerImg) possibleSrc = innerImg.src;
        else if (el.dataset.src) possibleSrc = el.dataset.src;
      }
      
      return {
        tag: el.tagName,
        className: el.className,
        dataset: Object.assign({}, el.dataset),
        possibleSrc: possibleSrc,
        html: el.outerHTML.substring(0, 400)
      };
    });
  });

  console.log(JSON.stringify(content, null, 2));
  await browser.close();
})();
