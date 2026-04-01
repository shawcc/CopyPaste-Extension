function normalizeLine(s) {
  return String(s || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function uniqPreserveOrder(arr) {
  const out = [];
  const seen = new Set();
  for (const v of arr) {
    const key = String(v);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

function extractQuoted(text) {
  const out = [];
  const patterns = [
    /“([^”]{1,120})”/g,
    /「([^」]{1,120})」/g,
    /『([^』]{1,120})』/g,
    /"([^"\n]{1,120})"/g,
    /'([^'\n]{1,120})'/g
  ];
  for (const re of patterns) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      const v = normalizeLine(m[1]);
      if (v) out.push(v);
    }
  }
  return out;
}

function extractLabeled(lines) {
  const out = [];
  const labelRe =
    /^(?:UI|界面)?\s*(?:文案|按钮|按钮文案|提示|错误提示|校验提示|占位|占位符|placeholder|toast|title|标题|副标题|描述)\s*[:：]\s*(.+)$/i;

  for (const line of lines) {
    const m = labelRe.exec(line);
    if (!m) continue;
    const tail = normalizeLine(m[1]);
    if (!tail) continue;
    const parts = tail
      .split(/[；;。]/g)
      .map(normalizeLine)
      .filter(Boolean);
    out.push(...parts);
  }
  return out;
}

function guessUiLines(rawText, lines) {
  const candidates = [];
  candidates.push(...extractQuoted(rawText));
  candidates.push(...extractLabeled(lines));

  const shortLines = lines.filter((l) => l.length > 0 && l.length <= 40);
  candidates.push(...shortLines);

  const cleaned = candidates
    .map(normalizeLine)
    .filter(Boolean)
    .filter((s) => s.length <= 120)
    .filter((s) => !/^https?:\/\//i.test(s))
    .filter((s) => !/^(?:模块|方案|背景|目标|范围|说明|备注|结论|实现|设计|流程)\b/.test(s));

  return cleaned; // 彻底移除 uniqPreserveOrder
}

function extractImagesFromNode(rootNode) {
  const images = [];
  const walk = (node) => {
    if (!node || !node.tagName) return;
    
    // 1. 常规 img 标签
    if (node.tagName === "IMG") {
      let src = node.getAttribute("src") || node.dataset?.src || "";
      if (src) {
        images.push({
          src,
          alt: normalizeLine(node.getAttribute("alt") || ""),
          width: node.naturalWidth || node.width || null,
          height: node.naturalHeight || node.height || null
        });
      }
    }
    
    // 2. 飞书特有的带有背景图的 div 或带 data 属性的节点
    // 例如 .ssrWaterMark 或各种 image-viewer-slot，或者内联 style 背景
    const styleStr = node.getAttribute("style") || "";
    if (styleStr.includes("background-image")) {
      const match = styleStr.match(/url\(['"]?(.*?)['"]?\)/);
      if (match && match[1] && !match[1].startsWith("data:image/svg+xml;base64,PHN2ZyB4bWxucz0")) { // 过滤掉默认水印SVG
        images.push({
          src: match[1],
          alt: normalizeLine(node.getAttribute("aria-label") || "")
        });
      }
    }
    
    // 检查自定义属性
    if (node.dataset?.src || node.dataset?.imageUrl) {
      images.push({
        src: node.dataset.src || node.dataset.imageUrl,
        alt: ""
      });
    }

    // 检查是否有 href (SVG image)
    const href = node.getAttribute("href") || node.getAttribute("xlink:href");
    if (href) {
      images.push({ src: href, alt: "" });
    }

    // 3. 处理直接的 canvas (飞书云文档新版可能用 canvas 渲染图片)
    if (node.tagName === "CANVAS") {
      images.push({
        src: "canvas-placeholder",
        alt: "Canvas图片(暂不支持直接导出链接)"
      });
    }

    // 4. 处理 SVG 里的 image
    if (node.tagName === "image" || node.tagName === "IMAGE") {
      let src = node.getAttribute("href") || node.getAttribute("xlink:href") || "";
      if (src) {
        images.push({ src, alt: "" });
      }
    }

    // 递归子节点
    for (const child of Array.from(node.children || [])) {
      walk(child);
    }
  };
  
  if (rootNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
    for (const child of Array.from(rootNode.children || [])) walk(child);
  } else {
    walk(rootNode);
  }
  
  // 去重并解析 URL
  const uniqueImages = [];
  const seen = new Set();
  for (const img of images) {
    if (!img.src) continue;
    let resolved = img.src;
    
    // 清理 URL
    if (resolved.startsWith('url(')) {
      resolved = resolved.replace(/^url\(['"]?/, '').replace(/['"]?\)$/, '');
    }

    if (!resolved.startsWith("data:") && !resolved.startsWith("blob:") && resolved !== "canvas-placeholder") {
      try {
        resolved = new URL(resolved, window.location.href).toString();
      } catch (e) {
        continue;
      }
    }
    
    // 移除图片去重，很多表格里同一张占位图可能会出现多次，去重会导致数量对不上
    img.src = resolved;
    uniqueImages.push(img);
  }
  return uniqueImages;
}
function extractSegments(fragment) {
  const segments = [];
  const blockTags = new Set(["P", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "TD", "TH"]);

  function walk(node) {
    if (!node) return;
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node;
      const tag = el.tagName;
      if (tag === "IMG") {
        const src = el.getAttribute("src") || "";
        const resolved =
          src.startsWith("data:") || src.startsWith("blob:")
            ? src
            : new URL(src, window.location.href).toString();
        if (resolved) {
          segments.push({
            kind: "image",
            src: resolved,
            alt: normalizeLine(el.getAttribute("alt") || "")
          });
        }
        return;
      }

      if (blockTags.has(tag)) {
        const text = normalizeLine(el.textContent || "");
        if (text) segments.push({ kind: "text", text });
        return;
      }

      for (const child of Array.from(el.childNodes)) walk(child);
      return;
    }

    if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      for (const child of Array.from(node.childNodes)) walk(child);
    }
  }

  walk(fragment);
  return segments;
}

// 飞书图片提取专用：深度遍历给定容器，只找里面的真图片
function extractImagesFromContainer(container) {
  if (!container) return [];
  const images = [];
  const seen = new Set();

  const addImg = (url, node) => {
    if (!url) return;
    let cleanUrl = url;
    if (cleanUrl.startsWith('url(')) {
      cleanUrl = cleanUrl.replace(/^url\(['"]?/, '').replace(/['"]?\)$/, '');
    }
    
    // 过滤掉头像和明显的小图标，但保留其他一切合法的图片
    if (cleanUrl.includes('avatar') || cleanUrl.includes('icon') || cleanUrl.includes('emoji')) return;
    if (cleanUrl.startsWith('data:image/svg') && cleanUrl.includes('PHN2Zy')) return; // 过滤水印
    if (cleanUrl === 'canvas-placeholder') return;
    if (cleanUrl.includes('illustration_empty')) return; // 过滤空状态占位图

    // 只要是 http, https, data:image/, blob: 开头的，通通放行！
    if (!cleanUrl.startsWith("http") && !cleanUrl.startsWith("data:image/") && !cleanUrl.startsWith("blob:")) return;

    if (seen.has(cleanUrl)) return;
    seen.add(cleanUrl);
    
    images.push({
      src: cleanUrl,
      alt: node.getAttribute("alt") || node.getAttribute("aria-label") || ""
    });
  };

  // 1. 找所有的 img 标签
  container.querySelectorAll('img').forEach(el => addImg(el.src || el.dataset?.src, el));
  
  // 2. 找所有的背景图 (包含在 div, span, a 等标签内)
  container.querySelectorAll('*').forEach(el => {
    // 检查自定义属性 data-src (飞书图片块常用)
    if (el.dataset?.src) {
      addImg(el.dataset.src, el);
    }
    // 检查背景图
    const styleStr = el.getAttribute('style') || '';
    if (styleStr.includes('background-image')) {
      const match = styleStr.match(/url\(['"]?(.*?)['"]?\)/);
      if (match && match[1]) {
         // 排除掉飞书里明显作为装饰或占位的块
         if (!el.className || (typeof el.className === 'string' && !el.className.includes('watermark'))) {
            addImg(match[1], el);
         }
      }
    }
  });

  return images;
}

function getRealSelection() {
  // 飞书的编辑器可能在 iframe 里，也可能用自定义光标屏蔽了原生 selection
  let sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && !sel.isCollapsed) return sel;

  // 尝试在 iframe 中寻找
  const iframes = document.querySelectorAll('iframe');
  for (const iframe of iframes) {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const innerSel = doc.getSelection();
      if (innerSel && innerSel.rangeCount > 0 && !innerSel.isCollapsed) {
        return innerSel;
      }
    } catch(e) {
      // 跨域 iframe 忽略
    }
  }
  return null;
}

async function extractFromSelection() {
  const sel = getRealSelection();
  
  // 准备获取网络层拦截到的图片作为终极兜底
  let networkImages = [];
  try {
    const res = await chrome.runtime.sendMessage({ type: "GET_CACHED_IMAGES" });
    if (res && res.urls) {
      networkImages = res.urls.map(url => ({ src: url, alt: "网络抓取图片" }));
    }
  } catch(e) {}
  
  // 对于飞书的 Canvas 渲染（docx 新版），原生的 selection 常常是空的，或者它拦截了右键
  // 此时最好的方式是利用浏览器的剪贴板：当用户按下 Command+C 或通过我们的右键菜单触发时，
  // 飞书会把自己内部 Canvas 里的文本和图片写入到系统的 Clipboard 里！
  // 但出于安全限制，我们无法直接读取剪贴板，所以我们尽量使用 selection.toString() 或让用户先复制一次。
  
  // 终极杀招：如果真的获取不到选区，不再报错，直接抓取整个飞书正文内容！
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
    const root = document.querySelector('.lark-doc, .ace-editor, .docx-engine, .suite-doc') || document.body;
    const rawText = normalizeLine(root?.innerText || "");
    const lines = rawText.split(/\n+/g).map(normalizeLine).filter(Boolean);
    const uiLines = guessUiLines(rawText, lines);
    let images = extractImagesFromContainer(root);
    
    // 如果 DOM 里啥也没有，用网络请求拦截的图兜底
    if (images.length === 0 && networkImages.length > 0) {
       images = networkImages;
    }
    
    return {
      ok: true,
      url: window.location.href,
      title: document.title || "",
      lines,
      uiLines,
      segments: [],
      images,
      note: "未检测到选区，已自动抓取全篇内容"
    };
  }

  const range = sel.getRangeAt(0);

  // 飞书可能在 shadow DOM 或特殊结构中，尝试克隆选区，并直接从外层容器抓取备用图片
  const fragment = range.cloneContents();
  const rawText = normalizeLine(fragment.textContent || "") || normalizeLine(sel.toString());
  
  // 移除文本去重，保留真实的段落数量
  const lines = rawText
      .split(/\n+/g)
      .map(normalizeLine)
      .filter(Boolean);

  const segments = extractSegments(fragment);
  const uiLines = guessUiLines(rawText, lines);

  // 增强图片提取逻辑：除了 fragment，还去真实 DOM 里找一遍选区内的图片
  let images = extractImagesFromNode(fragment);
  
  if (images.length === 0) {
    // 终极兜底：如果选区内死活找不到图片，直接把整个文档里所有符合飞书特征的图片全抓出来
    const documentContainer = document.querySelector('.lark-doc, .ace-editor, .docx-engine, .suite-doc') || document.body;
    images = extractImagesFromContainer(documentContainer);
    
    if (images.length === 0 && networkImages.length > 0) {
       images = networkImages;
    }
  }

  return {
    ok: true,
    url: window.location.href,
    title: document.title || "",
    lines,
    uiLines,
    segments,
    images
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "CP_EXTRACT_SELECTION") {
    // 因为 extractFromSelection 变成了 async，这里必须用 Promise
    extractFromSelection().then(res => {
      sendResponse(res);
    }).catch(e => {
      sendResponse({ ok: false, error: String(e && e.message ? e.message : e) });
    });
  }
  if (msg.type === "CP_SCROLL_EXTRACT_START") {
    try {
      startScrollExtract();
      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({ ok: false, error: String(e && e.message ? e.message : e) });
    }
  }
  if (msg.type === "CP_SCROLL_EXTRACT_STOP") {
    try {
      stopScrollExtract();
      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({ ok: false, error: String(e && e.message ? e.message : e) });
    }
  }
  return true;
});

let scrollTimer = null;
let isScrolling = false;
let scrollRoot = null;
let scrollBuffer = null;

async function captureViewportExtract() {
  // 1. 尝试从飞书可能暴露的全局变量或剪贴板事件中获取文本 (暂且保留原本的 DOM 抓取作为基础兜底)
  const root = document.activeElement?.closest?.(".lark-doc, .ace-editor, .docx-engine, .suite-doc") || document.querySelector('.lark-doc, .ace-editor, .docx-engine, .suite-doc') || document.body;
  let rawText = normalizeLine(root?.innerText || "");
  
  // 飞书 Canvas 模式下 innerText 为空，尝试模拟复制或读取 selection
  if (!rawText || rawText.length < 10) {
    const sel = getRealSelection();
    if (sel && !sel.isCollapsed) {
       rawText = sel.toString();
    }
  }

  // 移除文本去重
  const lines = rawText
      .split(/\n+/g)
      .map(normalizeLine)
      .filter(Boolean);
      
  const uiLines = guessUiLines(rawText, lines);

  // 增强滚动模式的图片提取逻辑：直接用全局提取加可视区判断
  let images = extractImagesFromContainer(root);

  if (images.length === 0) {
    try {
      const res = await chrome.runtime.sendMessage({ type: "GET_CACHED_IMAGES" });
      if (res && res.urls && res.urls.length > 0) {
        images = res.urls.map(url => ({ src: url, alt: "网络抓取图片" }));
      }
    } catch(e) {}
  }

  return {
    ok: true,
    url: window.location.href,
    title: document.title || "",
    lines,
    uiLines,
    segments: [],
    images
  };
}

function isScrollable(el) {
  if (!el || el === document.body || el === document.documentElement) return false;
  const style = window.getComputedStyle(el);
  const overflowY = style.overflowY || style.overflow;
  return (
    (overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight + 4
  );
}

function findScrollRoot() {
  const candidates = [
    document.activeElement,
    document.querySelector(".lark-doc"),
    document.querySelector(".lark-doc-container"),
    document.querySelector("[data-doc-id]"),
    document.scrollingElement
  ].filter(Boolean);

  for (const c of candidates) {
    let el = c;
    while (el && el !== document.body) {
      if (isScrollable(el)) return el;
      el = el.parentElement;
    }
  }

  const all = Array.from(document.querySelectorAll("div, main, section"));
  let best = null;
  for (const el of all) {
    if (!isScrollable(el)) continue;
    if (!best || el.scrollHeight > best.scrollHeight) best = el;
  }
  return best || document.scrollingElement || document.body;
}

function mergeExtract(base, next) {
  const merged = base || {
    ok: true,
    url: next.url,
    title: next.title,
    lines: [],
    uiLines: [],
    segments: [],
    images: []
  };
  merged.lines = uniqPreserveOrder([...(merged.lines || []), ...(next.lines || [])]);
  merged.uiLines = uniqPreserveOrder([...(merged.uiLines || []), ...(next.uiLines || [])]);
  const imgs = uniqPreserveOrder([...(merged.images || []), ...(next.images || [])]);
  merged.images = imgs.map((x) => (typeof x === "string" ? { src: x } : x));
  return merged;
}

async function sendScrollUpdate(done = false) {
  const payload = scrollBuffer || captureViewportExtract();
  const state = { running: isScrolling };
  await new Promise((resolve) => {
    const type = done ? "CP_SCROLL_EXTRACT_DONE" : "CP_SCROLL_EXTRACT_UPDATE";
    chrome.runtime.sendMessage({ type, payload, state }, () => resolve());
  });
}

async function startScrollExtract() {
  if (isScrolling) return;
  scrollRoot = findScrollRoot();
  scrollBuffer = mergeExtract(null, await captureViewportExtract());
  isScrolling = true;
  const step = () => {
    if (!isScrolling) return;
    const prevTop = scrollRoot?.scrollTop || 0;
    const delta = Math.max(400, (scrollRoot?.clientHeight || window.innerHeight) * 0.7);
    if (scrollRoot && scrollRoot !== document.body && scrollRoot !== document.documentElement) {
      scrollRoot.scrollBy({ top: delta, behavior: "smooth" });
    } else {
      window.scrollBy({ top: delta, behavior: "smooth" });
    }
    setTimeout(async () => {
      if (!isScrolling) return;
      const next = await captureViewportExtract();
      scrollBuffer = mergeExtract(scrollBuffer, next);
      sendScrollUpdate(false);
      const nowTop = scrollRoot?.scrollTop || 0;
      if (Math.abs(nowTop - prevTop) < 2) stopScrollExtract();
    }, 250);
  };
  scrollTimer = window.setInterval(step, 1500);
  sendScrollUpdate(false);
}

function stopScrollExtract() {
  if (!isScrolling) return;
  isScrolling = false;
  if (scrollTimer) {
    window.clearInterval(scrollTimer);
    scrollTimer = null;
  }
  sendScrollUpdate(true);
}
