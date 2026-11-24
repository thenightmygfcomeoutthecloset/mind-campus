/**
 * 心栖校园（MindCampus）
 * 情绪日记 · 情绪日历 · 情绪趋势图 · 情绪明信片导出模块
 *
 * 负责同学：王雨涵
 * 独立文件：js/module-diary.js（请勿修改项目中的其他文件，避免与队友 Git 冲突）
 *
 * 技术栈：原生 JavaScript + Tailwind CSS(CDN) + Chart.js(CDN) + html2canvas(CDN)
 * 集成契约：
 *   - 脚本在 DOMContentLoaded 时自动渲染到主页面容器 <section id="tab-diary">
 *   - 通过 window.AppStore 读写数据（AppStore 不存在时自动使用内置 7 天演示数据兜底）
 *   - 监听 'diaryUpdated' 与 'tabChanged' 全局事件，自动刷新图表与日历
 */
(function () {
  'use strict';

  /* ==================== 常量与配置 ==================== */
  var STORAGE_KEY = 'mind_campus_v1_diary';

  // 6 种情绪（低饱和治愈配色）
  var MOODS = [
    { key: '开心', emoji: '😊', score: 5, color: '#E0A13E', soft: '#FBF0DC' },
    { key: '平静', emoji: '😌', score: 4, color: '#4A7C6F', soft: '#E7F0ED' },
    { key: '疲惫', emoji: '😮‍💨', score: 3, color: '#8B97AD', soft: '#EDEFF5' },
    { key: '焦虑', emoji: '😰', score: 2, color: '#C48857', soft: '#F6E9DD' },
    { key: '烦躁', emoji: '😠', score: 2, color: '#D78770', soft: '#F9E8E3' },
    { key: '低落', emoji: '😢', score: 1, color: '#7B93AB', soft: '#E8EDF3' }
  ];

  // 大学生压力来源多选标签
  var TAGS = ['学业考试', '宿舍人际', '实习就业', '情感关系', '身材外貌', '经济压力', '未来迷茫', '自我充实'];

  // 按情绪自动匹配的治愈寄语
  var QUOTES = {
    '开心': '今天的快乐也值得被认真收藏，你值得所有明亮的小事。',
    '平静': '允许生活偶尔只是安静地流淌，你已经做得很好了。',
    '疲惫': '累的时候就慢一点，休息不是偷懒，是在给自己充电。',
    '焦虑': '焦虑是想一次做好很多事的证明，先只完成眼前最小的一步。',
    '烦躁': '情绪像天气，会来也会走，先喝口水，给自己三分钟缓冲。',
    '低落': '今天辛苦了，低落不等于你不好，温柔地陪自己待一会儿。'
  };

  /* ==================== 工具函数 ==================== */
  function pad(n) { return String(n).padStart(2, '0'); }

  function toDateStr(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function dateCN(dstr) {
    var d = new Date(dstr + 'T00:00:00');
    var w = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 · 周' + w;
  }

  function moodByKey(key) {
    for (var i = 0; i < MOODS.length; i++) {
      if (MOODS[i].key === key) return MOODS[i];
    }
    return MOODS[1];
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ==================== 数据层（含 AppStore 兜底） ==================== */
  // 优先使用 window.AppStore；若不存在，则用内存 + localStorage 内置 7 天演示数据，方便独立预览调试。

  function buildDemoData() {
    var today = new Date();
    var seeds = [
      { offset: 6, mood: '焦虑', score: 2, tags: ['学业考试'], note: '期末复习进度落后，怕挂科影响绩点，晚上有点睡不着。' },
      { offset: 5, mood: '烦躁', score: 2, tags: ['宿舍人际'], note: '舍友凌晨还在外放视频，又不好意思开口沟通。' },
      { offset: 4, mood: '疲惫', score: 3, tags: ['实习就业'], note: '看到同学都陆续拿到实习 offer，自己简历还没投出去。' },
      { offset: 3, mood: '开心', score: 5, tags: ['自我充实'], note: '跑完五公里，洗完澡整个人都轻松了。' },
      { offset: 2, mood: '平静', score: 4, tags: ['自我充实'], note: '按计划完成了复习章节，心里踏实了不少。' },
      { offset: 1, mood: '低落', score: 1, tags: ['未来迷茫'], note: '不知道毕业以后能做什么，突然觉得很没方向。' },
      { offset: 0, mood: '疲惫', score: 3, tags: ['经济压力'], note: '兼职和课程撞在一起，今天有点撑不住了。' }
    ];
    return seeds.map(function (s, i) {
      var d = new Date(today);
      d.setDate(today.getDate() - s.offset);
      return {
        id: 'demo-' + i,
        date: toDateStr(d),
        mood: s.mood,
        score: s.score,
        tags: s.tags,
        note: s.note,
        aiQuote: QUOTES[s.mood]
      };
    });
  }

  var hasStore = !!(window.AppStore && typeof window.AppStore.getDiaryEntries === 'function');
  var fallbackData = null;

  function getEntries() {
    if (hasStore) {
      try { return window.AppStore.getDiaryEntries() || []; } catch (e) { /* 回退到内置兜底 */ }
    }
    if (fallbackData === null) {
      var raw = null;
      try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) {}
      if (raw) {
        try { fallbackData = JSON.parse(raw); } catch (e) { fallbackData = null; }
      }
      if (!fallbackData || !fallbackData.length) {
        fallbackData = buildDemoData();
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(fallbackData)); } catch (e) {}
      }
    }
    return fallbackData.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }

  function saveEntry(entry) {
    if (hasStore) {
      try { window.AppStore.addDiaryEntry(entry); return; } catch (e) { /* 回退 */ }
    }
    var list = fallbackData || buildDemoData();
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].date === entry.date) { idx = i; break; }
    }
    if (idx >= 0) { list[idx] = entry; } else { list.push(entry); }
    fallbackData = list;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('diaryUpdated')); } catch (e) {}
  }

  function isCrisis(text) {
    if (hasStore && typeof window.AppStore.checkLocalCrisis === 'function') {
      try { return window.AppStore.checkLocalCrisis(text); } catch (e) { /* 回退 */ }
    }
    var words = ['自杀', '自残', '不想活', '去死', '活不下去', '结束生命', '割腕', '跳楼', '安眠药', '伤害自己', '想死'];
    var t = String(text || '');
    for (var i = 0; i < words.length; i++) {
      if (t.indexOf(words[i]) >= 0) return true;
    }
    return false;
  }

  function openCrisis(text) {
    if (hasStore && typeof window.AppStore.openCrisisModal === 'function') {
      try { window.AppStore.openCrisisModal(text); return; } catch (e) { /* 回退 */ }
    }
    alert('我们很担心你。请记住你并不孤单：\n全国 24 小时免费心理援助热线 400-161-9995\n12355 青少年服务台');
  }

  /* ==================== 状态 ==================== */
  var state = {
    mood: '平静',
    score: 4,
    tags: [],
    selectedDate: toDateStr(new Date())
  };
  var chartInstance = null;

  /* ==================== 样式注入 ==================== */
  function injectStyles() {
    if (document.getElementById('mc-diary-style')) return;
    var css = [
      '.mc-range{ -webkit-appearance:none; appearance:none; width:100%; height:6px; border-radius:9999px; background:linear-gradient(90deg,#4A7C6F var(--val,40%),#E7E2D8 var(--val,40%)); outline:none; }',
      '.mc-range::-webkit-slider-thumb{ -webkit-appearance:none; width:22px; height:22px; border-radius:50%; background:#4A7C6F; border:3px solid #fff; box-shadow:0 1px 4px rgba(0,0,0,.18); cursor:pointer; }',
      '.mc-range::-moz-range-thumb{ width:22px; height:22px; border-radius:50%; background:#4A7C6F; border:3px solid #fff; box-shadow:0 1px 4px rgba(0,0,0,.18); cursor:pointer; }',
      '.mc-mood-btn{ display:flex; flex-direction:column; align-items:center; gap:6px; padding:12px 8px; border-radius:16px; border:2px solid transparent; background:#FAFAF8; cursor:pointer; transition:transform .15s ease, box-shadow .15s ease, border-color .15s ease, background .15s ease; }',
      '.mc-mood-btn:hover{ transform:translateY(-2px); box-shadow:0 6px 16px rgba(0,0,0,.06); }',
      '.mc-mood-btn.selected{ border-color:var(--mc-c); background:var(--mc-soft); box-shadow:0 6px 16px rgba(0,0,0,.06); }',
      '.mc-mood-emoji{ font-size:26px; line-height:1; }',
      '.mc-mood-name{ font-size:13px; color:#57534E; }',
      '.mc-mood-score{ font-size:11px; color:#A8A29E; }',
      '.mc-tag-chip{ padding:6px 14px; border-radius:9999px; font-size:13px; color:#57534E; background:#F3ECE1; cursor:pointer; border:1px solid transparent; transition:all .15s ease; }',
      '.mc-tag-chip:hover{ background:#EDE4D4; }',
      '.mc-tag-chip.selected{ background:#4A7C6F; color:#fff; }',
      '.mc-cal-tile{ aspect-ratio:1; border-radius:12px; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; transition:transform .12s ease; }',
      '.mc-cal-tile:hover{ transform:translateY(-2px); }',
      '.mc-cal-tile.selected{ outline:2px solid #4A7C6F; outline-offset:2px; }',
      '.mc-cal-day{ font-size:12px; font-weight:600; }',
      '.mc-cal-emoji{ font-size:18px; line-height:1.2; }',
      '.mc-input{ width:100%; border-radius:12px; border:1px solid #E7E5E4; background:#FAFAF8; padding:10px 12px; font-size:14px; color:#57534E; resize:none; }',
      '.mc-input:focus{ outline:none; border-color:#4A7C6F; box-shadow:0 0 0 3px rgba(74,124,111,0.15); background:#fff; }',
      '.mc-btn{ display:inline-block; padding:12px 24px; border-radius:12px; color:#fff; font-size:14px; font-weight:500; background:#4A7C6F; box-shadow:0 1px 3px rgba(0,0,0,.12); cursor:pointer; border:none; transition:opacity .15s ease, transform .15s ease; }',
      '.mc-btn:hover{ opacity:.9; }',
      '.mc-btn:disabled{ opacity:.55; cursor:not-allowed; }',
      '.mc-postcard{ width:100%; max-width:340px; margin:0 auto; border-radius:20px; background:#fff; overflow:hidden; box-shadow:0 12px 32px rgba(0,0,0,.08); }',
      '.mc-postcard.hide-note .mc-pc-note{ display:none; }',
      '@keyframes mcFade{ from{opacity:0; transform:translateY(8px);} to{opacity:1; transform:translateY(0);} }',
      '.mc-fade{ animation:mcFade .3s ease; }',
      '.mc-toast{ position:fixed; left:50%; bottom:32px; transform:translateX(-50%) translateY(20px); background:#3B655A; color:#fff; padding:10px 22px; border-radius:9999px; font-size:14px; box-shadow:0 8px 24px rgba(0,0,0,.18); opacity:0; transition:all .3s ease; z-index:9999; pointer-events:none; }',
      '.mc-toast.show{ opacity:1; transform:translateX(-50%) translateY(0); }'
    ].join('\n');
    var style = document.createElement('style');
    style.id = 'mc-diary-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ==================== 布局构建 ==================== */
  function buildLayout() {
    var moodButtons = MOODS.map(function (m) {
      return '<button type="button" class="mc-mood-btn" data-mood="' + m.key + '" style="--mc-c:' + m.color + ';--mc-soft:' + m.soft + '">' +
        '<span class="mc-mood-emoji">' + m.emoji + '</span>' +
        '<span class="mc-mood-name">' + m.key + '</span>' +
        '<span class="mc-mood-score">' + m.score + '分</span>' +
        '</button>';
    }).join('');

    var tagButtons = TAGS.map(function (t) {
      return '<button type="button" class="mc-tag-chip" data-tag="' + t + '">' + t + '</button>';
    }).join('');

    return '' +
      '<div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">' +

        /* 页头 */
        '<div class="text-center md:text-left">' +
          '<h2 class="text-xl font-semibold text-stone-700">情绪日记 · 情绪报告</h2>' +
          '<p class="text-sm text-stone-400 mt-1">每天花一分钟，记录此刻的心情，看见自己的情绪轨迹。</p>' +
        '</div>' +

        /* 模块 A：今日情绪打卡 */
        '<section class="bg-white rounded-2xl shadow-sm border border-stone-100 p-5 sm:p-6">' +
          '<header class="flex items-center gap-2 mb-4"><span class="text-lg">🌱</span><h3 class="font-semibold text-stone-700">今日情绪打卡</h3></header>' +
          '<div class="grid md:grid-cols-2 gap-6">' +
            '<div>' +
              '<label class="block text-sm text-stone-500 mb-3">今天的心情更接近哪一种？</label>' +
              '<div id="diary-mood-grid" class="grid grid-cols-3 sm:grid-cols-6 gap-2">' + moodButtons + '</div>' +
              '<div class="mt-5">' +
                '<div class="flex items-center justify-between mb-2">' +
                  '<label class="text-sm text-stone-500">情绪强度</label>' +
                  '<span class="text-sm font-semibold" style="color:#4A7C6F"><span id="diary-score-text">4</span> / 5</span>' +
                '</div>' +
                '<input id="diary-score-slider" type="range" min="1" max="5" step="1" value="4" class="mc-range" style="--val:75%">' +
                '<div class="flex justify-between text-xs text-stone-300 mt-1"><span>很低</span><span>很高</span></div>' +
              '</div>' +
            '</div>' +
            '<div>' +
              '<label class="block text-sm text-stone-500 mb-3">近期的压力主要来自？（可多选）</label>' +
              '<div id="diary-tag-wrap" class="flex flex-wrap gap-2">' + tagButtons + '</div>' +
              '<label class="block text-sm text-stone-500 mt-5 mb-2">一句话心情随笔</label>' +
              '<textarea id="diary-note" class="mc-input" rows="3" placeholder="例如：今天复习有点吃力，但下午晒了会儿太阳好多了…"></textarea>' +
              '<button id="diary-save-btn" type="button" class="mc-btn mt-4 w-full sm:w-auto">记录今天的心情</button>' +
              '<p class="mt-2 text-xs text-stone-300">保存后会自动匹配一句属于此刻的治愈寄语 🌿</p>' +
            '</div>' +
          '</div>' +
        '</section>' +

        /* 模块 B：趋势图 + 月历 */
        '<div class="grid lg:grid-cols-2 gap-6">' +
          '<section class="bg-white rounded-2xl shadow-sm border border-stone-100 p-5 sm:p-6">' +
            '<header class="flex items-center gap-2 mb-4"><span class="text-lg">📈</span><h3 class="font-semibold text-stone-700">近 7 天情绪趋势</h3></header>' +
            '<div class="relative" style="height:260px">' +
              '<canvas id="diary-trend-chart"></canvas>' +
              '<div id="diary-trend-empty" class="hidden absolute inset-0 flex items-center justify-center text-sm text-stone-400">近 7 天还没有情绪记录</div>' +
            '</div>' +
          '</section>' +
          '<section class="bg-white rounded-2xl shadow-sm border border-stone-100 p-5 sm:p-6">' +
            '<header class="flex items-center gap-2 mb-4"><span class="text-lg">🗓️</span><h3 class="font-semibold text-stone-700">近 14 天情绪月历</h3></header>' +
            '<div id="diary-calendar" class="grid grid-cols-7 gap-2"></div>' +
            '<div id="diary-cal-detail" class="mt-4 rounded-xl bg-stone-50 p-4"></div>' +
          '</section>' +
        '</div>' +

        /* 模块 C：情绪明信片 */
        '<section class="bg-white rounded-2xl shadow-sm border border-stone-100 p-5 sm:p-6">' +
          '<header class="flex items-center justify-between flex-wrap gap-3 mb-4">' +
            '<div class="flex items-center gap-2"><span class="text-lg">💌</span><h3 class="font-semibold text-stone-700">今日情绪明信片</h3></div>' +
            '<label class="flex items-center gap-2 text-xs text-stone-400 cursor-pointer select-none">' +
              '<input id="diary-privacy-toggle" type="checkbox" checked style="accent-color:#4A7C6F">' +
              '<span id="diary-privacy-hint">导出时隐藏文字随笔（保护隐私）</span>' +
            '</label>' +
          '</header>' +
          '<div class="grid md:grid-cols-2 gap-6 items-center">' +
            '<div id="diary-postcard-wrap" class="flex justify-center"></div>' +
            '<div class="space-y-3">' +
              '<p class="text-sm text-stone-500 leading-6">把今天的心情装进一张克制温柔的明信片，分享给朋友，或留给自己。</p>' +
              '<button id="diary-export-btn" type="button" class="mc-btn w-full">📥 保存情绪明信片图片</button>' +
              '<p class="text-xs text-stone-300">导出为高清 PNG，文件名格式：心栖校园情绪明信片_日期.png</p>' +
            '</div>' +
          '</div>' +
        '</section>' +

      '</div>';
  }

  /* ==================== 数据渲染 ==================== */
  function renderTrendChart() {
    var canvas = document.getElementById('diary-trend-chart');
    var empty = document.getElementById('diary-trend-empty');
    if (!canvas) return;

    // 面板隐藏时（宽度为 0）不渲染，避免 Chart.js 尺寸异常；切回本页时再渲染
    var panel = document.getElementById('tab-diary');
    if (panel && (panel.classList.contains('hidden') || panel.offsetWidth === 0)) return;

    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

    if (!window.Chart) {
      canvas.style.display = 'none';
      if (empty) { empty.style.display = ''; empty.textContent = '未加载 Chart.js，请确认 index.html 已通过 CDN 引入'; }
      return;
    }

    var entries = getEntries();
    var cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - 6);

    var recent = entries.filter(function (e) {
      return new Date(e.date + 'T00:00:00') >= cutoff;
    }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });

    if (recent.length === 0) {
      canvas.style.display = 'none';
      if (empty) { empty.style.display = ''; empty.textContent = '近 7 天还没有情绪记录'; }
      return;
    }
    canvas.style.display = '';
    if (empty) empty.style.display = 'none';

    var labels = recent.map(function (e) { return e.date.slice(5).replace('-', '/'); });
    var data = recent.map(function (e) { return e.score; });
    var colors = recent.map(function (e) { return moodByKey(e.mood).color; });

    var ctx = canvas.getContext('2d');
    var gradient = ctx.createLinearGradient(0, 0, 0, 260);
    gradient.addColorStop(0, 'rgba(74,124,111,0.28)');
    gradient.addColorStop(1, 'rgba(74,124,111,0.02)');

    chartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          borderColor: '#4A7C6F',
          backgroundColor: gradient,
          borderWidth: 2.5,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: colors,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#3B655A',
            titleColor: '#fff',
            bodyColor: '#fff',
            titleFont: { size: 12 },
            bodyFont: { size: 12 },
            padding: 10,
            cornerRadius: 10,
            displayColors: false,
            callbacks: {
              title: function (items) { return dateCN(recent[items[0].dataIndex].date); },
              label: function (ctx) {
                var e = recent[ctx.dataIndex];
                var tags = (e.tags && e.tags.length) ? e.tags.join('、') : '无标签';
                return [e.mood + ' · 情绪分 ' + e.score + '/5', '压力来源：' + tags];
              }
            }
          }
        },
        scales: {
          y: {
            min: 0, max: 5,
            ticks: { stepSize: 1, color: '#A8A29E', font: { size: 11 } },
            grid: { color: '#EFEDE8' },
            border: { display: false }
          },
          x: {
            ticks: { color: '#A8A29E', font: { size: 11 } },
            grid: { display: false },
            border: { display: false }
          }
        }
      }
    });
  }

  function renderCalendar() {
    var wrap = document.getElementById('diary-calendar');
    if (!wrap) return;

    var entries = getEntries();
    var byDate = {};
    entries.forEach(function (e) { byDate[e.date] = e; });

    var todayStr = toDateStr(new Date());
    var today = new Date();
    var tiles = [];
    for (var i = 13; i >= 0; i--) {
      var d = new Date(today);
      d.setDate(today.getDate() - i);
      var ds = toDateStr(d);
      tiles.push({ date: ds, day: d.getDate(), entry: byDate[ds] || null, isToday: ds === todayStr });
    }

    wrap.innerHTML = tiles.map(function (item) {
      var e = item.entry;
      var bg = '#F5F5F2', color = '#A8A29E', emoji = '·';
      if (e) { var m = moodByKey(e.mood); bg = m.soft; color = m.color; emoji = m.emoji; }
      var sel = item.date === state.selectedDate ? ' selected' : '';
      var todayRing = item.isToday ? ' box-shadow:inset 0 0 0 1px #4A7C6F;' : '';
      return '<div class="mc-cal-tile' + sel + '" data-date="' + item.date + '" style="background:' + bg + ';color:' + color + ';' + todayRing + '">' +
        '<span class="mc-cal-day">' + item.day + '</span>' +
        '<span class="mc-cal-emoji">' + emoji + '</span>' +
        '</div>';
    }).join('');

    renderCalendarDetail();
  }

  function renderCalendarDetail() {
    var box = document.getElementById('diary-cal-detail');
    if (!box) return;

    var entries = getEntries();
    var e = null;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].date === state.selectedDate) { e = entries[i]; break; }
    }

    if (!e) {
      box.innerHTML = '<div class="text-sm text-stone-400 text-center py-6">这一天还没有情绪记录，去上面打卡留下此刻的心情吧 🌱</div>';
      return;
    }

    var m = moodByKey(e.mood);
    var tags = (e.tags && e.tags.length)
      ? e.tags.map(function (t) { return '<span class="mc-tag-chip selected" style="pointer-events:none;">' + escapeHtml(t) + '</span>'; }).join('')
      : '';

    box.innerHTML = '<div class="mc-fade">' +
      '<div class="text-sm text-stone-500">' + dateCN(e.date) + '</div>' +
      '<div class="mt-2 flex items-center gap-2">' +
        '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium" style="background:' + m.soft + ';color:' + m.color + '">' + m.emoji + ' ' + m.key + ' · ' + e.score + '分</span>' +
      '</div>' +
      (e.note ? '<p class="mt-3 text-sm text-stone-600 leading-6">' + escapeHtml(e.note) + '</p>' : '') +
      (tags ? '<div class="mt-3 flex flex-wrap gap-2">' + tags + '</div>' : '') +
      (e.aiQuote ? '<p class="mt-3 text-xs text-stone-400 italic">“' + escapeHtml(e.aiQuote) + '”</p>' : '') +
      '</div>';
  }

  function renderPostcard() {
    var wrap = document.getElementById('diary-postcard-wrap');
    if (!wrap) return;

    var entries = getEntries();
    var todayStr = toDateStr(new Date());
    var entry = null;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].date === todayStr) { entry = entries[i]; break; }
    }
    if (!entry) entry = entries[0];

    if (!entry) {
      wrap.innerHTML = '<div class="mc-postcard border border-stone-100 flex items-center justify-center text-sm text-stone-400" style="height:360px">今天还没有情绪记录，去打卡后生成你的专属明信片吧 💌</div>';
      return;
    }

    var m = moodByKey(entry.mood);
    var quote = entry.aiQuote || QUOTES[entry.mood] || '你今天也很努力了。';
    var tags = (entry.tags && entry.tags.length)
      ? entry.tags.map(function (t) { return '<span class="inline-block px-2.5 py-1 rounded-full text-xs" style="background:#F3ECE1;color:#8A7B63">' + escapeHtml(t) + '</span>'; }).join('')
      : '';

    wrap.innerHTML = '' +
      '<div id="diary-postcard" class="mc-postcard border border-stone-100" style="background:linear-gradient(180deg,#FBFBF9 0%,#fff 45%);">' +
        '<div style="padding:28px 24px 22px;">' +
          '<div class="flex items-center justify-between text-xs tracking-widest text-stone-400">' +
            '<span>心栖校园 · 今日情绪报告</span>' +
            '<span>' + dateCN(entry.date) + '</span>' +
          '</div>' +
          '<div class="mt-6 flex justify-center">' +
            '<span class="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium" style="background:' + m.soft + ';color:' + m.color + '">' +
              '<span class="text-lg">' + m.emoji + '</span>' + m.key + ' · ' + entry.score + '分' +
            '</span>' +
          '</div>' +
          '<div class="mt-5 text-center">' +
            '<p class="text-[15px] leading-7 text-stone-600 italic" style="font-family:Georgia,serif;">“' + escapeHtml(quote) + '”</p>' +
          '</div>' +
          (tags ? '<div class="mt-4 flex flex-wrap justify-center gap-2">' + tags + '</div>' : '') +
          '<div class="mc-pc-note mt-4 rounded-xl p-4 text-sm text-stone-600 leading-6" style="background:#F6F8F6;">' +
            '<div class="text-xs text-stone-400 mb-1">今日随笔</div>' +
            (entry.note ? escapeHtml(entry.note) : '<span class="text-stone-300">（这一天只留下了情绪，没有文字）</span>') +
          '</div>' +
        '</div>' +
        '<div class="border-t border-stone-100 py-3 text-center text-xs tracking-wide text-stone-400">心栖校园 · 非医疗情绪记录</div>' +
      '</div>';
  }

  function refreshData() {
    renderTrendChart();
    renderCalendar();
    renderPostcard();
  }

  /* ==================== 交互处理 ==================== */
  function selectMood(key) {
    state.mood = key;
    state.score = moodByKey(key).score;
    syncMoodUI();
  }

  function syncMoodUI() {
    var root = document.getElementById('tab-diary');
    if (!root) return;
    var btns = root.querySelectorAll('[data-mood]');
    btns.forEach(function (b) {
      b.classList.toggle('selected', b.getAttribute('data-mood') === state.mood);
    });
    var slider = root.querySelector('#diary-score-slider');
    if (slider) {
      slider.value = state.score;
      slider.style.setProperty('--val', (((state.score - 1) / 4) * 100) + '%');
    }
    var txt = root.querySelector('#diary-score-text');
    if (txt) txt.textContent = state.score;
  }

  function toggleTag(tag, el) {
    var i = state.tags.indexOf(tag);
    if (i >= 0) { state.tags.splice(i, 1); } else { state.tags.push(tag); }
    el.classList.toggle('selected', i < 0);
  }

  function handleSave() {
    var root = document.getElementById('tab-diary');
    var noteEl = root ? root.querySelector('#diary-note') : null;
    var note = noteEl ? noteEl.value.trim() : '';

    // 高危自伤内容前置拦截：触发全站危机援助弹窗，不进入正常保存
    if (note && isCrisis(note)) {
      openCrisis(note);
      toast('已为你唤起专业援助，请先照顾好自己 🤍');
      return;
    }

    var today = toDateStr(new Date());
    var entry = {
      id: today + '-' + Date.now(),
      date: today,
      mood: state.mood,
      score: state.score,
      tags: state.tags.slice(),
      note: note,
      aiQuote: QUOTES[state.mood]
    };

    saveEntry(entry);
    state.selectedDate = today;

    // 清空随笔与标签，保留当前情绪选择
    if (noteEl) noteEl.value = '';
    state.tags = [];
    var chips = root ? root.querySelectorAll('[data-tag]') : [];
    chips.forEach(function (c) { c.classList.remove('selected'); });

    toast('已记录今天的心情，去明信片看看你的情绪画像吧 🌿');
    refreshData();
  }

  function exportPostcard() {
    var el = document.getElementById('diary-postcard');
    if (!el) { toast('请先记录今天的心情，再生成明信片'); return; }

    if (!window.html2canvas) {
      toast('未加载 html2canvas，请确认 index.html 已通过 CDN 引入');
      return;
    }

    var toggle = document.getElementById('diary-privacy-toggle');
    var hideNote = !toggle || toggle.checked;
    var exportBtn = document.getElementById('diary-export-btn');
    var oldText = exportBtn ? exportBtn.textContent : '';
    if (exportBtn) { exportBtn.disabled = true; exportBtn.textContent = '正在生成…'; }

    if (hideNote) el.classList.add('hide-note');

    window.html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false })
      .then(function (canvas) {
        var link = document.createElement('a');
        link.download = '心栖校园情绪明信片_' + toDateStr(new Date()) + '.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
        toast('明信片已保存到你的下载目录');
      })
      .catch(function () {
        toast('导出失败，请稍后重试');
      })
      .finally(function () {
        el.classList.remove('hide-note');
        if (exportBtn) { exportBtn.disabled = false; exportBtn.textContent = oldText; }
      });
  }

  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById('mc-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'mc-toast';
      el.className = 'mc-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    void el.offsetWidth; // 强制重排以重启动画
    el.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2400);
  }

  /* ==================== 事件绑定 ==================== */
  function bindEvents(root) {
    root.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-mood]') : null;
      if (t) { selectMood(t.getAttribute('data-mood')); return; }

      t = e.target && e.target.closest ? e.target.closest('[data-tag]') : null;
      if (t) { toggleTag(t.getAttribute('data-tag'), t); return; }

      t = e.target && e.target.closest ? e.target.closest('[data-date]') : null;
      if (t) { state.selectedDate = t.getAttribute('data-date'); renderCalendar(); return; }

      if (e.target && e.target.closest && e.target.closest('#diary-save-btn')) { handleSave(); return; }
      if (e.target && e.target.closest && e.target.closest('#diary-export-btn')) { exportPostcard(); return; }
    });

    root.addEventListener('input', function (e) {
      if (e.target && e.target.id === 'diary-score-slider') {
        state.score = parseInt(e.target.value, 10);
        var txt = root.querySelector('#diary-score-text');
        if (txt) txt.textContent = state.score;
        e.target.style.setProperty('--val', (((state.score - 1) / 4) * 100) + '%');
      }
    });

    root.addEventListener('change', function (e) {
      if (e.target && e.target.id === 'diary-privacy-toggle') {
        var hint = root.querySelector('#diary-privacy-hint');
        if (hint) hint.textContent = e.target.checked ? '导出时隐藏文字随笔（保护隐私）' : '导出时包含文字随笔';
      }
    });
  }

  /* ==================== 初始化 ==================== */
  function init() {
    var root = document.getElementById('tab-diary');
    if (!root) return;
    injectStyles();
    root.innerHTML = buildLayout();
    syncMoodUI();
    bindEvents(root);
    refreshData();
  }

  window.addEventListener('diaryUpdated', function () { refreshData(); });
  window.addEventListener('tabChanged', function () {
    var panel = document.getElementById('tab-diary');
    if (panel && !panel.classList.contains('hidden')) renderTrendChart();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
