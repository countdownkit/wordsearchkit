// Minimal static file server for local preview of ./public
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "public");
const PORT = 5069; // not 5060-5062 — Chrome blocks those (ERR_UNSAFE_PORT / SIP)
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".xml": "application/xml", ".txt": "text/plain" };

http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split("?")[0]);
  let fp = path.join(ROOT, url);
  if (url.endsWith("/")) fp = path.join(fp, "index.html");
  fs.stat(fp, (err, st) => {
    if (err || !st.isFile()) {
      const alt = path.join(ROOT, url, "index.html");
      return fs.readFile(alt, (e2, buf) => {
        if (e2) { res.writeHead(404); return res.end("Not found"); }
        res.writeHead(200, { "Content-Type": "text/html" }); res.end(buf);
      });
    }
    fs.readFile(fp, (e, buf) => {
      if (e) { res.writeHead(500); return res.end("err"); }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(fp)] || "application/octet-stream" });
      res.end(buf);
    });
  });
}).listen(PORT, () => console.log("preview on http://localhost:" + PORT));
