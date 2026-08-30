# G4 微信原生纵向切片证据（2026-08-30）

## 实际范围

- 原生工程：`miniprogram/`，WXML / WXSS / JavaScript，不含 `web-view`。
- 原生页面：首页、本次检查、计划、历史、数据与备份。
- 代表模板：
  - `official.daily_out`
  - `official.hotel_checkout`
  - `official.international_travel`
  - `official.important_medical_visit`
- 微信派生内容仍由冻结 Markdown 主源确定性生成，包含完整 13 模板 / 244 项；G4 首页只投影四个代表场景。

## 数据语义审计

### Durable commit

`WechatDurableStore.commit(next)` 的真实顺序：

1. 对候选快照执行严格 schema 与业务不变量校验；
2. 读取活动指针；
3. 写入非活动槽；
4. 回读该槽、再次校验并逐字段比对；
5. 只有全部成功才切换活动指针。

故障注入已覆盖：非活动槽写失败、回读中断、指针切换失败、活动槽损坏回退、无效候选前置拒绝。服务层只在 commit 完成后替换内存事实并通知页面；失败时旧内存事实和旧活动槽都保持不变。

### 跨端差分

四个代表模板分别执行同一组 PWA/shared-domain 与微信 native-domain 操作，并要求完整对象相等：

- Run Snapshot；
- confirmed / notNeeded；
- oneTimeNote；
- 本次临时项；
- 正常完成拒绝分支；
- 关键未确认二次确认分支；
- completed / endedWithUnresolved / discarded；
- 2 小时内重开与窗口外拒绝；
- Planned Snapshot 创建、消费、取消；
- Backup Envelope 导出与严格恢复候选校验。

审计中真实发现并修复：

1. 微信重开窗口误为 24 小时，已改为冻结参数 2 小时并用边界差分测试锁定；
2. 微信超长本次备注曾静默截到 500 字，已改为整次提交拒绝且旧事实不变；
3. 微信快照校验过宽，已补齐严格字段、嵌套类型、日期时间、未知字段和业务引用校验；
4. 微信计划排序已与 shared domain 的日期、可选时间、创建时间、计划 ID 顺序一致；
5. 日历适配曾传字符串时间，已按官方合同改为本地墙钟对应的 Unix 秒数。

## 当日官方能力核验

- [`wx.setStorage`](https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.setStorage.html)：异步回调可观测成功/失败；官方页面说明单 key 1 MB、总计 10 MB。超过宿主限制时本应用明确报保存失败，不切换活动指针。
- [`wx.addPhoneCalendar`](https://developers.weixin.qq.com/miniprogram/dev/api/device/calendar/wx.addPhoneCalendar.html)：基础库 2.15.0 起支持，需要 `scope.addPhoneCalendar`；`startTime` 是自 Unix epoch 起的秒数。适配层做能力检测、合法本地日期校验和秒数转换，失败不影响已提交的本地计划。
- [`wx.shareFileMessage`](https://developers.weixin.qq.com/miniprogram/dev/api/share/wx.shareFileMessage.html)：基础库 2.16.1 起支持，`filePath` 必须是本地或临时路径。备份先写入 `wx.env.USER_DATA_PATH`，再调用原生文件分享；不可用时明确退化为复制完整备份。
- [微信开发者工具下载](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)：官方入口可从本机访问，但当前机器尚未安装微信开发者工具，因此本证据不声称已完成官方工具编译、扫码预览或真机验收。
- 微信订阅消息保持 `unavailable`；没有模板、账号后台与可靠链路时不显示为已配置。

## 可复现门禁

```text
pnpm vitest run tests/miniprogram tests/conformance
  6 files passed, 33 tests passed

pnpm content:check
  PWA JSON and WeChat CommonJS derived assets match the frozen Markdown source

pnpm test
  22 files passed, 106 tests passed

pnpm typecheck
  passed

find miniprogram -name '*.js' -print0 | xargs -0 -n1 node --check
  passed

pnpm build
  PWA production build passed
```

## 当前真实阶段

G4 的本地 Node 合同、差分语义、故障恢复、原生页面与静态结构门禁完成。尚未完成的真实外部阶段是：微信开发者工具编译、有效 AppID、管理员扫码、真机预览、体验版与审核链；这些属于 G5，不能由本地测试冒充。
