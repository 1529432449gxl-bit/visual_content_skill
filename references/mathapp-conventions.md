# MathAPP 约定与接口

工作副本：`D:\MathAPP`。本文件写死复用规则；源码变动后以工作副本为准。

## 技术栈

Django 后端 + Vue 3/Vite 前端 + KaTeX。前端有 Vitest / Playwright。启动见项目根 `agent.md` / `启动网站.bat`。

## 视觉主题（figureTheme）

取自 `frontend/src/utils/figureTheme.js`：

| 角色 | 色值 |
|---|---|
| 墨色文字/线 | `#16201a` |
| 软墨 | `#4f5b54` |
| 主色墨绿 | `#245443` / 加深 `#173f31` |
| 强调暖棕 | `#b5763a` |
| 次要 | `#7a847e` |
| 网格/分割线 | `#c9d1cc` / `#e3e8e4` |
| 画板底 | `#f2f5f3` / 纸色 `#fcfdfc` |
| 额外命名 | sand `#d9c08f`, blue `#3f6e8c`, red `#a4493f` |

字体：刻度等宽 9px（JetBrains Mono/Consolas）；轴名斜体衬线 12px（Times / STIX）。曲线宽约 1.6。曲面色带：深墨绿 → 浅灰绿 → 浅沙（单色调，不用彩虹）。

教学图避免无关粒子、镜头抖动、装饰性特效。清晰度/采样/缓动见 `visual-craft.md`。

## 嵌入本站：外壳与信息密度（强制）

本 skill 产出的模块最终要进课程页。agent 必须：

1. **复用本站外壳**：优先对齐 `RiemannSum` / `DarbouxSum` / `NumericalFigure` / `SpaceFigure` 的控件密度——图为主，底下一行参数/操作，读数短。
2. **只用 figureTheme**（上表）。禁止另起高对比仪表盘、霓虹、厚阴影卡片墙、营销 badge、页面级装饰光斑。
3. **信息克制**：课程正文已承担讲解；模块内不要重复长说明。默认：模式/参数 + 图 + **至多一行**关键量。详细 readout 可折叠或仅独立调试页开启。
4. **控件少而够用**：常见为选项、少量滑块/数值、复位（+ 单步/播放若需要）。不要堆「演示状态」「anim%」等琐碎标签。
5. **独立 HTML 原型**也须长得像站内模块（见下节与 `visual-craft.md` §0）。

## 嵌入页 vs 独立 Demo

| | 嵌入页（默认交付、进站目标） | 独立 Demo（调试 / 录屏） |
|---|---|---|
| 路径形态 | Vue 组件或日后 `@interactive` / `@aside` | `examples/.../index.html` |
| 视觉 | 与课程栏同宽气质；细边、浅底 | 同色板；可略宽边距 |
| 文案 | 无说明墙；一行公式 | 可加一句边界提示 |
| 读数 | 一行或折叠 | 可展开 |
| 三维 | 拖旋转 + 复位，对齐 SpaceFigure | 可加调试轴/线框开关 |
| 验收 | **必须过嵌入简约清单** | 不得替代嵌入验收 |

独立 Demo → 接入步骤见文末；**不要**把调试壳直接当站内 UI。

## 优先复用资产

| 路径 | 用途 |
|---|---|
| `components/interactive/RiemannSum.vue` | 多阶段教学、SVG、公式同步 |
| `components/interactive/DarbouxSum.vue` | 同一交互外壳 |
| `components/lesson/aside/SpaceFigure.vue` | 三维容器：拖动、键盘、复位、自转、清理 |
| `utils/space3d.js` | Canvas 软件三维（嵌入默认优先） |
| `utils/plane2d.js`, `asideSpec.js`, `mathExpr.js` | 平面图与配置 |
| `utils/figureTheme.js` | 色与字体 |
| `utils/numerical/index.js` | 数值插图注册 |
| `utils/numerical/math.js`, `figures/`, `numerical.test.js` | 数值与验收范式 |
| `docs/TEMPLATE_GUIDE.md` | `@interactive` / `@aside` 配置 |

三维扩展：先评估 space3d；不够再用 Three.js 适配器（CDN 原型可，色板仍锁主题）。

## numerical 注册口

```
{ id, title, desc?, note?, legend?,
  params: [{ key, label, min, max, step, value }],
  options?: { label, items, value },
  play?: 'paramKey',
  render(state, { small }) -> { svg, readout } }
```

- 配置 `value` / `value2` → 第一/二个滑块；`option` → 方案。
- 新增算法优先按此接口；改契约前检查 `NumericalFigure` 与课程配置。

## 三档修改范围

1. **配置**：已有能力能表达 → 只改 `.math.md`。
2. **局部**：缺一种呈现 → 新组件或 `figures/chN.js`，复用主题与外壳。
3. **适配器**：缺底层能力 → 独立封装再接入；不替换已有优秀模块。

Vue：`mounted` 初始化，`watch` 更新，`beforeUnmount` 销毁事件/观察器/动画/WebGL。

**本 skill 默认任务不要改 `D:\MathAPP` 业务代码**，除非用户明确要求接入。

## 数学边界（文案与验收必须遵守）

- Riemann/Darboux 的 “exact” 实为 Simpson 数值参考，勿称符号精确。
- 达布有限采样 ≠ 任意函数严格上下确界。
- 随机分割未必嵌套 → 不能普遍断言上下和单调。
- space3d 平均深度排序对复杂透明相交有限；轴显示比例有下限。
- 迭代须区分残差 / 估计误差 / 真实误差；发散也要可观察。
- 叉乘/混合积：共线或共面时面积/体积为 0，界面应稳定而非 NaN。
- 截图不能赋予纯文本模型视觉能力；Canvas 正确性不能只靠 DOM 树。

## 独立 Demo → 日后接入

0. 独立页默认用**嵌入风格**（简约控件、无营销头）；完整调试 UI 可另存。
1. 在独立 HTML/模块内先验证数学与交互。
2. 把 `render(state)` 抽成纯函数（或场景更新函数），输出与 readout 分离。
3. 二维 numerical：按注册口写入 `figures/chN.js`；三维：优先 SpaceFigure / space3d 组件化。
4. 课程正文用 `@interactive` / `@aside` 引用。
5. 跑相关 Vitest；需要时补 Playwright 固定状态截图。
