import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=new URL('./',import.meta.url);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8'};
const files=new Set(['index.html','styles.css','app.mjs','core.mjs','receiver-worklet.mjs','tone-detector.mjs']);
const port=Number(process.env.PORT || 5173);
http.createServer(async(req,res)=>{
  try {
    const pathname=new URL(req.url,'http://localhost').pathname;
    const name=pathname==='/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
    if (!files.has(name)) { res.writeHead(404); res.end('Not found'); return; }
    const data=await readFile(new URL(name,root));
    res.writeHead(200,{'Content-Type':types[name.slice(name.lastIndexOf('.'))], 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'});
    res.end(data);
  } catch { res.writeHead(500); res.end('Unable to load page'); }
}).listen(port,'127.0.0.1',()=>console.log(`Morse Transfer: http://localhost:${port}\nFolder: ${fileURLToPath(root)}`));
