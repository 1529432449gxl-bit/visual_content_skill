# 来源与许可要点

本 skill 整合自用户桌面「特效工作流」研究包（2026-10-30）与 `D:\MathAPP` 现有约定，**不内嵌上游完整仓库**。

## 本站

- MathAPP：`figureTheme`、`plane2d`/`space3d`、`numerical` 注册口、RiemannSum/DarbouxSum/SpaceFigure 质量基准。版权归项目所有者。

## 上游研究输入（写作时参考，未整包拷贝）

| 项目 | 用途摘取 | 许可需自行核对 |
|---|---|---|
| Manim Community / manim_skill | 离线视频路线短说明 | Manim CE 文档与仓库 LICENSE |
| threejs-skills / Three.js | 复杂 3D 扩展边界说明 | MIT（Three.js）等 |
| remotion-dev/skills | 独立视频工程边界；运行时许可另查 remotion.dev/docs/license | 技能文档 ≠ 运行时许可 |
| JSXGraph, Cytoscape.js, MathBox | 扩展引擎候选名 | 各自仓库 LICENSE |
| K-Dense scientific-agent-skills（SymPy/NetworkX/Matplotlib 部分） | 离线验算可选 | 上游 LICENSE |
| microsoft/playwright-cli | 浏览器验收思路 | 上游 LICENSE |

## 本包原创/改编

- `lib/mathviz-kit.js`：运行时内核（2026-11-01），由两个案例中的投影、箭头、标签避让、动画代码抽取并重写为通用库，含单测。
- `templates/*.html`、`scripts/new-module.mjs`、`scripts/lint-module.mjs`、`scripts/check-render.mjs`、`scripts/serve.mjs`：工具链（2026-11-01）。

- `scripts/trace-player.mjs`：无框架离散回放内核（自研究包 toolkit 精简纳入）。
- `references/*`、`SKILL.md`：整合后的操作规范，非上游原文搬运。
