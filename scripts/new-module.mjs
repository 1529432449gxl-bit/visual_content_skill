#!/usr/bin/env node
// 脚手架：一条命令生成可运行、已符合嵌入档规范的模块骨架 + 预填规格
//   node scripts/new-module.mjs <name> --kind plane2d|space3d|trace [--title 标题] [--out 目录] [--inline]
// --inline：把 lib/mathviz-kit.js 内联进 HTML，得到单文件（发给别人、贴进 Obsidian/aside 原型都方便）
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KINDS = {
  plane2d: '连续参数平面图（函数、切线、区域、参数族）',
  space3d: '小型三维（向量、叉乘、投影、平面、立体）',
  trace: '离散过程回放（迭代法、算法步骤，带单步/回退/播放）',
};

function parse(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; o[k] = v; }
    else o._.push(a);
  }
  return o;
}
const args = parse(process.argv.slice(2));
const name = args._[0];
if (!name || args.help) {
  console.log(`用法: node scripts/new-module.mjs <name> --kind <${Object.keys(KINDS).join('|')}> [--title 标题] [--out 目录] [--inline]\n`);
  for (const [k, v] of Object.entries(KINDS)) console.log(`  ${k.padEnd(8)} ${v}`);
  process.exit(name ? 0 : 1);
}
if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) { console.error('name 只用小写字母、数字、连字符，例如 newton-method'); process.exit(1); }
const kind = args.kind || 'plane2d';
if (!KINDS[kind]) { console.error(`未知 --kind ${kind}，可选：${Object.keys(KINDS).join(', ')}`); process.exit(1); }

const outDir = resolve(args.out || join(ROOT, 'examples', name));
if (existsSync(join(outDir, 'index.html')) && !args.force) { console.error(`${outDir}${sep}index.html 已存在（加 --force 覆盖）`); process.exit(1); }
mkdirSync(outDir, { recursive: true });

const kitPath = join(ROOT, 'lib', 'mathviz-kit.js');
let html = readFileSync(join(ROOT, 'templates', `${kind}.html`), 'utf8')
  .replaceAll('{{TITLE}}', args.title || name)
  .replaceAll('{{NAME}}', name);

if (args.inline) {
  const b64 = Buffer.from(readFileSync(kitPath, 'utf8')).toString('base64');
  html = html.replace(/import \* as MV from '\{\{KIT\}\}';/, `const MV = await import('data:text/javascript;base64,${b64}');`);
} else {
  let rel = relative(outDir, kitPath).split(sep).join('/');
  if (!rel.startsWith('.')) rel = './' + rel;
  html = html.replaceAll('{{KIT}}', rel);
}
writeFileSync(join(outDir, 'index.html'), html);

const spec = readFileSync(join(ROOT, 'templates', 'module-spec.md'), 'utf8')
  .replace('# 新模块规格', `# 模块规格：${args.title || name}`)
  .replace('- **嵌入形式**：', `- 骨架类型：${kind}（${KINDS[kind]}）\n- **嵌入形式**：`);
if (!existsSync(join(outDir, 'module-spec.md'))) writeFileSync(join(outDir, 'module-spec.md'), spec);

const relOut = relative(process.cwd(), outDir) || '.';
console.log(`已生成 ${relOut}/index.html（${kind}）与 module-spec.md
下一步：
  1. 填 module-spec.md 的教学目标与信息清单
  2. 改 index.html 的「数学层」与 onDraw；控件、主题、标签避让、DPR、清理已就绪
  3. node scripts/lint-module.mjs ${relOut}/index.html
  4. node scripts/check-render.mjs ${relOut}/index.html     （截图 + 遮挡检测）`);
