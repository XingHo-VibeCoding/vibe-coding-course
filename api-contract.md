# api-contract.md｜接口契约（今日热搜）

> 前后端共同遵守的「合同」。改任何接口前先改这里，双方确认后再动代码。
> Day 16–20 新增业务接口时逐个追加到「业务接口」一节。

## 基础信息

- **环境**：腾讯云 CloudBase，环境 ID `hot-search-d0gsdawf8daa02466`（上海）
- **后端接口域名**：`https://hot-search-d0gsdawf8daa02466-1500761802.ap-shanghai.app.tcloudbase.com`
- **前端页面域名**：`https://hot-search-d0gsdawf8daa02466-1500761802.tcloudbaseapp.com`
- **本地开发**：`npx http-server -p 8000 -c-1`（前端 localhost:8000，后端仍在云端）

## 通用约定

1. **响应格式**：所有接口统一返回

   ```json
   {
     "code": 0,
     "message": "ok",
     "data": { ... }
   }
   ```

   - `code: 0` = 成功；非 0 = 失败（具体错误码待 Day 16+ 定义）
   - `message`：人类可读的说明
   - `data`：业务数据，失败时可为 `null`
2. **数据格式**：JSON，UTF-8
3. **鉴权**：现阶段全部免鉴权（公开接口）；Day 16–20 不新增鉴权要求

## 已上线接口

### GET /api/health（Day 15 上线）

健康检查——验证云环境与路由是否存活。

- **用途**：部署后冒烟测试、每天开工先 ping 它
- **入参**：无
- **返回**（200）：

  ```json
  {
     "code": 0,
     "message": "ok",
     "data": {
       "status": "ok",
       "service": "hot-search",
       "time": "2026-10-05T14:03:31.018Z"
     }
  }
  ```

- **字段说明**：

  | 字段 | 类型 | 说明 |
  |---|---|---|
  | `status` | string | 固定 `"ok"`；异常时非 ok |
  | `service` | string | 服务名，固定 `"hot-search"` |
  | `time` | string | ISO 8601 时间戳，**每次请求实时生成**——可用于确认返回非缓存 |

- **验证方式**：浏览器直开公网地址，刷新看 `time` 是否变化

## 业务接口（Day 16–20 追加）

### GET /api/hot（Day 17 上线）

热搜列表——优先返回当日真实热搜，无真实数据时回退示例数据。

- **用途**：首页/列表页数据源
- **入参**：无
- **行为**：
  1. 查 `trends` 表**北京时间当天**的数据，按热度倒序取**前 20 条**
  2. 当天无真实数据（同步未跑/全失败）→ 回退 `hot_items` 示例数据，按热度倒序返回全部
- **返回**（200）：

  ```json
  {
    "code": 0,
    "message": "ok",
    "data": {
      "list": [ { "id": 1, "title": "...", "heat": 9876543, "...": "..." } ]
    }
  }
  ```

- **字段说明**（两个分支字段不同，前端对接时需统一——已知遗留项，见变更记录）：

  | 分支 | 字段 | 说明 |
  |---|---|---|
  | trends（真实数据） | `platform / title / hot / rank / date / fetched_at` | 数据库原始行 |
  | hot_items（回退） | `id / title / summary / category / heat / source / link` | 已映射成前端字段（库里 `url` → 接口 `link`） |

- **错误**（500）：`code:1`，message 带具体数据库错误说明
- **已知限制**：三平台热度量纲不可比（抖音 1200 万级 vs 微博 100 万级），纯热度排序会让单平台霸榜——前端分组展示时再议
- **验证方式**：浏览器直开；改库后重请求看返回变化

### GET /api/favorites（Day 17 上线）

收藏列表——返回 demo 用户收藏的热搜。

- **用途**：收藏页数据源
- **入参**：无
- **行为**：查 `favorites`（`user_id='demo'`）+ `hot_items`，代码里按 `item_id = hot_items.id` 关联，按热度倒序
- **返回**（200）：`data.list` 为条目数组，字段同 /api/hot 的 hot_items 分支（`id/title/summary/category/heat/source/link`）
- **错误**（500）：同上
- **验证方式**：浏览器直开；改 hot_items 热度后收藏内排序跟着变

### POST /api/favorites（Day 18 上线）

新增收藏——demo 用户收藏一条热搜，写入 `favorites` 表。

- **用途**：收藏按钮的写入接口（前端对接在后续天）
- **入参**（JSON 请求体）：

  ```json
  { "item_id": 5 }
  ```

  | 字段 | 类型 | 必填 | 校验规则 |
  |---|---|---|---|
  | `item_id` | 正整数 | 是 | 缺失 / 非数字 / 不存在 / 已收藏 均拒绝，中文提示 |

- **行为**：
  1. 解析并校验请求体（上述四种非法输入逐个拦截，**中文错误提示**）
  2. 查 `hot_items` 确认该 id 存在
  3. 查重（防重复提交第一道）：`user_id='demo'` 且该 `item_id` 已存在 → 409
  4. 写库（第二道防线：数据库 `UNIQUE(user_id,item_id)` 约束，并发漏过查重时由库拒收）
- **返回**（200，成功）——`inserted` 为写入后的完整行：

  ```json
  {
    "code": 0,
    "message": "ok",
    "data": {
      "inserted": { "id": 7, "user_id": "demo", "item_id": 5, "created_at": "2026-10-06T11:46:25.148" }
    }
  }
  ```

  > `id` 由数据库自增生成（IDENTITY），客户端不传。
- **错误**：

  | HTTP | 场景 | message 示例 |
  |---|---|---|
  | 400 | 缺 item_id | `缺少必填字段 item_id（要收藏哪条热搜）` |
  | 400 | 非正整数 | `item_id 必须是正整数数字，收到的是："abc"` |
  | 400 | 热搜不存在 | `没有找到 id 为 999 的热搜，无法收藏` |
  | 409 | 重复收藏 | `这条热搜已经收藏过了，不能重复收藏` |
  | 500 | 写入异常 | `收藏写入异常：...`（带具体原因） |

- **验证方式**：POST 成功后 GET 列表应多一行、SQL 编辑器 `SELECT * FROM favorites` 对得上新增行；同一请求连发两遍第二遍应 409
- **服务端日志**（Day 18 加练）：POST 的拒绝原因和写入结果会记录在云函数日志（`[POST /api/favorites]` 前缀），排查问题用

### POST /api/sync（Day 17 上线，GET 亦可触发）

数据同步——从微博/B站/抖音抓取当日热搜写入 `trends` 表。

- **用途**：手动/定时刷新真实数据（当前仅手动触发）
- **入参**：无
- **行为**：
  1. 三平台**并行**抓取，每平台取**前 30 条**（来源与请求头按附录 F：微博 `data.realtime[].word/num`、B站 `data.trending.list[].keyword/heat_score`、抖音 `data.word_list[].word/hot_value`；均带正常浏览器 UA/Referer，不绕过反爬）
  2. 按 `UNIQUE(platform,title,date)` upsert 写入——重复同步就地更新，**幂等**
  3. 单平台失败不影响其他平台；**三平台全失败**才返回失败（前端拿不到新数据会继续走 /api/hot 的 hot_items 回退）
- **返回**（200，成功）：

  ```json
  {
    "code": 0,
    "message": "ok",
    "data": {
      "date": "2026-10-06",
      "results": [
        { "platform": "weibo", "ok": true, "count": 30 },
        { "platform": "bilibili", "ok": true, "count": 30 },
        { "platform": "douyin", "ok": true, "count": 30 }
      ]
    }
  }
  ```

- **返回**（200，全失败）：`code:1`，message 含各平台失败原因
- **手动触发**：浏览器直开（GET）或程序 POST
- **验证方式**：连打两遍，第二遍仍全 ok 且数据量不涨 = 幂等成立


## 变更记录

| 日期 | 变更 | 操作人 |
|---|---|---|
| 2026-10-05 | 初版：通用约定 + /api/health | Day 15 |
| 2026-10-06 | 新增 GET /api/hot：trends 当日真实数据（热度倒序前 20 条），回退 hot_items 示例数据 | Day 17 |
| 2026-10-06 | 新增 GET /api/favorites：demo 用户收藏列表（热度倒序） | Day 17 |
| 2026-10-06 | 新增 POST /api/sync：三平台并行抓取各前 30 条，UNIQUE upsert 幂等写入 trends | Day 17 |
| 2026-10-06 | 新增 POST /api/favorites：新增收藏（入参校验 + 中文错误提示 + 防重复双保险），favorites 表 id 补装 IDENTITY 自增 | Day 18 |
