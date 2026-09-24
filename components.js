// ============================================================
// components.js —— 可复用 UI 组件（Day 8 余力加练）
// 「组件」= 一块能反复使用的页面积木：喂它数据，它还你 DOM。
// 本文件不关心数据从哪来（data.js）、也不关心页面怎么编排（main.js），
// 只负责「把一条热搜画成什么样」。
// 依赖：无（只用 document.createElement，谁都能调用它）
// ============================================================

"use strict";

// ---------- 工具：按热度生成火焰标识 ----------

function heatToFire(heat) {
  if (heat >= 8000000) return "🔥🔥🔥";
  if (heat >= 6000000) return "🔥🔥";
  return "🔥";
}

// ---------- 组件 1：HotCard（单条热搜卡片） ----------
//
// 用法：
//   createHotCard(item)              → 不带序号（收藏区用这种）
//   createHotCard(item, { rank: 2 }) → 带序号 2，前三名红底高亮（榜单用）
//
// item：一条热搜数据（7 字段）
// options.rank：序号数字；不传或传 0 表示不显示序号

function createHotCard(item, options) {
  options = options || {};
  var rank = options.rank || 0;

  var li = document.createElement("li");
  li.className = "hot-item";

  // 序号标（传了才渲染；前三名红底高亮）
  if (rank > 0) {
    var rankEl = document.createElement("span");
    rankEl.className = "item-rank" + (rank <= 3 ? " top" : "");
    rankEl.textContent = String(rank);
    li.appendChild(rankEl);
  }

  // 标题：整条可点，跳详情页（id 走网址参数）
  var a = document.createElement("a");
  a.className = "item-title";
  a.href = "detail.html?id=" + encodeURIComponent(item.id);
  a.textContent = item.title;
  li.appendChild(a);

  // 来源
  var src = document.createElement("span");
  src.className = "item-source";
  src.textContent = item.source;
  li.appendChild(src);

  // 热度（火焰标识，悬停看具体数字）
  var heat = document.createElement("span");
  heat.className = "item-heat";
  heat.textContent = heatToFire(item.heat);
  heat.title = "热度 " + item.heat;
  li.appendChild(heat);

  return li;
}

// ---------- 组件 2：CardList（卡片列表） ----------
//
// 用法：
//   createCardList(items, { ranked: true }) → 带排名 1..n 的榜单列表
//   createCardList(items)                   → 不带序号的普通列表
//
// 返回一个 <ul class="hot-list">，里面每条是一个 HotCard

function createCardList(items, options) {
  options = options || {};
  var ranked = !!options.ranked;

  var ul = document.createElement("ul");
  ul.className = "hot-list";

  items.forEach(function (item, idx) {
    var card = createHotCard(item, ranked ? { rank: idx + 1 } : {});
    ul.appendChild(card);
  });

  return ul;
}
