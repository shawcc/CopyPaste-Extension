const assert = require("assert");
const exporter = require("./exporter.js");

const extract = {
  lines: ["登录", "确认"],
  segments: [
    { kind: "text", text: "登录" },
    { kind: "image", src: "https://example.com/a.png" },
    { kind: "text", text: "确认" }
  ]
};

const rows = exporter.rowsFromExtract(extract);
assert.strictEqual(rows.length, 2);
assert.strictEqual(rows[0].text, "登录");
assert.deepStrictEqual(rows[0].images, ["https://example.com/a.png"]);

const html = exporter.htmlTableFromRows(rows, ["en-US", "ja-JP"]);
assert.ok(html.includes("<table"));
assert.ok(html.includes("COPY_001"));
assert.ok(html.includes("zh-CN"));
assert.ok(html.includes("en-US"));
assert.ok(html.includes("ja-JP"));
assert.ok(html.includes("https://example.com/a.png"));

const tsv = exporter.tsvFromRows(rows, ["en-US"]);
assert.ok(tsv.startsWith("Key\tzh-CN\ten-US\t图片"));
assert.ok(tsv.includes("COPY_001\t登录\t\thttps://example.com/a.png"));

const imageRows = [{ text: "", images: ["https://example.com/b.png"] }];
const html2 = exporter.htmlTableFromRows(imageRows, ["en-US"]);
assert.ok(html2.includes("https://example.com/b.png"));

console.log("selftest ok");
