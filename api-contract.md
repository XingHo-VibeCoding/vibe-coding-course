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

暂无。计划中：热搜列表、详情、收藏等，届时逐个补全「路径 / 入参 / 返回 / 错误码」。

## 变更记录

| 日期 | 变更 | 操作人 |
|---|---|---|
| 2026-10-05 | 初版：通用约定 + /api/health | Day 15 |
