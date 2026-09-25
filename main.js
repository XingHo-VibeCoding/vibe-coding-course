// ============================================================
// main.js —— 今日热搜 · 逻辑层（Day 7 初版，Day 8 改版）
// 依据：TECH_DESIGN 第三/五/六节 + Day 8 拍板（方案甲）
// Day 8 新增：
//   1) 首页状态机：加载中 → 成功（setTimeout 模拟网络延迟），
//      并支持 空 / 错误 两种状态的展示与恢复
//   2) 网址参数 ?state=loading|empty|error 直达对应状态（演示辅助）
//   3) 列表项新增序号（前三名高亮），热度仍靠右
//   4) 错误态带「重试」按钮，点击回到成功态
// Day 8 加练：单条卡片与列表的 DOM 生成抽到 components.js
//   （createHotCard / createCardList），本文件只管「什么时候渲染什么」
// 判断当前是哪个页面：看页面上有没有 #hot-list（首页的标志容器）
// ============================================================

"use strict";

// ---------- Day 8：状态配置（演示辅助，非产品功能） ----------

// 模拟网络延迟（毫秒）：正常进入页面时先加载中一小会儿再出数据
var FAKE_DELAY = 600;

// 合法的演示状态名
var DEMO_STATES = ["normal", "loading", "empty", "error"];

// 从网址参数读演示状态：?state=loading / empty / error（缺省 normal）
function getDemoState() {
  var params = new URLSearchParams(window.location.search);
  var s = params.get("state");
  return DEMO_STATES.indexOf(s) !== -1 ? s : "normal";
}

// ---------- 收藏：localStorage 读写（F3，Day 7 原有） ----------

var FAV_KEY = "favorites";

// 读收藏 id 数组；localStorage 不可用或数据坏了 → 返回 null（表示不可用）
function getFavorites() {
  try {
    var raw = window.localStorage.getItem(FAV_KEY);
    if (raw === null) return [];
    var arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
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

// ---------- Day 8：四态盒子工厂（三种非成功态共用一套做法） ----------

// 生成一个通栏状态盒子（CSS 里 .state-box 是 grid-column: 1/-1）
function buildStateBox(type) {
  var box = document.createElement("div");
  box.className = "state-box";

  if (type === "loading") {
    box.className += " loading-box";
    var spin = document.createElement("div");
    spin.className = "loading-spinner";
    box.appendChild(spin);
    var t1 = document.createElement("p");
    t1.textContent = "正在加载今日热搜……";
    box.appendChild(t1);
  } else if (type === "empty") {
    box.className += " empty-box";
    var t2 = document.createElement("p");
    t2.textContent = "今天还没有热搜内容，稍后再来看看。";
    box.appendChild(t2);
  } else if (type === "error") {
    box.className += " error-box";
    var t3 = document.createElement("p");
    t3.textContent = "加载失败，请检查网络后重试。";
    box.appendChild(t3);
    var btn = document.createElement("button");
    btn.className = "retry-btn";
    btn.type = "button";
    btn.textContent = "重试";
    btn.addEventListener("click", function () {
      // 重试 = 回到成功态（真实项目里这里会重新发请求）
      // Day 10 修复：重试只渲染列表还不够——
      //   1) 状态开关高亮要同步跳回「正常」（否则界面正常了、高亮还停在「错误」）
      //   2) 网址里的 ?state=error 要清掉（否则 F5 刷新会退回错误态，重试白做）
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, "", window.location.pathname);
      }
      syncStateSwitch("normal");
      renderHotListSuccess();
    });
    box.appendChild(btn);
  }

  return box;
}

// ---------- Day 8：状态开关（页面顶部的演示辅助按钮行） ----------

function setupStateSwitch() {
  var switchBox = document.getElementById("state-switch");
  if (!switchBox) return;

  var labels = {
    normal: "正常",
    loading: "加载中",
    empty: "空",
    error: "错误"
  };

  DEMO_STATES.forEach(function (name) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.state = name;
    btn.textContent = labels[name];
    if (name === "normal") btn.classList.add("active");
    btn.addEventListener("click", function () {
      // 点击即切换到对应状态（改网址参数并重新走渲染流程）
      window.location.search = name === "normal" ? "" : "?state=" + name;
    });
    switchBox.appendChild(btn);
  });
}

// 同步开关按钮的高亮（当前是哪个状态，哪个按钮亮）
function syncStateSwitch(current) {
  var switchBox = document.getElementById("state-switch");
  if (!switchBox) return;
  var buttons = switchBox.querySelectorAll("button");
  for (var i = 0; i < buttons.length; i++) {
    if (buttons[i].dataset.state === current) {
      buttons[i].classList.add("active");
    } else {
      buttons[i].classList.remove("active");
    }
  }
}

// ---------- 首页逻辑（Day 8 状态机版） ----------

// 成功态：渲染三栏分类列表（原 Day 7 逻辑，加序号）
function renderHotListSuccess() {
  var listRoot = document.getElementById("hot-list");
  if (!listRoot) return;
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
    // 全列表为空 → 空态兜底，不白屏（PRD 第七节）
    listRoot.appendChild(buildStateBox("empty"));
    return;
  }

  order.forEach(function (cat) {
    var items = groups[cat].slice().sort(function (a, b) { return b.heat - a.heat; });

    var block = document.createElement("div");
    block.className = "category-block";

    var h3 = document.createElement("h3");
    h3.textContent = cat;
    block.appendChild(h3);

    if (items.length === 0) {
      // 分类内空态（原有兜底）
      var empty = document.createElement("p");
      empty.className = "empty-tip";
      empty.textContent = "本分类暂无内容";
      block.appendChild(empty);
    } else {
      // 榜单列表：组件带排名（1..n，前三高亮）
      block.appendChild(createCardList(items, { ranked: true }));
    }

    listRoot.appendChild(block);
  });

  // 渲染「我的收藏」区（成功态才有意义）
  renderFavoritesArea();
}

function renderIndexPage() {
  var listRoot = document.getElementById("hot-list");
  if (!listRoot) return;

  setupStateSwitch();

  var demo = getDemoState();
  syncStateSwitch(demo);

  if (demo === "error") {
    // 错误态：直接显示错误盒子（带重试）
    listRoot.innerHTML = "";
    listRoot.appendChild(buildStateBox("error"));
    return;
  }

  if (demo === "empty") {
    // 空态：显示空盒子
    listRoot.innerHTML = "";
    listRoot.appendChild(buildStateBox("empty"));
    return;
  }

  if (demo === "loading") {
    // 加载态（?state=loading 直达）：一直转圈不落数据，方便看效果
    listRoot.innerHTML = "";
    listRoot.appendChild(buildStateBox("loading"));
    return;
  }

  // normal：先加载中 → 模拟延迟后渲染成功（真实项目里延迟=等服务器返回）
  listRoot.innerHTML = "";
  listRoot.appendChild(buildStateBox("loading"));

  window.setTimeout(function () {
    renderHotListSuccess();
  }, FAKE_DELAY);
}

function renderFavoritesArea() {
  var area = document.getElementById("favorites-area");
  var ul = document.getElementById("favorites-list");
  var emptyTip = document.getElementById("favorites-empty-tip");
  if (!area || !ul || !emptyTip) return;

  var favIds = getFavorites();
  if (favIds === null) {
    area.classList.add("hidden");
    return;
  }

  var favItems = HOT_LIST.filter(function (item) {
    return favIds.indexOf(item.id) !== -1;
  });

  if (favItems.length === 0) {
    area.classList.remove("hidden");
    ul.innerHTML = "";
    emptyTip.classList.remove("hidden");
    return;
  }

  area.classList.remove("hidden");
  emptyTip.classList.add("hidden");
  ul.innerHTML = "";
  // 收藏区条目不带排名：同一个 HotCard 组件，不传 rank 即可
  favItems.forEach(function (item) { ul.appendChild(createHotCard(item)); });
}

// ---------- 详情页逻辑（F2，Day 8 不改） ----------

function renderDetailPage() {
  var card = document.getElementById("detail-card");
  var favBtn = document.getElementById("fav-btn");
  var sourceLink = document.getElementById("source-link");
  var favTip = document.getElementById("fav-tip");

  var params = new URLSearchParams(window.location.search);
  var rawId = params.get("id");
  var id = rawId === null ? NaN : Number(rawId);

  var item = HOT_LIST.find(function (x) { return x.id === id; });

  if (!item) {
    card.innerHTML = "";
    var bad = document.createElement("p");
    bad.className = "empty-tip";
    bad.textContent = "没有找到这条热搜，可能链接有误。";
    card.appendChild(bad);
    favBtn.classList.add("hidden");
    sourceLink.classList.add("hidden");
    return;
  }

  card.innerHTML = "";

  var h2 = document.createElement("h2");
  h2.className = "detail-title";
  h2.textContent = item.title;
  card.appendChild(h2);

  var meta = document.createElement("div");
  meta.className = "detail-meta";

  var tagSource = document.createElement("span");
  tagSource.className = "meta-tag";
  tagSource.textContent = "来源：" + item.source;
  meta.appendChild(tagSource);

  var tagCat = document.createElement("span");
  tagCat.className = "meta-tag";
  tagCat.textContent = "分类：" + item.category;
  meta.appendChild(tagCat);

  var tagHeat = document.createElement("span");
  tagHeat.className = "meta-tag heat";
  tagHeat.textContent = heatToFire(item.heat) + " 热度 " + item.heat.toLocaleString();
  meta.appendChild(tagHeat);

  card.appendChild(meta);

  var p = document.createElement("p");
  p.className = "detail-summary";
  p.textContent = item.summary;
  card.appendChild(p);

  sourceLink.href = item.link;

  favBtn.dataset.id = String(item.id);

  var favIds = getFavorites();
  var storageOk = favIds !== null;

  if (!storageOk) {
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
      current.push(itemId);
    } else {
      current.splice(pos, 1);
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
