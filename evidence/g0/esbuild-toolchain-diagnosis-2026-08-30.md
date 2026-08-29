# esbuild / Vite 工具链诊断（2026-08-30）

## 现象

在 bundled Node 进入 PATH 后，直接运行：

```text
pnpm exec esbuild --version
```

会让 Node 尝试解析 Mach-O 二进制，并以 `SyntaxError: Invalid or unexpected token` 退出。

## 根因证据

1. `node_modules/.bin/esbuild` 是 pnpm 生成的 POSIX shell shim；其第三分支固定执行 `node <esbuild/bin/esbuild>`。
2. `esbuild@0.28.2/install.js` 的 `maybeOptimizePackage()` 在非 Windows、非 Yarn 环境会把 `esbuild/bin/esbuild` 替换为原生二进制硬链接。
3. 替换后的目标经 `file` 识别为 `Mach-O 64-bit executable arm64`，直接执行返回 `0.28.2`。
4. 因此错误发生在“pnpm 安装前生成的 Node shim”与“postinstall 后变成原生目标”的边界，不是二进制损坏。

## 最小假设验证

- 直接原生二进制：成功，版本 `0.28.2`。
- `esbuild/lib/main.js` 的 `transform()`：成功把 TypeScript `const answer: number = 42` 转成 JavaScript。
- Vitest/Vite 转换：成功。
- PWA 生产构建：Vite 8.2.2 实际转换 1948 个模块并生成生产 bundle。

## 处理

- 不修改或提交 `node_modules` 内的临时 shim。
- 工程脚本不直接依赖 `pnpm exec esbuild`；Vite/tsx/Vitest 使用已验证的 esbuild JS API。
- 后续以真实 `pnpm --filter @biewangle/pwa build` 为工具链门禁。
- PWA 构建随后暴露的 `workbox-window` 解析错误属于另一个边界：`vite-plugin-pwa` 的虚拟模块从应用根解析其 peer。把插件声明的 `workbox-window@7.4.1` 加为 PWA 直接依赖后，生产构建通过。
