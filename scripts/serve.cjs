const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),port=Number(process.env.PORT||8766);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.md':'text/plain; charset=utf-8'};
http.createServer((req,res)=>{
  try{
    const parts=decodeURIComponent(new URL(req.url,'http://local').pathname).split('/');
    if(parts.some(p=>p.startsWith('.')||p==='node_modules')){res.writeHead(403);return res.end('Forbidden');}
    let file=path.join(root,...parts);if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end('Not found');}
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
  }catch{res.writeHead(400);res.end('Bad request');}
}).listen(port,'127.0.0.1',()=>console.log(`正式版 http://127.0.0.1:${port}/\n测试版 http://127.0.0.1:${port}/?test=1`));
