(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CopyPasteExporter = factory();
})(globalThis, function () {
  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function escapeAttr(s) {
    return escapeHtml(s).replaceAll("\n", " ");
  }

  function pad3(n) {
    return String(n).padStart(3, "0");
  }

  function rowsFromExtract(extract) {
    const lines = Array.isArray(extract?.lines) ? extract.lines : [];
    const images = Array.isArray(extract?.images) ? extract.images : [];
    const rows = [];
    let imgIndex = 0;
    
    // 如果没有图片，直接把所有文案列出来
    if (!images || images.length === 0) {
      return lines.map(text => ({ text, images: [], ocrText: "" }));
    }

    // 如果没有文案，只列图片
    if (!lines || lines.length === 0) {
      return images.map(img => ({ text: "", images: [img], ocrText: img.ocrText || "" }));
    }

    // 计算每张图片大致对应几行文案
    const linesPerImg = Math.ceil(lines.length / images.length);

    for (let i = 0; i < lines.length; i++) {
      const text = lines[i];
      // 只有在这张图片的第一行文案时，我们把图片放进去；后续文案的图片列留空，表示属于同一张图
      const currentImages = (i % linesPerImg === 0 && images[imgIndex]) 
          ? [images[imgIndex]] 
          : [];
      const currentOcr = images[imgIndex] && images[imgIndex].ocrText ? images[imgIndex].ocrText : "";
      
      rows.push({
        text,
        images: currentImages,
        ocrText: currentOcr
      });

      if ((i + 1) % linesPerImg === 0 && imgIndex < images.length - 1) {
        imgIndex++;
      }
    }
    
    return rows;
  }

  function htmlTableFromRows(rows, languages) {
    const cols = ["序号", "Key", "页面截图", "备注", "类型", "CN (PM)", "OCR 参考"];
    const head = `<tr>${cols.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr>`;

    const body = rows
      .map((r, idx) => {
        const index = idx + 1;
        const key = "";
        const imgCell =
          r.images && r.images.length
            ? r.images
                .map((imgObj) => {
                  const finalSrc = imgObj.base64 || imgObj.src || imgObj;
                  const cleanUrl = typeof finalSrc === 'string' ? escapeAttr(finalSrc).replace(/&amp;/g, '&') : finalSrc;
                  // 飞书多维表格（Bitable）和普通表格对于简单 img 标签的兼容性最好
                  return `<img src="${cleanUrl}" />`;
                })
                .join("")
            : "";
        const remark = "";
        const type = "";
        const cnText = r.text || "";
        const ocrText = r.ocrText || "等待OCR...";

        const cells = [
          `<td>${index}</td>`,
          `<td>${key}</td>`,
          `<td>${imgCell}</td>`,
          `<td>${remark}</td>`,
          `<td>${type}</td>`,
          `<td>${escapeHtml(cnText)}</td>`,
          `<td>${escapeHtml(ocrText)}</td>`
        ];
        return `<tr>${cells.join("")}</tr>`;
      })
      .join("");

    // 退回最简单干净的表格结构，这是各种表格系统（普通表格/多维表格/Excel）兼容性最好的格式
    return `<meta charset="utf-8"><table><thead>${head}</thead><tbody>${body}</tbody></table>`;
  }

  function tsvFromRows(rows, languages) {
    const cols = ["序号", "Key", "页面截图", "备注", "类型", "CN (PM)", "OCR 参考"];
    const lines = [cols.join("\t")];
    rows.forEach((r, idx) => {
      const index = idx + 1;
      const key = "";
      let imgUrl = "";
      if (r.images && r.images.length) {
        const imgObj = r.images[0];
        const finalSrc = imgObj.base64 || imgObj.src || imgObj;
        const cleanUrl = typeof finalSrc === 'string' ? finalSrc.replace(/&amp;/g, '&') : finalSrc;
        // TSV里尽量留原始链接，太长的base64会崩
        imgUrl = imgObj.src || cleanUrl;
      }
      const remark = "";
      const type = "";
      const cnText = r.text || "";
      const ocrText = r.ocrText || "等待OCR...";
      lines.push([index, key, imgUrl, remark, type, cnText, ocrText].map((x) => String(x ?? "")).join("\t"));
    });
    return lines.join("\n");
  }

  return { rowsFromExtract, htmlTableFromRows, tsvFromRows };
});

