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
// Day 12 新增：
//   1) 首页分类筛选：状态开关下方一行「全部/科技/娱乐/财经」标签，
//      点击即筛，再点「全部」恢复；?cat=参数直达（含无结果态）
//   2) 筛选状态与网址同步（Day 10 教训）：replaceState 增删 ?cat=，
//      F5 刷新不丢筛选
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

// ---------- Day 12：分类筛选（甲方案：全部/科技/娱乐/财经 标签行） ----------

// 当前筛选的分类："all" = 全部（不过滤）
var currentCategory = "all";

// 可选分类 = 全部 + 数据里出现过的分类（保持首次出现顺序）
function getCategoryOptions() {
  var seen = [];
  HOT_LIST.forEach(function (item) {
    if (seen.indexOf(item.category) === -1) seen.push(item.category);
  });
  return ["all"].concat(seen);
}

// 从网址参数读初始筛选：?cat=科技。
// 注意：不校验是否为已知分类——?cat=不存在的分类 会落到「筛选无结果」态，
// 这正好是测试三种情况里的「无结果」入口（和 Day 8 的 ?state= 同一个思路）
function getCategoryFromUrl() {
  var params = new URLSearchParams(window.location.search);
  var c = params.get("cat");
  return c === null || c === "" ? "all" : c;
}

// 生成筛选按钮行（视觉与状态开关同一套语言）
function setupCategoryFilter() {
  var bar = document.getElementById("category-filter");
  if (!bar) return;

  var labels = { all: "全部" };

  getCategoryOptions().forEach(function (name) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.cat = name;
    btn.textContent = labels[name] || name;
    if (name === currentCategory) btn.classList.add("active");
    btn.addEventListener("click", function () {
      if (currentCategory === name) return; // 重复点同一个分类，不重画
      currentCategory = name;
      syncCategoryFilter(name);
      updateUrlCategory(name);
      renderHotListSuccess();
    });
    bar.appendChild(btn);
  });
}

// 同步筛选按钮高亮（网址带入的 cat 可能没有对应按钮，如 ?cat=体育）
function syncCategoryFilter(cat) {
  var bar = document.getElementById("category-filter");
  if (!bar) return;
  var buttons = bar.querySelectorAll("button");
  for (var i = 0; i < buttons.length; i++) {
    if (buttons[i].dataset.cat === cat) {
      buttons[i].classList.add("active");
    } else {
      buttons[i].classList.remove("active");
    }
  }
}

// Day 10 教训：界面状态变了，网址参数要同步（否则 F5 刷新筛选就丢）
function updateUrlCategory(cat) {
  if (!(window.history && window.history.replaceState)) return;
  var params = new URLSearchParams(window.location.search);
  if (cat === "all") {
    params.delete("cat");
  } else {
    params.set("cat", cat);
  }
  var qs = params.toString();
  window.history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : ""));
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

// 成功态：渲染分类列表（原 Day 7 逻辑，加序号；Day 12 加分类筛选）
function renderHotListSuccess() {
  var listRoot = document.getElementById("hot-list");
  if (!listRoot) return;
  listRoot.innerHTML = "";

  // Day 12：先按当前分类过滤（all = 不过滤）
  var source = HOT_LIST;
  if (currentCategory !== "all") {
    source = HOT_LIST.filter(function (item) {
      return item.category === currentCategory;
    });
  }

  // Day 12（用户反馈）：只显示一个分类时给 #hot-list 挂 single-cat，
  // CSS 里单栏铺满 + 居中，不再缩在左边三分之一格
  if (listRoot.classList) {
    if (currentCategory !== "all") {
      listRoot.classList.add("single-cat");
    } else {
      listRoot.classList.remove("single-cat");
    }
  }

  // 按分类归堆（保持数据里首次出现的顺序）
  var order = [];
  var groups = {};
  source.forEach(function (item) {
    if (!groups[item.category]) {
      groups[item.category] = [];
      order.push(item.category);
    }
    groups[item.category].push(item);
  });

  if (order.length === 0) {
    if (currentCategory !== "all") {
      // Day 12：筛选无结果态（?cat=不存在的分类直达）
      // 按钮行在 #hot-list 外面，仍然可见可点——「点全部恢复」的路不能断
      var box = document.createElement("div");
      box.className = "state-box empty-box";
      var tip = document.createElement("p");
      tip.textContent = "「" + currentCategory + "」分类下暂时没有内容，点上方「全部」恢复。";
      box.appendChild(tip);
      listRoot.appendChild(box);
    } else {
      // 全列表为空 → 空态兜底，不白屏（PRD 第七节）
      listRoot.appendChild(buildStateBox("empty"));
    }
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
}

// Day 13：原首页内嵌「我的收藏」区块已迁到独立 favorites.html，
// 旧渲染函数整个删掉（HTML 挂载点也没了，留着是死代码）。

function renderIndexPage() {
  var listRoot = document.getElementById("hot-list");
  if (!listRoot) return;

  setupStateSwitch();

  // Day 12：筛选栏 + 从网址读初始分类（?cat=科技）
  currentCategory = getCategoryFromUrl();
  setupCategoryFilter();

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

// Day 13：原首页内嵌「我的收藏」区块已迁到独立 favorites.html，
// 这个旧渲染函数整个删掉（HTML 挂载点也没了，留着是死代码）。

// ---------- Day 13：收藏页逻辑（favorites.html · 独立视图） ----------

// 收藏页状态：支持 ?favstate= 直达（与首页 ?state= 同思路，演示辅助）
//   normal（默认）→ 加载中一小会儿 → 有收藏=正常 / 无收藏=空
//   error → 直接显示错误盒子（模拟 localStorage 读不了）
var FAV_DEMO_STATES = ["normal", "error"];

function getFavDemoState() {
  var params = new URLSearchParams(window.location.search);
  var s = params.get("favstate");
  return FAV_DEMO_STATES.indexOf(s) !== -1 ? s : "normal";
}

function renderFavoritesPage() {
  var root = document.getElementById("fav-list-root");
  if (!root) return;

  var demo = getFavDemoState();

  if (demo === "error") {
    // 错误态：本地存储不可用（真实触发法：浏览器隐私模式/禁存储；演示用 ?favstate=error 直达）
    root.innerHTML = "";
    var box = document.createElement("div");
    box.className = "state-box error-box";
    var msg = document.createElement("p");
    msg.textContent = "收藏读取失败——浏览器可能禁用了本地存储。";
    box.appendChild(msg);
    var back = document.createElement("a");
    back.className = "source-link";
    back.href = "index.html";
    back.textContent = "← 返回首页";
    box.appendChild(back);
    root.appendChild(box);
    return;
  }

  // normal：先加载中 → 模拟延迟后按收藏情况渲染（空 / 正常）
  root.innerHTML = "";

  var favIds = getFavorites();
  if (favIds === null) {
    // 真错误（不是演示）：存储真的不可用
    window.location.replace("favorites.html?favstate=error");
    return;
  }

  root.appendChild(buildStateBox("loading"));

  window.setTimeout(function () {
    root.innerHTML = "";

    var favItems = HOT_LIST.filter(function (item) {
      return favIds.indexOf(item.id) !== -1;
    });

    if (favItems.length === 0) {
      // 空态：没收藏，引导去首页
      var emptyBox = document.createElement("div");
      emptyBox.className = "state-box empty-box";
      var tip = document.createElement("p");
      tip.textContent = "还没有收藏。点开任意一条热搜，在详情页点「收藏」试试。";
      emptyBox.appendChild(tip);
      var goIndex = document.createElement("a");
      goIndex.className = "source-link";
      goIndex.href = "index.html";
      goIndex.textContent = "← 去首页逛热搜";
      emptyBox.appendChild(goIndex);
      root.appendChild(emptyBox);
      return;
    }

    // 正常态：收藏条目（不带排名，与原首页内嵌版一致）
    var ul = document.createElement("ul");
    ul.className = "hot-list favorites-view-list";
    favItems.forEach(function (item) { ul.appendChild(createHotCard(item)); });
    root.appendChild(ul);
  }, FAKE_DELAY);
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

  // ---------- Day 11：复制摘要（反馈交互：即时·可见·可逆） ----------
  // 放在「localStorage 不可用」的提前 return 之前——复制不依赖存储，禁用存储时也应可用
  setupCopyButton(item);

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

// ---------- Day 11：复制摘要按钮 ----------

// 复制「标题 + 摘要」到剪贴板，按钮变「✓ 已复制」2 秒后自动复原；
// 连点时先清旧复原定时器再启新的（防抖），反馈永远以最后一次点击为准
function setupCopyButton(item) {
  var copyBtn = document.getElementById("copy-btn");
  if (!copyBtn) return;

  var resetTimer = null;

  function showCopyFeedback(ok) {
    // 防抖：连点时上一次的「2 秒后复原」作废
    if (resetTimer !== null) {
      window.clearTimeout(resetTimer);
      resetTimer = null;
    }

    if (ok) {
      copyBtn.textContent = "✓ 已复制";
      copyBtn.classList.add("done");
      copyBtn.classList.remove("fail");
    } else {
      // 失败降级（file:// 打开或权限被拒）：明确告知没复制上，页面不崩
      copyBtn.textContent = "复制失败";
      copyBtn.classList.add("fail");
      copyBtn.classList.remove("done");
    }

    // 2 秒后复原（可逆）
    resetTimer = window.setTimeout(function () {
      copyBtn.textContent = "复制摘要";
      copyBtn.classList.remove("done");
      copyBtn.classList.remove("fail");
      resetTimer = null;
    }, 2000);
  }

  copyBtn.addEventListener("click", function () {
    var text = item.title + "\n" + item.summary;

    // clipboard 接口只在 localhost / https 下可用；不存在时走失败分支
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showCopyFeedback(true);
      }, function () {
        showCopyFeedback(false);
      });
    } else {
      showCopyFeedback(false);
    }
  });
}

// ---------- 入口：按页面分流 ----------

(function main() {
  if (document.getElementById("hot-list")) {
    renderIndexPage();
  } else if (document.getElementById("detail-card")) {
    renderDetailPage();
  } else if (document.getElementById("fav-list-root")) {
    // Day 13：收藏页（favorites.html）
    renderFavoritesPage();
  }
})();
