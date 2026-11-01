# 离散 Trace 契约与回放

适用于迭代法、数组/树/图/矩阵步骤演示。

## Trace 推荐形状

```json
{
  "input": {},
  "seed": 0,
  "steps": [
    {
      "state": {},
      "activeIds": [],
      "codeLine": null,
      "explanation": "",
      "metrics": {}
    }
  ],
  "result": {},
  "termination": { "reason": "max_iter|tol|diverged|done", "detail": "" }
}
```

- `state`：完整快照（无共享可变引用），或可确定重建的检查点。
- 大规模才用增量日志，且必须能可靠回溯重建。
- 图布局坐标单独字段；节点/边/格点用稳定 ID。

## 回放规则

最低操作：**单步、回退、跳转、复位**；播放 = 定时单步。调速只改显示间隔，不改计算结果。

- 参数变化：取消旧播放 → 重新生成 trace → 回到起点。
- seek/next/previous/reset 应暂停播放；到末尾自动停。
- 销毁组件时清理监听、定时器、rAF、过期异步。
- 插值动画不是真实算法中间步；公式/伪代码/高亮与同一 `step` 驱动。

## 数值迭代特别约定

记录：步长/容差含义、残差 vs 真实误差、上限、停止原因。非有限值、发散、退化输入要有明确状态（不要静默 NaN）。

不动点迭代示例指标：`x_n`, `x_{n+1}=g(x_n)`, `|x_{n+1}-x_n|`, 理论 `|g'(x*)|` 与类型标签（动画不代替收敛定理）。

## 本包脚本

`scripts/trace-player.mjs` 提供 `createTracePlayer(steps, { intervalMs })`：

- API：`snapshot`, `seek`, `next`, `previous`, `reset`, `play`, `pause`, `setSpeed`, `advance(dtMs)`
- 历史 `structuredClone` 后冻结；经 snapshot 不可写穿
- **不含**图布局或具体算法

```bash
node --test scripts/trace-player.test.mjs
```

Vue/Canvas/SVG 均可消费；UI 负责 rAF 与可见性暂停。
