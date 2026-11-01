# scripts

| 脚本 | 用法 |
|---|---|
| `new-module.mjs` | `node scripts/new-module.mjs <name> --kind plane2d\|space3d\|trace [--title 标题] [--out 目录] [--inline] [--force]` |
| `lint-module.mjs` | `node scripts/lint-module.mjs <index.html ...> [--json]`，有 error 退出码 1 |
| `check-render.mjs` | `node scripts/check-render.mjs <index.html> [--states states.json] [--state JSON] [--out 目录] [--width 760] [--dpr 2] [--no-click] [--chrome 路径]` |
| `serve.mjs` | `node scripts/serve.mjs [根目录] [--port 5173]` |
| `trace-player.mjs` | 无框架离散回放内核（内核 `createTracePlayer` 同契约） |

states.json 示例：

```json
[
  { "name": "start", "state": { "fn": "cubic", "x0": 3.5, "step": 0 } },
  { "name": "mid",   "state": { "fn": "cubic", "x0": 3.5, "step": 3 } },
  { "name": "degenerate", "state": { "fn": "cubic", "x0": 0.8165, "step": 1 } }
]
```

check-render 依赖：`npm i -D playwright katex && npx playwright install chromium`。装了 katex 时 CDN 请求改走本地，离线可验。环境变量 `CHROME_PATH` / `CHROME_ARGS`（JSON 数组）可指定浏览器。

测试：`npm test`（内核纯函数、回放、lint 规则）。
