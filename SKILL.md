---
name: visual_content_skill
description: >-
  Build MathAPP-embedded interactive math visualizations (function plots,
  tangent/area demos, 3D vectors, cross/triple products, iteration and
  algorithm step-through) with a bundled runtime kit, a one-command scaffolder,
  a rule linter and a headless render check for label occlusion. Use when
  adding or extending browser math visuals for D:\MathAPP, or a self-contained
  demo that must look like an in-site module.
---

# MathAPP 可视化制作 Skill

面向 `D:\MathAPP`（Django + Vue 3/Vite + KaTeX）的课程内交互模块。本包自带可执行工具链，**先跑命令，再查文档**。本包自包含，不路由到其他 skill。

## 包里有什么

| 路径 | 作用 |
|---|---|
| `lib/mathviz-kit.js` | 运行时内核：figureTheme、HiDPI 画布、自适应函数采样（自动在间断/渐近线处断开）、三维轨道相机、**KaTeX 标签自动避让**、rAF 动画（隐藏页暂停、尊重减少动态）、离散回放、薄控件条、统一销毁 |
| `templates/{plane2d,space3d,trace}.html` | 三种骨架，开箱即合规；`templates/previews/` 有效果图 |
| `scripts/new-module.mjs` | 脚手架：一条命令生成模块 + 预填规格 |
| `scripts/lint-module.mjs` | 静态检查：把下方硬约束变成规则（色板、渐变阴影、DPR、纯文本公式、setInterval、监听泄漏、控件数、Math.random…） |
| `scripts/check-render.mjs` | 真浏览器验收：固定状态截图、标签遮挡、DPR、KaTeX 错误、控制台报错、点控件冒烟 |
| `scripts/serve.mjs` | 零依赖预览服务器（浏览器禁止 file:// 下的 ES module 导入） |
| `references/kit-api.md` | 内核 API 速查（写模块时只需读这一份） |
| `references/*.md` | 规范细节：工作流、视觉工艺、本站约定、验收清单、离散 trace 契约 |

## 标准流程（每次）

```bash
# 1. 选骨架生成（plane2d 连续参数平面图 / space3d 小型三维 / trace 离散过程回放）
node scripts/new-module.mjs newton-method --kind trace --title 牛顿迭代
# 2. 填 examples/newton-method/module-spec.md：唯一教学目标 + 信息清单
# 3. 只改 index.html 的「数学层」「状态层」和 onDraw；外壳、主题、标签避让、清理已就绪
node scripts/serve.mjs            # 浏览器打开 http://127.0.0.1:5173/examples/newton-method/
# 4. 静态规则
node scripts/lint-module.mjs examples/newton-method/index.html
# 5. 渲染验收：写 states.json 覆盖首态/中间态/末态/退化输入
node scripts/check-render.mjs examples/newton-method/index.html --states states.json
# 6. 数学独立验算（Node 里直接调纯函数），归档截图与规格
```

单文件分享或贴进别处原型：`new-module.mjs ... --inline`（内核内联，双击即开）。
内核单测：`npm test`。check-render 需要 `npm i -D playwright katex && npx playwright install chromium`（装了 katex 就离线可验；也可 `--chrome <路径>` 用本机 Chrome）。

判断标准：lint 0 error、check-render 全过、数学验算有记录，才算交付。lint 的 warn 要么修，要么在 module-spec 的「未验证项」里写明理由。

## 硬约束（lint / check-render 能自动查的标了 ⚙）

1. 嵌入优先：按课程 `@interactive` / `@aside` / numerical 设计；独立 HTML 也必须长得像站内模块。
2. ⚙ 只用 figureTheme（`MV.THEME`、`MV.ROLE`、`MV.alpha`）；禁止渐变底、厚阴影、发光、彩虹、营销大标题、badge。
3. ⚙ 简约：模式 + ≤2 参数 + 复位（需要时单步/播放）；公式一行、读数一行；不写说明墙和"演示中/anim%"类状态废话。
4. ⚙ 数学符号一律 KaTeX：`fig.formula` / `fig.readout` / `fig.label` / `MV.slider({label})` 全走 TeX；禁止 `fillText('|a×b|')` 这类纯文本冒充。
5. ⚙ 标签不得遮挡关键几何：画面元素用 `fig.curve/polygon/arrow/point/polyline` 绘制即自动登记为保护区，`fig.label` 自动避让；次要标注加 `optional: true`，放不下就省略。
6. ⚙ 清晰与动效：DPR 由内核处理；动画只用 `MV.createAnimator`（rAF、可打断、后台暂停）；生长用 ease-out；不用 setInterval。
7. 五层职责：数学 → 状态 → 场景 → 呈现 → 验收。渲染只读状态；相机旋转 ≠ 几何变换；插值动画不伪造中间计算结果。
8. 教学可暂停：单步、回退、复位；播放 = 定时单步；参数一变就取消播放并重建（trace 模板已示范）。
9. ⚙ 可复现：随机用 `MV.rng(seed)`；模块调用 `MV.expose(fig, { getState, setState })`，验收用固定状态截图。
10. 数学独立检查：动画不是证明；近似须标明（Simpson ≠ 精确；有限采样 ≠ 严格确界；共线/共面退化不能出 NaN）。
11. 修改范围：默认不改 `D:\MathAPP` 业务代码；接入时按 配置 → 局部组件 → 适配器 三档（见 `references/mathapp-conventions.md`）。
12. 默认交付浏览器 SVG/Canvas 交互；Manim/Remotion 仅作可选离线视频，独立工程。

## 路由

| 任务 | 骨架 | 还要读 |
|---|---|---|
| 函数、切线、区域、参数族、黎曼和类 | `plane2d` | kit-api、visual-craft §A–F |
| 向量、叉乘、混合积、投影、平面与立体 | `space3d` | kit-api、visual-craft §J |
| 迭代法、算法步骤、离散过程 | `trace` | algorithm-trace |
| 接入 numerical / Vue | 任意 | mathapp-conventions「独立 Demo → 日后接入」 |

新模块默认生成在 `examples/<name>/`。
