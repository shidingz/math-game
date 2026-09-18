#!/usr/bin/env node
'use strict';
// Builds the actual Canvas client with browser APIs. WeChat preview shims and
// project metadata are deliberately not copied into the publishable website.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
function argument(args, name) { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; }
function bundle(modules) {
  return "'use strict';\n(()=>{\nconst modules={\n" + Object.entries(modules).map(([id, source]) => JSON.stringify(id) + ':function(require,module,exports){\n' + source + '\n}').join(',\n') + "\n};\nconst cache={};\nfunction resolve(id,from){const parts=(id[0]==='.'?from.split('/').slice(0,-1).join('/')+'/'+id:id).split('/'),out=[];for(const p of parts){if(p==='..')out.pop();else if(p&&p!=='.')out.push(p);}return out.join('/').replace(/\\.js$/,'');}\nfunction load(id,from=''){id=resolve(id,from);if(cache[id])return cache[id].exports;if(!modules[id])throw Error('Missing module '+id);const m=cache[id]={exports:{}};modules[id](request=>load(request,id),m,m.exports);return m.exports;}\nload('browser/main');\n})();\n";
}
function build(args = process.argv.slice(2)) {
  const input = argument(args, '--from'), output = argument(args, '--out');
  if (!input || !output || args.includes('--help')) throw Error('用法：node scripts/build-web-game.cjs --from <微信导出目录> --out <网站目录> [--test --test-default] [--service-url https://…] [--public-config public-url.json]');
  const source = path.resolve(input), out = path.resolve(output);
  if (out === ROOT || out === source || ROOT.startsWith(out + path.sep) || source.startsWith(out + path.sep) || out.startsWith(source + path.sep)) throw Error('输出目录不得覆盖源码或嵌套微信导出目录');
  if (!fs.existsSync(path.join(source, 'runtime/main.js')) || !fs.existsSync(path.join(source, 'config.js'))) throw Error('请先使用 build-wechat 导出完整运行素材');
  const baseConfig = require(path.join(source, 'config.js'));
  const publicFile = argument(args, '--public-config');
  const publicConfig = publicFile ? JSON.parse(fs.readFileSync(path.resolve(publicFile), 'utf8')) : {};
  if (Object.keys(publicConfig).some(key => !['baseUrl','assetHosts'].includes(key))) throw Error('公开配置仅允许 baseUrl 和 assetHosts，不得包含凭据');
  const { normalizeBase } = require('../wechat/browser/connection');
  const baseUrl = normalizeBase(argument(args, '--service-url') ?? publicConfig.baseUrl ?? '', true);
  if (publicConfig.assetHosts !== undefined && !Array.isArray(publicConfig.assetHosts)) throw Error('assetHosts 必须为域名列表');
  const hosts = [...new Set([...(publicConfig.assetHosts || []), ...(baseUrl ? [new URL(baseUrl).hostname] : [])])];
  if (hosts.some(host => typeof host !== 'string' || !/^[a-z0-9.-]+$/i.test(host))) throw Error('assetHosts 必须为域名列表');
  const config = { assetVersion: baseConfig.assetVersion, debug: args.includes('--test'), testDefault: args.includes('--test') && args.includes('--test-default'), customPets: { baseUrl, assetHosts: hosts } };
  const modules = {};
  for (const folder of ['runtime','shared','data']) for (const file of fs.readdirSync(path.join(source, folder))) {
    if (file.endsWith('.js')) modules[folder + '/' + file.slice(0,-3)] = fs.readFileSync(path.join(source, folder, file), 'utf8');
  }
  for (const file of fs.readdirSync(path.join(ROOT, 'wechat/browser'))) if (file.endsWith('.js')) modules['browser/' + file.slice(0,-3)] = fs.readFileSync(path.join(ROOT, 'wechat/browser', file), 'utf8');
  modules.config = 'module.exports=' + JSON.stringify(config) + ';';
  const script = bundle(modules), hash = crypto.createHash('sha256').update(script).digest('hex');
  fs.mkdirSync(out, { recursive: true });
  // Only replace our own generated asset folders; arbitrary output files remain.
  for (const folder of ['pets','portraits','world-art','custom-assets']) {
    const src = path.join(source, folder), dst = path.join(out, folder);
    if (fs.existsSync(dst) && !fs.existsSync(path.join(out, 'web-build.json'))) throw Error('输出目录已有素材但不是 Web 构建，请使用空目录');
    if (fs.existsSync(dst)) fs.rmSync(dst, { recursive: true });
    if (fs.existsSync(src)) fs.cpSync(src, dst, { recursive: true });
  }
  fs.writeFileSync(path.join(out, 'web-runtime.js'), script);
  fs.writeFileSync(path.join(out, 'index.html'), fs.readFileSync(path.join(ROOT, 'wechat/browser/index.html'), 'utf8').replace('__BUILD_VERSION__', hash.slice(0,16)));
  fs.writeFileSync(path.join(out, '.nojekyll'), '');
  const manifest = { format: 'math-pet-browser-v1', createdAt: new Date().toISOString(), bundleSha256: hash,
    debug: config.debug, testDefault: config.testDefault, customPets: config.customPets, assetVersion: config.assetVersion };
  fs.writeFileSync(path.join(out, 'web-build.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ output: path.relative(ROOT, out), modules: Object.keys(modules).length, ...manifest }, null, 2));
  return manifest;
}
if (require.main === module) { try { build(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { build, bundle };
