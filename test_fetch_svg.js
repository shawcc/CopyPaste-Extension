const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('https://zherenzhenyouyisi.feishu.cn/wiki/D18mwRlfZiL0sJkmCWgc6xcVn7b?from=from_copylink', { waitUntil: 'networkidle0' });
  
  await new Promise(r => setTimeout(r, 8000));

  const content = await page.evaluate(() => {
    // 飞书图片现在很多是用 svg 的 image 标签渲染，或者是带有特定的 data-src / href
    const svgImages = Array.from(document.querySelectorAll('image'));
    const allImages = Array.from(document.querySelectorAll('img, image, [data-src], [data-image-url]'));
    
    return {
      svgImages: svgImages.map(el => ({
        href: el.getAttribute('href') || el.getAttribute('xlink:href'),
        html: el.outerHTML.substring(0, 200)
      })),
      allImages: allImages.map(el => ({
        tag: el.tagName,
        src: el.src || el.getAttribute('src') || el.getAttribute('href') || el.dataset.src || el.dataset.imageUrl,
        html: el.outerHTML.substring(0, 200)
      }))
    };
  });

  console.log(JSON.stringify(content, null, 2));
  await browser.close();
})();
