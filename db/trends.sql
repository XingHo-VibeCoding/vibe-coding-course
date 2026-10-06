-- trends.sql｜热搜趋势表（Day 17 板块②）
-- 存每天从微博 / B站 / 抖音抓取的真实热搜，/api/hot 优先读取。
-- 与 schema.sql 的关系：hot_items 存示例数据（回退用），trends 存真实数据（主用）。

CREATE TABLE trends (
  id BIGSERIAL PRIMARY KEY,                       -- 自增主键
  platform VARCHAR(16) NOT NULL,                  -- 平台：weibo / bilibili / douyin
  title TEXT NOT NULL,                            -- 热搜标题
  hot BIGINT NOT NULL DEFAULT 0,                  -- 热度值（各平台量纲不同，只用于排序）
  rank INT NOT NULL,                              -- 该平台上的排名（1 = 榜首）
  date DATE NOT NULL,                             -- 北京时间日期，按天查询用
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),  -- 抓取时间
  -- 判重：同平台同标题同一天只留一行。
  -- /api/sync 的 upsert 靠它实现幂等（重复同步就地更新，不堆重复数据）。
  UNIQUE (platform, title, date)
);

-- 按日期查的索引：/api/hot 每次都查「今天」，走这个索引快。
CREATE INDEX idx_trends_date ON trends(date);
