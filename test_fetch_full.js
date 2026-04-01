const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('https://zherenzhenyouyisi.feishu.cn/wiki/D18mwRlfZiL0sJkmCWgc6xcVn7b?from=from_copylink', { waitUntil: 'networkidle0' });
  
  await new Promise(r => setTimeout(r, 6000));

  const content = await page.evaluate(() => {
    const images = [];
    
    // 1. 查找所有的 img 标签
    document.querySelectorAll('img').forEach(el => {
      images.push({
        type: 'img',
        src: el.src,
        className: el.className,
        width: el.width || el.naturalWidth
      });
    });

    // 2. 查找所有的 background-image
    document.querySelectorAll('*').forEach(el => {
      if (el.style && el.style.backgroundImage && el.style.backgroundImage !== 'none') {
        images.push({
          type: 'background',
          src: el.style.backgroundImage,
          className: el.className,
          rect: el.getBoundingClientRect().toJSON()
        });
      }
    });

    // 3. 查找所有的 image (svg)
    document.querySelectorAll('image').forEach(el => {
      images.push({
        type: 'svg-image',
        href: el.getAttribute('href') || el.getAttribute('xlink:href'),
        className: el.className.baseVal
      });
    });

    return images.filter(img => {
      const s = img.src || img.href;
      if (!s) return false;
      // 过滤掉明显的飞书 UI 图标、头像等（特征通常包含 avatar, icon, emoji 等字样，或者宽高很小）
      if (s.includes('avatar') || s.includes('icon') || s.includes('emoji')) return false;
      if (img.width && img.width < 50) return false;
      return true;
    });
  });

  console.log(JSON.stringify(content, null, 2));
  await browser.close();
})();
