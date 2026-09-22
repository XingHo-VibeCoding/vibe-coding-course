// ============================================================
// main.js —— 今日热搜 · 逻辑层（Day 7）
// 依据：TECH_DESIGN 第三/五/六节（数据模型、数据流、错误处理）
// 职责：
//   1) 首页（index.html）：读 data.js 的 HOT_LIST，按分类分块、
//      每类按热度降序渲染列表（F1），并渲染「我的收藏」区（F3）
//   2) 详情页（detail.html）：从网址参数读 id，填 6 个展示字段（F2），
//      绑定收藏按钮（F3）
//   3) 收藏读写 localStorage（键名 favorites，值为 id 数组），
//      读写都包 try/catch，禁用存储时降级为「收藏不可用」
// 判断当前是哪个页面：看页面上有没有 #hot-list（首页的标志容器）
// ============================================================

"use strict";

// ---------- 收藏：localStorage 读写（F3） ----------

var FAV_KEY = "favorites";

// 读收藏 id 数组；localStorage 不可用或数据坏了 → 返回 null（表示不可用）
function getFavorites() {
  try {
    var raw = window.localStorage.getItem(FAV_KEY);
    if (raw === null) return [];
    var arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    // 只保留合法数字 id
    return arr.filter(function (x) { return typeof x === "number"; });
  } catch (e) {
    return null;
  }
}

// 写回收藏数组；成功返回 true，失败（禁用存储/超配额）返回 false
function saveFavorites(list) {
  try {
    window.localStorage.setItem(FAV_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    return false;
  }
}

// ---------- 工具：按热度生成火焰标识（PRD 允许的两种热度展示之一） ----------

function heatToFire(heat) {
  if (heat >= 8000000) return "🔥🔥🔥";
  if (heat >= 6000000) return "🔥🔥";
  return "🔥";
}

// ---------- 工具：生成一条列表项的 DOM（首页列表和收藏区共用） ----------

function buildHotItem(item) {
  var li = document.createElement("li");
  li.className = "hot-item";

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

  // 热度（火焰标识）
  var heat = document.createElement("span");
  heat.className = "item-heat";
  heat.textContent = heatToFire(item.heat);
  heat.title = "热度 " + item.heat; // 鼠标悬停可看具体数字
  li.appendChild(heat);

  return li;
}

// ---------- 首页逻辑（F1 列表 + F3 收藏区） ----------

function renderIndexPage() {
  // 1) 渲染今日榜单：按分类分块，每类按热度降序
  var listRoot = document.getElementById("hot-list");
  listRoot.innerHTML = "";

  // 按分类归堆（保持数据里首次出现的顺序）
  var order = [];
  var groups = {};
  HOT_LIST.forEach(function (item) {
    if (!groups[item.category]) {
      groups[item.category] = [];
      order.push(item.category);
    }
    groups[item.category].push(item);
  });

  if (order.length === 0) {
    // 异常 1：数据为空 → 兜底文案，不白屏（PRD 第七节）
    var tip = document.createElement("p");
    tip.className = "empty-tip";
    tip.textContent = "今日暂无内容";
    listRoot.appendChild(tip);
    return;
  }

  order.forEach(function (cat) {
    var items = groups[cat].slice().sort(function (a, b) { return b.heat - a.heat; });

    var block = document.createElement("div");
    block.className = "category-block";

    var h3 = document.createElement("h3");
    h3.textContent = cat;
    block.appendChild(h3);

    var ul = document.createElement("ul");
    ul.className = "hot-list";

    if (items.length === 0) {
      var empty = document.createElement("p");
      empty.className = "empty-tip";
      empty.textContent = "本分类暂无内容";
      block.appendChild(empty);
    } else {
      items.forEach(function (item) { ul.appendChild(buildHotItem(item)); });
      block.appendChild(ul);
    }

    listRoot.appendChild(block);
  });

  // 2) 渲染「我的收藏」区
  renderFavoritesArea();
}

function renderFavoritesArea() {
  var area = document.getElementById("favorites-area");
  var ul = document.getElementById("favorites-list");
  var emptyTip = document.getElementById("favorites-empty-tip");
  if (!area || !ul || !emptyTip) return;

  var favIds = getFavorites();
  if (favIds === null) {
    // localStorage 不可用：收藏区整体不显示，首页其他功能不受影响
    area.classList.add("hidden");
    return;
  }

  // 从演示数据里挑出已收藏的条目
  var favItems = HOT_LIST.filter(function (item) {
    return favIds.indexOf(item.id) !== -1;
  });

  if (favItems.length === 0) {
    // 无收藏：显示提示文案（PRD 允许的两种处理选了「显示提示」）
    area.classList.remove("hidden");
    ul.innerHTML = "";
    emptyTip.classList.remove("hidden");
    return;
  }

  area.classList.remove("hidden");
  emptyTip.classList.add("hidden");
  ul.innerHTML = "";
  favItems.forEach(function (item) { ul.appendChild(buildHotItem(item)); });
}

// ---------- 详情页逻辑（F2 六字段 + F3 收藏按钮） ----------

function renderDetailPage() {
  var card = document.getElementById("detail-card");
  var favBtn = document.getElementById("fav-btn");
  var sourceLink = document.getElementById("source-link");
  var favTip = document.getElementById("fav-tip");

  // 1) 从网址参数读 id：detail.html?id=3
  var params = new URLSearchParams(window.location.search);
  var rawId = params.get("id");
  var id = rawId === null ? NaN : Number(rawId);

  var item = HOT_LIST.find(function (x) { return x.id === id; });

  if (!item) {
    // id 缺失/非法/找不到 → 兜底文案，不白屏
    card.innerHTML = "";
    var bad = document.createElement("p");
    bad.className = "empty-tip";
    bad.textContent = "没有找到这条热搜，可能链接有误。";
    card.appendChild(bad);
    favBtn.classList.add("hidden");
    sourceLink.classList.add("hidden");
    return;
  }

  // 2) 填 6 个展示字段（PRD F2）
  card.innerHTML = "";

  var h2 = document.createElement("h2");
  h2.className = "detail-title";
  h2.textContent = item.title;            // ① 标题
  card.appendChild(h2);

  var meta = document.createElement("div");
  meta.className = "detail-meta";

  var tagSource = document.createElement("span");
  tagSource.className = "meta-tag";
  tagSource.textContent = "来源：" + item.source;   // ② 来源平台
  meta.appendChild(tagSource);

  var tagCat = document.createElement("span");
  tagCat.className = "meta-tag";
  tagCat.textContent = "分类：" + item.category;    // ③ 分类
  meta.appendChild(tagCat);

  var tagHeat = document.createElement("span");
  tagHeat.className = "meta-tag heat";
  tagHeat.textContent = heatToFire(item.heat) + " 热度 " + item.heat.toLocaleString(); // ④ 热度
  meta.appendChild(tagHeat);

  card.appendChild(meta);

  var p = document.createElement("p");
  p.className = "detail-summary";
  p.textContent = item.summary;           // ⑤ 摘要说明
  card.appendChild(p);

  // ⑥ 原文链接：填进操作区的「查看原文」
  sourceLink.href = item.link;

  // 3) 收藏按钮（F3）：点亮态 + 切换
  favBtn.dataset.id = String(item.id);

  var favIds = getFavorites();
  var storageOk = favIds !== null;

  if (!storageOk) {
    // 异常 3：浏览器禁用本地存储 → 按钮置灰不可点 + 降级提示
    favBtn.disabled = true;
    favBtn.textContent = "☆ 收藏";
    favTip.classList.remove("hidden");
    return;
  }

  updateFavBtn(favBtn, favIds.indexOf(item.id) !== -1);

  favBtn.addEventListener("click", function () {
    var current = getFavorites();
    if (current === null) {
      favTip.classList.remove("hidden");
      return;
    }
    var itemId = Number(favBtn.dataset.id);
    var pos = current.indexOf(itemId);
    if (pos === -1) {
      current.push(itemId);           // 收藏
    } else {
      current.splice(pos, 1);         // 取消收藏
    }
    if (saveFavorites(current)) {
      updateFavBtn(favBtn, pos === -1);
    } else {
      favTip.classList.remove("hidden");
    }
  });
}

function updateFavBtn(btn, isFav) {
  if (isFav) {
    btn.textContent = "★ 已收藏";
    btn.classList.add("active");
  } else {
    btn.textContent = "☆ 收藏";
    btn.classList.remove("active");
  }
}

// ---------- 入口：按页面分流 ----------

(function main() {
  if (document.getElementById("hot-list")) {
    renderIndexPage();
  } else if (document.getElementById("detail-card")) {
    renderDetailPage();
  }
})();
