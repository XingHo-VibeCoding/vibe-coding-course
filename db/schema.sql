-- ============================================================
-- schema.sql｜「今日热搜」数据库建表脚本（Day 16）
-- 数据库：CloudBase PostgreSQL（环境 hot-search-d0gsdawf8daa02466）
-- 用法：在 CloudBase 控制台「数据库」的 SQL 窗口整段执行
-- 幂等：可重复执行——表已存在时先删再建（DROP TABLE IF EXISTS）
-- 注意：DROP 会清掉表内数据，重跑本脚本后请接着执行 seed.sql 重新灌数据
-- ============================================================

-- 表一：热搜表——存每条热搜本身（对应前端 data.js 的 HOT_LIST）
DROP TABLE IF EXISTS favorites;   -- 先删收藏表：它引用 hot_items，必须先删（顺序不能反）
DROP TABLE IF EXISTS hot_items;

CREATE TABLE hot_items (
  id          INTEGER PRIMARY KEY,            -- 主键：唯一编号，与前端 ?id= 对应
  title       TEXT NOT NULL,                  -- 标题：必填，长度不定故用 TEXT
  summary     TEXT,                           -- 摘要：可空（有的热搜可能没有摘要）
  category    TEXT NOT NULL,                  -- 分类：科技/娱乐/财经，仅 3 个固定值
  heat        INTEGER NOT NULL,               -- 热度：整数（如 4986234），无小数需求
  source      TEXT,                           -- 来源媒体名（如「科技日报」）
  url         TEXT,                           -- 原文链接
  created_at  TIMESTAMP DEFAULT now()         -- 入库时间：排序与排查用
);

-- 表二：收藏表——存「谁(user_id)收藏了哪条(item_id)」的行为记录
-- 对应前端 localStorage 的 favorites 键；Day 17+ 的收藏接口读写这里
CREATE TABLE favorites (
  id          INTEGER PRIMARY KEY,            -- 收藏记录自己的编号
  user_id     TEXT NOT NULL DEFAULT 'demo',   -- 拍板甲：预留用户字段，现阶段统一 'demo'
  item_id     INTEGER NOT NULL,               -- ★关联字段：指向 hot_items.id
  created_at  TIMESTAMP DEFAULT now(),        -- 收藏时间
  -- 同一用户对同一条热搜只许收藏一次（防连点出重复记录）
  UNIQUE (user_id, item_id)
);
