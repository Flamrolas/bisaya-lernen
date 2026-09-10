const fs = require("fs");
let html = fs.readFileSync("index.html", "utf8");
html = html.replace(/<!--[\s\S]*?-->/g, "");
const scriptRe = /<script(\b[^>]*)>([\s\S]*?)<\/script>/g;
let m, ok = true, n = 0;
while ((m = scriptRe.exec(html))) {
  const attrs = m[1] || "";
  if (/type\s*=\s*["']module["']/.test(attrs)) continue;
  if (/\bsrc\s*=/.test(attrs)) continue;
  const body = m[2];
  n++;
  try {
    new Function(body);
  } catch (e) {
    ok = false;
    console.log("SYNTAX ERROR in script block", n, ":", e.message);
  }
}
console.log("checked", n, "inline script blocks, ok =", ok);
