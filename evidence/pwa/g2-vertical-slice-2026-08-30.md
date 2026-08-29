# G2 PWA 可信纵向切片证据（2026-08-30）

## 交付范围

- 代表模板：`official.daily_out`、`official.hotel_checkout`、`official.international_travel`、`official.important_medical_visit`。
- 路径：首页直接开始 → 具体 Check Run → 三态项目操作 → 临时项 → 诚实关闭 → History 只读投影。
- 计划路径：创建冻结 Planned Check → 首页提前开始 → `consumed` 与准确 `startedCheckRunId`。
- 数据路径：Dexie/IndexedDB 单快照事务、持久写失败不发布 UI 成功、完整 JSON 备份下载、持久保护状态展示。
- PWA：manifest、提示式更新、Workbox precache、导航 fallback；活跃 Run 不强制刷新。

## 自动测试

| 门禁 | 观测结果 |
|---|---|
| PWA Vitest | 2 文件，6/6 通过 |
| Dexie failure injection | quota/commit 失败后 durable snapshot 与操作前一致 |
| PWA TypeScript | `tsc -p pwa/tsconfig.json --noEmit` 通过 |
| Vite production build | 1948 modules transformed；生成 `dist/sw.js` 与 `dist/workbox-2fbc6a65.js` |
| Workbox precache | 4 entries，493.04 KiB |
| Playwright vertical slice | 通过，801 ms |
| Playwright offline cold start | 通过，1.1 s |
| 根领域回归 | 17 文件，74/74 通过 |
| 官方内容漂移 | Markdown 主源与派生 JSON 一致 |

## Browser / IAB 真实观测

环境：Codex 内置 Chromium 151，生产预览 `http://127.0.0.1:4173/`。

### 390 × 844

- 页面身份：标题“别忘了 · 安心检查”，URL 正确，首页不是空壳，无框架错误覆盖层。
- 控制台：核心流开始前、运行中、关闭后均为 0 error / 0 warning。
- 直接开始“日常出门”后 URL 指向唯一 `run.<uuid>`，不是按模板合并。
- “手机”真实变为 `aria-pressed=true`；“雨伞”真实变为“本次不需要”；“门窗复查”作为临时项加入。
- 普通完成先显示“仍有 11 项未确认，其中 1 项为关键项”；继续“结束并保留”后出现独立“确认仍然结束”二次确认。
- 关闭页与历史页均显示“11 项未确认 · 1 项关键”，History 来自同一 Run 的关闭事件。
- 页面刷新后同一历史仍可见，证明 IndexedDB 数据重新加载成功。

### Service Worker 与离线

- CDP 读取：`hasServiceWorker=true`、`controller=true`、scope 为 `http://127.0.0.1:4173/`、安全上下文为 true。
- 在浏览器网络层切为 offline 后刷新 `/history`，生产 PWA 仍成功冷启动，IndexedDB 历史仍显示，控制台无 error/warning；随后网络状态已恢复。

### 1440 × 900

- 桌面侧栏可见，移动底部导航隐藏；四张代表模板在同一行展示。
- 触控主操作仍保持不小于 44 px，桌面没有依赖 hover 才可完成的操作。

## 视觉概念对照

| 概念关系 | 当前纵切 | 状态 |
|---|---|---|
| 暖白背景、深墨文本、鼠尾草绿主操作、陶土色风险 | 已进入 tokens 与关闭风险面板 | 一致 |
| 移动首页先“继续/接下来/马上开始” | 数据存在时按冻结顺序渲染 | 一致 |
| 运行页高密度清单、独立 `notNeeded` 次操作 | 已实现且浏览器通过 | 一致 |
| Mac 管理型三列信息密度 | 当前只有侧栏 + 内容栅格 | G3 完整管理页补齐 |
| 概念图中的非正式模板名、错误数量、官方删除动作 | 未进入实现 | 有意偏离，以正式主源为准 |

## 当前边界

G2 只证明四模板的可信纵切。全部 13 模板浏览、搜索、个人模板治理、恢复/重置 UI、重开 UI、完整响应式/可访问性矩阵与公开 HTTPS 地址属于接下来的 G3，不在此证据中冒充完成。
