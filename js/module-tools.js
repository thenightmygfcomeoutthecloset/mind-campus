/* ============================================================================
 * 心栖校园 MindCampus — js/module-tools.js
 * 负责人：程苏皖（Git 独占文件，请勿与其他模块互相修改）
 * ----------------------------------------------------------------------------
 * 职责：
 *   子视图 1｜🌿 自助放松工具：4-7-8 呼吸动效训练 + CBT 思维转念三步练习
 *   子视图 2｜📖 校园科普与专业援助：4 张 1 分钟心理微科普卡片 + 校内外援助通道
 *   子视图 3｜📊 校园情绪晴雨表：脱敏宏观统计看板（指标卡 / 压力来源条形图 / 词云墙 / 干预建议）
 *
 * 集成契约（严格遵守）：
 *   - 只在 DOMContentLoaded 时向 <section id="tab-tools"> 内部渲染界面，不触碰其它文件；
 *   - 监听 window 上的 'tabChanged'：进入本页时渲染/重绘图表，离开本页时暂停呼吸定时器；
 *   - 依赖 window.AppStore（switchTab / checkLocalCrisis / openCrisisModal），全部做存在性兜底，
 *     即使 store.js 尚未推送也能独立调试、不会白屏报错；
 *   - Chart.js 由 index.html 通过 CDN 引入，未加载时自动降级为纯静态条形图，不报错。
 * ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ 设计令牌 */
  const BRAND = {
    green: '#4A7C6F',
    greenDeep: '#3B655A',
    greenSoft: '#E8F1EC',
    greenLine: '#CFE0D8',
    cream: '#F3ECE1',
    creamText: '#8A7A62',
    coral: '#D9534F',
    ink: '#2F3A36',
    sub: '#7C8783'
  };

  const CBT_STORAGE_KEY = 'mind_campus_v1_tools_cbt';

  /* ------------------------------------------------------------------ 通用小工具 */
  function h(html) {
    const t = document.createElement('template');
    t.innerHTML = String(html).trim();
    return t.content.firstElementChild;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  let toastTimer = null;
  function toast(msg, type) {
    let node = document.getElementById('tools-toast');
    if (!node) {
      node = h(
        '<div id="tools-toast" class="fixed left-1/2 bottom-24 z-[60] -translate-x-1/2 translate-y-2 ' +
          'rounded-full px-4 py-2 text-sm shadow-lg opacity-0 pointer-events-none transition-all duration-300" ' +
          'style="max-width:86vw;text-align:center;"></div>'
      );
      document.body.appendChild(node);
    }
    const danger = type === 'danger';
    node.textContent = msg;
    node.style.background = danger ? '#FDECEA' : 'rgba(47,58,54,.92)';
    node.style.color = danger ? BRAND.coral : '#FFFFFF';
    node.style.border = danger ? '1px solid rgba(217,83,79,.35)' : '1px solid transparent';
    node.style.opacity = '1';
    node.style.transform = 'translate(-50%, 0)';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      node.style.opacity = '0';
      node.style.transform = 'translate(-50%, 8px)';
    }, 2600);
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error('copy failed'));
      } catch (err) {
        reject(err);
      }
    });
  }

  function isElementVisible(el) {
    if (!el) return false;
    if (el.classList.contains('hidden')) return false;
    return el.offsetParent !== null || el.getClientRects().length > 0;
  }

  /* --------------------------------------------------------- AppStore 兜底桥接层 */
  const Bridge = {
    exists: function () {
      return !!(window.AppStore && typeof window.AppStore === 'object');
    },
    crisisCheck: function (text) {
      try {
        if (window.AppStore && typeof window.AppStore.checkLocalCrisis === 'function') {
          return !!window.AppStore.checkLocalCrisis(text);
        }
      } catch (e) {
        /* 静默降级：本地检测不可用时放行 */
      }
      return false;
    },
    openCrisis: function (text) {
      try {
        if (window.AppStore && typeof window.AppStore.openCrisisModal === 'function') {
          window.AppStore.openCrisisModal(text);
          return true;
        }
      } catch (e) {
        /* ignore */
      }
      return false;
    },
    switchTab: function (tabId) {
      try {
        if (window.AppStore && typeof window.AppStore.switchTab === 'function') {
          window.AppStore.switchTab(tabId);
          return true;
        }
      } catch (e) {
        /* ignore */
      }
      return false;
    }
  };

  /* ---------------------------------------------------------------- 卡片外壳复用 */
  function cardHeader(icon, title, desc, badgeText) {
    return (
      '<header class="flex items-start justify-between gap-3">' +
      '<div class="min-w-0">' +
      '<h3 class="text-base font-semibold tracking-wide" style="color:' + BRAND.ink + '">' +
      icon + ' ' + esc(title) +
      '</h3>' +
      (desc
        ? '<p class="mt-1 text-xs leading-relaxed" style="color:' + BRAND.sub + '">' + esc(desc) + '</p>'
        : '') +
      '</div>' +
      (badgeText
        ? '<span class="shrink-0 rounded-full px-2 py-1 text-[11px]" style="background:' +
          BRAND.cream + ';color:' + BRAND.creamText + '">' + esc(badgeText) + '</span>'
        : '') +
      '</header>'
    );
  }

  function primaryBtnClass() {
    return 'rounded-full px-4 py-2 text-sm font-medium text-white transition-colors duration-200 ' +
      'disabled:opacity-40 disabled:cursor-not-allowed';
  }

  function ghostBtnClass() {
    return 'rounded-full border px-4 py-2 text-sm transition-colors duration-200';
  }

  function brandBtnStyle() {
    return 'background:' + BRAND.green + ';';
  }

  /* =========================================================================
   * 子视图一 · 卡片 1：4-7-8 呼吸引导训练
   * 严格 4 秒吸气（平滑放大）→ 7 秒屏息（柔和微光）→ 8 秒呼气（平滑缩小）
   * ========================================================================= */
  function buildBreathingCard() {
    const PHASES = [
      { label: '用鼻子慢慢吸气', sec: 4, hint: '吸气 4 秒', key: 'inhale' },
      { label: '轻轻屏住呼吸', sec: 7, hint: '屏息 7 秒', key: 'hold' },
      { label: '用嘴缓缓呼气', sec: 8, hint: '呼气 8 秒', key: 'exhale' }
    ];

    const el = h(
      '<article class="bg-white rounded-2xl shadow-sm border border-stone-100 p-5 sm:p-6 flex flex-col">' +
      cardHeader('🌿', '4-7-8 呼吸引导训练', '吸 4 秒 · 屏 7 秒 · 呼 8 秒，一轮约 19 秒；睡前 4 轮帮助身体降噪', '放松练习') +

      '<div class="relative mt-3 flex flex-1 items-center justify-center overflow-hidden" style="min-height:300px">' +
      // 外层柔光晕
      '<div data-halo class="absolute rounded-full" style="width:236px;height:236px;' +
      'background:radial-gradient(circle,rgba(74,124,111,.30) 0%,rgba(74,124,111,0) 70%);' +
      'opacity:.35;transform:scale(.62);will-change:transform,opacity;"></div>' +
      // 主体呼吸圆环
      '<div data-ring class="absolute rounded-full" style="width:236px;height:236px;' +
      'background:radial-gradient(circle at 50% 30%, #F4F9F6 0%, #D6E7DE 46%, #7BA396 78%, #4A7C6F 100%);' +
      'box-shadow:0 18px 46px rgba(74,124,111,.20), inset 0 0 0 1px rgba(255,255,255,.35);' +
      'transform:scale(.62);will-change:transform;"></div>' +
      // 中央文案
      '<div class="relative z-10 select-none text-center px-3">' +
      '<p data-phase class="text-[13px] tracking-wide" style="color:' + BRAND.ink + '">准备好后，点击开始</p>' +
      '<p data-count class="mt-2 font-semibold leading-none tabular-nums" style="font-size:42px;color:' + BRAND.ink + '">–</p>' +
      '</div></div>' +

      '<p data-hint class="mt-1 text-center text-[11px] leading-relaxed" style="color:' +
      BRAND.sub + '">跟随圆环的放大与缩小，让呼吸慢慢变长</p>' +

      '<div class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4">' +
      '<p data-cycles class="text-xs" style="color:' + BRAND.sub + '">已完成 <span class="font-semibold" style="color:' +
      BRAND.green + '">0</span> 轮</p>' +
      '<div class="flex gap-2">' +
      '<button data-toggle class="' + primaryBtnClass() + '" style="' + brandBtnStyle() + '">开始练习</button>' +
      '<button data-reset class="' + ghostBtnClass() + ' border-stone-200 hover:border-stone-300" style="color:' +
      BRAND.sub + '">重置</button>' +
      '</div></div>' +
      '</article>'
    );

    const ring = el.querySelector('[data-ring]');
    const halo = el.querySelector('[data-halo]');
    const phaseEl = el.querySelector('[data-phase]');
    const countEl = el.querySelector('[data-count]');
    const hintEl = el.querySelector('[data-hint]');
    const cyclesEl = el.querySelector('[data-cycles]');
    const toggleBtn = el.querySelector('[data-toggle]');
    const resetBtn = el.querySelector('[data-reset]');

    let phaseIndex = 0;
    let elapsed = 0;       // 当前阶段已进行毫秒
    let running = false;
    let rafId = null;
    let lastTs = 0;
    let cycles = 0;
    let hasStarted = false;

    function easeOut(t) { return 1 - Math.pow(1 - t, 2.4); }
    function easeIn(t) { return Math.pow(t, 1.9); }

    function scaleOf(idx, p) {
      if (idx === 0) return 0.62 + 0.38 * easeOut(p);           // 吸气：0.62 → 1
      if (idx === 1) return 1 + 0.014 * Math.sin(p * Math.PI * 6); // 屏息：极缓的呼吸微动
      return 1 - 0.38 * easeIn(p);                              // 呼气：1 → 0.62
    }

    function paint() {
      const phase = PHASES[phaseIndex];
      const dur = phase.sec * 1000;
      const p = Math.min(1, elapsed / dur);
      const scale = scaleOf(phaseIndex, p);

      ring.style.transform = 'scale(' + scale.toFixed(4) + ')';

      // 屏息阶段让外圈柔光缓慢起伏，形成"柔和呼吸微光"
      if (phaseIndex === 1) {
        halo.style.opacity = (0.30 + 0.30 * Math.sin(p * Math.PI * 3)).toFixed(3);
        halo.style.transform = 'scale(' + (1.06 + 0.05 * Math.sin(p * Math.PI * 3)).toFixed(3) + ')';
      } else {
        halo.style.opacity = '0.32';
        halo.style.transform = 'scale(' + (scale * 1.08).toFixed(4) + ')';
      }

      const remain = Math.max(1, Math.ceil((dur - elapsed) / 1000));
      phaseEl.textContent = phase.label;
      countEl.textContent = String(remain);

      if (elapsed < 60) hintEl.textContent = phase.hint + '，别用力过猛，舒服就好';
    }

    function idle() {
      phaseEl.textContent = '准备好后，点击开始';
      countEl.textContent = '–';
      hintEl.textContent = '跟随圆环的放大与缩小，让呼吸慢慢变长';
      ring.style.transform = 'scale(.62)';
      halo.style.opacity = '0.35';
      halo.style.transform = 'scale(.62)';
    }

    function advance() {
      if (phaseIndex === 2) {
        cycles += 1;
        cyclesEl.innerHTML = '已完成 <span class="font-semibold" style="color:' + BRAND.green + '">' +
          cycles + '</span> 轮';
        phaseIndex = 0;
      } else {
        phaseIndex += 1;
      }
      elapsed = 0;
    }

    function frame(ts) {
      if (!running) return;
      if (!lastTs) lastTs = ts;
      const dt = Math.min(ts - lastTs, 260); // 防止切后台回来一次性跳变
      lastTs = ts;
      elapsed += dt;

      const dur = PHASES[phaseIndex].sec * 1000;
      if (elapsed >= dur) {
        elapsed -= dur;
        advance();
      }
      paint();
      rafId = requestAnimationFrame(frame);
    }

    function start() {
      running = true;
      hasStarted = true;
      lastTs = 0;
      toggleBtn.textContent = '暂停';
      toggleBtn.style.background = BRAND.greenDeep;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(frame);
    }

    function pause(showToast) {
      running = false;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      toggleBtn.textContent = hasStarted ? '继续' : '开始练习';
      toggleBtn.style.background = BRAND.green;
      if (showToast && showToast !== true) toast(showToast);
    }

    function reset() {
      pause();
      phaseIndex = 0;
      elapsed = 0;
      cycles = 0;
      hasStarted = false;
      cyclesEl.innerHTML = '已完成 <span class="font-semibold" style="color:' + BRAND.green + '">0</span> 轮';
      toggleBtn.textContent = '开始练习';
      idle();
      toast('已重置，回到 4-7-8 起点');
    }

    toggleBtn.addEventListener('click', function () {
      if (running) {
        pause('已暂停，随时可以继续');
      } else {
        if (!hasStarted) {
          cycles = 0;
          phaseIndex = 0;
          elapsed = 0;
          cyclesEl.innerHTML = '已完成 <span class="font-semibold" style="color:' + BRAND.green + '">0</span> 轮';
        }
        start();
      }
    });

    resetBtn.addEventListener('click', reset);

    idle();

    return {
      el: el,
      pause: function () { if (running) pause(); },
      destroy: function () {
        running = false;
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      }
    };
  }

  /* =========================================================================
   * 子视图一 · 卡片 2：CBT 思维转念三步练习
   * ========================================================================= */
  const BIAS_TAGS = [
    '全或无思维',
    '过度灾难化',
    '读心术臆测',
    '情绪化推理',
    '贴标签',
    '应该式思维'
  ];

  function buildCbtCard() {
    const el = h(
      '<article class="bg-white rounded-2xl shadow-sm border border-stone-100 p-5 sm:p-6 flex flex-col">' +
      cardHeader('🪞', 'CBT 思维转念练习', '把"我很差劲"拆开看：发生了什么 → 落入哪个思维陷阱 → 换个温柔客观的说法', '认知重构') +

      '<div data-steps class="mt-4 space-y-4">' +
      // 第 1 步
      '<div class="rounded-xl p-3" style="background:#FBFDFC;border:1px solid ' + BRAND.greenLine + '">' +
      '<div class="flex items-center gap-2">' +
      '<span class="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold text-white" style="background:' +
      BRAND.green + '">1</span>' +
      '<label class="text-[13px] font-medium" style="color:' + BRAND.ink + '">发生了什么，以及脑海里的那句话</label>' +
      '</div>' +
      '<textarea data-step1 rows="3" class="mt-2 w-full resize-none rounded-lg border border-stone-200 bg-white p-2.5 text-[13px] leading-relaxed outline-none focus:border-[#4A7C6F]" ' +
      'placeholder="例：这次小组展示忘词了，大家肯定觉得我很差劲。"></textarea>' +
      '</div>' +

      // 第 2 步
      '<div class="rounded-xl p-3" style="background:#FBFDFC;border:1px solid ' + BRAND.greenLine + '">' +
      '<div class="flex items-center gap-2">' +
      '<span class="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold text-white" style="background:' +
      BRAND.green + '">2</span>' +
      '<label class="text-[13px] font-medium" style="color:' + BRAND.ink + '">这句话里藏着哪种思维陷阱？<span class="ml-1 text-[11px]" style="color:' +
      BRAND.sub + '">可多选</span></label>' +
      '</div>' +
      '<div data-biases class="mt-2 flex flex-wrap gap-2"></div>' +
      '</div>' +

      // 第 3 步
      '<div class="rounded-xl p-3" style="background:#FBFDFC;border:1px solid ' + BRAND.greenLine + '">' +
      '<div class="flex items-center gap-2">' +
      '<span class="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold text-white" style="background:' +
      BRAND.green + '">3</span>' +
      '<label class="text-[13px] font-medium" style="color:' + BRAND.ink + '">换个更客观、更温柔的说法</label>' +
      '</div>' +
      '<textarea data-step3 rows="3" class="mt-2 w-full resize-none rounded-lg border border-stone-200 bg-white p-2.5 text-[13px] leading-relaxed outline-none focus:border-[#4A7C6F]" ' +
      'placeholder="小提示：如果是我最好的朋友遇到这件事，我会怎么跟他说？"></textarea>' +
      '</div>' +
      '</div>' +

      '<div class="mt-4 flex flex-wrap items-center gap-2">' +
      '<button data-finish class="' + primaryBtnClass() + '" style="' + brandBtnStyle() + '">完成转念</button>' +
      '<button data-clear class="' + ghostBtnClass() + ' border-stone-200" style="color:' + BRAND.sub + '">重新开始</button>' +
      '<span class="text-[11px]" style="color:' + BRAND.sub + '">练习只保存在你自己的设备上</span>' +
      '</div>' +

      // 结果区
      '<div data-result class="mt-4 hidden rounded-2xl p-4" style="background:' + BRAND.cream + '">' +
      '<div class="space-y-2">' +
      '<div class="rounded-xl bg-white/70 p-3">' +
      '<p class="text-[11px] tracking-wide" style="color:' + BRAND.creamText + '">旧想法</p>' +
      '<p data-r-old class="mt-1 text-[13px] leading-relaxed line-through" style="color:#9A9F9C"></p>' +
      '</div>' +
      '<p class="text-center text-sm" style="color:' + BRAND.green + '">↓　换一个角度</p>' +
      '<div class="rounded-xl bg-white p-3 shadow-sm">' +
      '<p class="text-[11px] tracking-wide" style="color:' + BRAND.green + '">新视角</p>' +
      '<p data-r-new class="mt-1 text-[13px] font-medium leading-relaxed" style="color:' + BRAND.ink + '"></p>' +
      '<div data-r-tags class="mt-2 flex flex-wrap gap-1.5"></div>' +
      '</div>' +
      '</div>' +
      '<div class="mt-3 flex flex-wrap gap-2">' +
      '<button data-copy class="' + ghostBtnClass() + ' bg-white border-stone-200 text-[13px]" style="color:' + BRAND.green + '">复制这张转念卡片</button>' +
      '<button data-save class="' + ghostBtnClass() + ' bg-white border-stone-200 text-[13px]" style="color:' + BRAND.green + '">保存到本机</button>' +
      '</div>' +
      '<p class="mt-2 text-[11px] leading-relaxed" style="color:' + BRAND.creamText + '">转念不是强迫自己乐观，而是把"绝对化的结论"换成"更接近事实的描述"。</p>' +
      '</div>' +
      '</article>'
    );

    const step1 = el.querySelector('[data-step1]');
    const step3 = el.querySelector('[data-step3]');
    const biasWrap = el.querySelector('[data-biases]');
    const resultBox = el.querySelector('[data-result]');
    const rOld = el.querySelector('[data-r-old]');
    const rNew = el.querySelector('[data-r-new]');
    const rTags = el.querySelector('[data-r-tags]');
    const finishBtn = el.querySelector('[data-finish]');
    const clearBtn = el.querySelector('[data-clear]');
    const copyBtn = el.querySelector('[data-copy]');
    const saveBtn = el.querySelector('[data-save]');

    const selected = new Set();
    let locked = false; // 结果展示后锁定输入，避免误改

    BIAS_TAGS.forEach(function (tag) {
      const chip = h(
        '<button type="button" class="rounded-full border px-3 py-1 text-[12px] transition-all duration-150" ' +
        'style="border-color:#E4E7E5;color:' + BRAND.sub + ';background:#FFFFFF">' + esc(tag) + '</button>'
      );
      chip.addEventListener('click', function () {
        if (locked) {
          toast('想改的话先点"重新开始"');
          return;
        }
        if (selected.has(tag)) {
          selected.delete(tag);
          chip.style.background = '#FFFFFF';
          chip.style.borderColor = '#E4E7E5';
          chip.style.color = BRAND.sub;
        } else {
          selected.add(tag);
          chip.style.background = BRAND.greenSoft;
          chip.style.borderColor = BRAND.green;
          chip.style.color = BRAND.greenDeep;
        }
      });
      biasWrap.appendChild(chip);
    });

    function resetAll() {
      selected.clear();
      Array.prototype.forEach.call(biasWrap.children, function (chip) {
        chip.style.background = '#FFFFFF';
        chip.style.borderColor = '#E4E7E5';
        chip.style.color = BRAND.sub;
      });
      step1.value = '';
      step3.value = '';
      resultBox.classList.add('hidden');
      locked = false;
      toast('已清空，重新写一次');
    }

    function finish() {
      if (locked) {
        resultBox.classList.remove('hidden');
        resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }
      const s1 = step1.value.trim();
      const s3 = step3.value.trim();
      if (s1.length < 2) {
        toast('第 1 步还空着：先把脑子里那句话写下来', 'danger');
        step1.focus();
        return;
      }
      if (selected.size === 0) {
        toast('第 2 步至少选一个思维陷阱', 'danger');
        return;
      }
      if (s3.length < 2) {
        toast('第 3 步还空着：试着对自己温柔一点', 'danger');
        step3.focus();
        return;
      }

      // 安全兜底：若旧想法里出现高危表达，走全站统一援助弹窗（不阻断练习本身）
      if (Bridge.crisisCheck(s1)) {
        Bridge.openCrisis(s1);
      }

      rOld.textContent = '「' + s1 + '」';
      rNew.textContent = '「' + s3 + '」';
      rTags.innerHTML = Array.prototype.slice.call(selected).map(function (tag) {
        return '<span class="rounded-full px-2 py-0.5 text-[11px]" style="background:' + BRAND.greenSoft +
          ';color:' + BRAND.greenDeep + '">' + esc(tag) + '</span>';
      }).join('');

      resultBox.classList.remove('hidden');
      locked = true;
      resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      toast('转念完成，看看新的说法是不是更接近事实');
    }

    function composeText() {
      return [
        '【旧想法】' + step1.value.trim(),
        '【识别到的思维陷阱】' + Array.prototype.slice.call(selected).join('、'),
        '【新视角】' + step3.value.trim(),
        '',
        '—— 心栖校园 · CBT 思维转念练习'
      ].join('\n');
    }

    copyBtn.addEventListener('click', function () {
      copyText(composeText())
        .then(function () { toast('已复制，可以贴到备忘录里'); })
        .catch(function () { toast('复制失败，可以手动选中文字', 'danger'); });
    });

    saveBtn.addEventListener('click', function () {
      try {
        const list = JSON.parse(localStorage.getItem(CBT_STORAGE_KEY) || '[]');
        list.unshift({
          id: 'cbt_' + Date.now(),
          date: new Date().toISOString().slice(0, 10),
          thought: step1.value.trim(),
          biases: Array.prototype.slice.call(selected),
          reframe: step3.value.trim()
        });
        localStorage.setItem(CBT_STORAGE_KEY, JSON.stringify(list.slice(0, 30)));
        toast('已保存到本机（最多保留 30 条）');
      } catch (e) {
        toast('本机存储不可用，建议先复制内容', 'danger');
      }
    });

    finishBtn.addEventListener('click', finish);
    clearBtn.addEventListener('click', resetAll);

    return {
      el: el,
      destroy: function () {
        /* 纯静态交互，无需清理 */
      }
    };
  }

  /* ------------------------------------------------------------------ 子视图一 */
  function buildRelaxView(host) {
    const grid = h('<div class="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start"></div>');
    const breathing = buildBreathingCard();
    const cbt = buildCbtCard();
    grid.appendChild(breathing.el);
    grid.appendChild(cbt.el);
    host.appendChild(grid);

    return {
      onVisible: function () { /* 呼吸需用户主动开始，切回不自动播放 */ },
      onHidden: function () { breathing.pause(); },
      destroy: function () {
        breathing.destroy();
        cbt.destroy();
      }
    };
  }

  /* =========================================================================
   * 子视图二 · 微科普卡片与专业援助
   * ========================================================================= */
  const ARTICLES = [
    {
      id: 'blank',
      icon: '🧠',
      title: '期末考前大脑一片空白怎么办？',
      summary: '不是你变笨了，是紧张把"工作记忆"挤占了。3 个动作能把状态拉回来。',
      tag: '学业焦虑',
      body: [
        '一坐下来就忘光，是很多人考前最真实的体验。紧张时交感神经兴奋、皮质醇升高，大脑把资源优先分配给"警戒"，负责调取知识的**工作记忆**被挤占，于是出现"明明背过却想不起来"。这是应激反应，不是能力问题，更不是记忆力坏了。',
        '现场可以做的三件事：①先"外化"，把脑子里盘旋的恐惧写在草稿纸角落（"怕挂科""怕被比较"），写下来的念头会比在脑内循环时弱一些；②做 3 轮 4-7-8 呼吸，把过快的呼吸节律压下来，身体先松，注意力才回得来；③把任务拆成 25 分钟一小块，并刻意从"最熟悉的一章"开始，先拿到一点手感，再处理难的。',
        '如果卡在一道题上超过 2 分钟：停 30 秒，握拳再松开、耸肩再放下，先跳到会做的题。分数来自整张卷子，不来自某一道题。',
        '如果这种"空白"已经持续影响你多场考试、伴随整夜失眠或躯体不适，建议到校心理中心聊一次——早一点求助，比硬撑更省力。'
      ]
    },
    {
      id: 'boundary',
      icon: '🛏️',
      title: '宿舍边界感与非暴力沟通三步法',
      summary: '不撕破脸、也不憋着自己：把"你怎么这样"换成"事实 + 感受 + 具体请求"。',
      tag: '宿舍人际',
      body: [
        '宿舍矛盾的难点从来不是事情本身（键盘声、外放、卫生、借东西），而是"不好意思开口"和"开口就吵起来"这两种极端。边界不是冷漠，它只是让彼此知道"什么可以、什么不太行"。',
        '一个能落地的三步句式：**说事实（不评价）→ 说感受（用"我"开头）→ 提一个具体、可协商的请求**。示例："这周有三天十二点后还有键盘声（事实），我六点起床，睡不好第二天会头痛（感受），能不能十二点以后换静音键盘，或者去走廊打语音？（请求）"。',
        '两个细节很关键：①请求要具体到时间、动作、地点，别用"你能不能注意点"这种无法执行的表达；②给对方留出拒绝和商量的空间，边界是双向的，你也会需要别人的让步。',
        '如果真的谈不拢，不要靠忍：找宿管、辅导员或班级生活委员做一次三方规则协商，把作息、音量、访客、卫生写成大家认可的约定，比一次次情绪对峙有效。'
      ]
    },
    {
      id: 'phone',
      icon: '📱',
      title: '为什么越刷手机越觉得空虚？',
      summary: '短视频给的是即时奖励，"空虚"往往来自"今天没做成一件事"的失控感。',
      tag: '自我调节',
      body: [
        '刷短视频时，大脑获得的是低成本、高频率的即时奖励；停下来那一刻，刺激消失，落差就会以"空"的形式被感知。越疲惫越容易刷，越刷越难开始别的事，这个循环在睡前尤其明显（很多人叫它"报复性睡前拖延"）。',
        '空虚感背后通常有两层东西：一层是生理上的疲劳（睡眠不足会让情绪调节能力明显下降）；另一层是"今天没有做成一件事"的失控感——不是手机本身让人空虚，而是它挤掉了那些能带来"我完成了一点"的小事。',
        '可以试的替代方案：①"最小完成"法则——先做 15 分钟一件有明确终点的小事（洗杯子、下楼走一圈、写三行笔记），完成感比时长更重要；②给手机设"物理距离"，学习时把它放进包里或另一张桌子，比靠意志力硬扛有效；③把"打开 App 前的 5 分钟"留给一件有回报的小事，先启动，再决定要不要刷。',
        '如果空虚、提不起劲、什么都不想做已经持续两周以上，并且影响吃饭、睡觉和上课，那就不是"自律不够"，建议到校心理中心做一次评估。'
      ]
    },
    {
      id: 'lowmood',
      icon: '🌗',
      title: '情绪低落和抑郁症的区别：何时该寻求专业帮助',
      summary: '本页不做任何诊断，只说明"什么信号值得去找专业的人聊一次"。',
      tag: '求助指引',
      body: [
        '普通的情绪低落通常有明确诱因（失恋、挂科、被否定），强度会随时间下降，几天内能缓过来，期间仍然能完成基本的事情，也还能从喜欢的事里获得一点乐趣。',
        '值得主动求助的信号（这是提醒，不是诊断标准）：①情绪低落或兴趣减退**几乎每天、持续两周以上**；②睡眠、食欲、体重出现明显改变；③注意力下降，明显影响上课、作业、考试；④持续回避社交、回避原本喜欢的活动；⑤出现"活着没什么意思""不如消失"这类想法——这一条不需要等两周，请立刻联系专业资源或身边信任的人。',
        '求助路径从近到远：校心理健康教育中心（多数高校免费、可预约、有保密原则）→ 12355 青少年服务台、全国 24 小时免费心理援助热线 → 医院精神心理科门诊。去看医生不等于"我疯了"，它和发烧去内科是同一件事。',
        '本平台只提供情绪陪伴、心理科普与自助练习，不做任何医疗诊断，也不替代心理咨询与治疗。如果你正在犹豫"要不要去"，那通常就是可以去的时候。'
      ]
    }
  ];

  const HOTLINES = [
    {
      icon: '☎️',
      name: '12355 青少年服务台',
      desc: '共青团系统青少年心理与法律咨询服务，可电话或线上咨询，各地市均有接入。',
      action: '拨打 12355',
      href: 'tel:12355'
    },
    {
      icon: '🌙',
      name: '全国 24 小时免费心理援助热线',
      desc: '全天候值守，情绪崩溃、深夜无人可说的时刻可以直接打过去。',
      action: '400-161-9995',
      href: 'tel:4001619995'
    },
    {
      icon: '🕯️',
      name: '北京心理危机研究与干预中心热线',
      desc: '面向危机状态的公益热线，可提供紧急情绪支持与转介建议。',
      action: '010-82951332',
      href: 'tel:01082951332'
    },
    {
      icon: '🏫',
      name: '高校心理健康教育中心',
      desc: '校内免费、保密、可预约；首次咨询通常是评估与分流，不必一次说清所有事。',
      action: '查看预约提示',
      href: ''
    }
  ];

  let articleModal = null;

  function ensureArticleModal() {
    if (articleModal && articleModal.parentNode) return articleModal;

    articleModal = h(
      '<div id="tools-article-modal" class="fixed inset-0 z-[55] hidden items-center justify-center bg-stone-900/45 p-4 backdrop-blur-sm">' +
      '<div class="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl" style="max-height:86vh">' +
      '<div class="flex items-start justify-between gap-4 border-b border-stone-100 px-5 py-4">' +
      '<div class="min-w-0">' +
      '<p data-tag class="mb-1 inline-block rounded-full px-2 py-0.5 text-[11px]" style="background:' +
      BRAND.cream + ';color:' + BRAND.creamText + '"></p>' +
      '<h3 data-title class="text-base font-semibold leading-snug" style="color:' + BRAND.ink + '"></h3>' +
      '</div>' +
      '<button data-close class="shrink-0 rounded-full p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600" aria-label="关闭">' +
      '<span class="block text-lg leading-none">✕</span></button>' +
      '</div>' +
      '<div data-body class="max-h-[62vh] overflow-y-auto px-5 py-4 text-[13px] leading-[1.9]" style="color:#4A5450"></div>' +
      '<div class="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 px-5 py-3">' +
      '<p class="text-[11px]" style="color:' + BRAND.sub + '">内容为心理科普，不构成诊断或治疗建议</p>' +
      '<div class="flex gap-2">' +
      '<a href="tel:12355" class="rounded-full border px-3 py-1.5 text-[12px] no-underline" style="border-color:' +
      BRAND.greenLine + ';color:' + BRAND.green + '">需要人陪？拨打 12355</a>' +
      '<button data-ok class="rounded-full px-4 py-1.5 text-[12px] text-white" style="background:' + BRAND.green + '">我知道了</button>' +
      '</div></div></div></div>'
    );

    const closeFns = [
      articleModal.querySelector('[data-close]'),
      articleModal.querySelector('[data-ok]')
    ];
    closeFns.forEach(function (btn) {
      btn.addEventListener('click', closeArticleModal);
    });
    articleModal.addEventListener('click', function (e) {
      if (e.target === articleModal) closeArticleModal();
    });

    document.body.appendChild(articleModal);
    return articleModal;
  }

  function openArticleModal(article) {
    const modal = ensureArticleModal();
    modal.querySelector('[data-tag]').textContent = article.tag;
    modal.querySelector('[data-title]').textContent = article.title;
    modal.querySelector('[data-body]').innerHTML = article.body
      .map(function (p) {
        // 极简 Markdown：**加粗** → <strong>
        const html = esc(p).replace(/\*\*(.+?)\*\*/g, '<strong style="color:' + BRAND.ink + '">$1</strong>');
        return '<p class="mb-3 last:mb-0">' + html + '</p>';
      })
      .join('');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
  }

  function closeArticleModal() {
    if (!articleModal) return;
    articleModal.classList.add('hidden');
    articleModal.classList.remove('flex');
    document.body.style.overflow = '';
  }

  function buildEduView(host) {
    const wrap = h('<div class="space-y-5"></div>');

    // 微科普卡片
    const grid = h('<div class="grid grid-cols-1 sm:grid-cols-2 gap-4"></div>');
    ARTICLES.forEach(function (a) {
      const card = h(
        '<button type="button" class="group h-full rounded-2xl border border-stone-100 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">' +
        '<div class="flex items-start gap-3">' +
        '<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg" style="background:' +
        BRAND.greenSoft + '">' + a.icon + '</span>' +
        '<div class="min-w-0">' +
        '<p class="text-[11px] tracking-wide" style="color:' + BRAND.green + '">1 分钟微科普 · ' + esc(a.tag) + '</p>' +
        '<h4 class="mt-1 text-[14px] font-semibold leading-snug" style="color:' + BRAND.ink + '">' + esc(a.title) + '</h4>' +
        '</div></div>' +
        '<p class="mt-2 text-[12px] leading-relaxed" style="color:' + BRAND.sub + '">' + esc(a.summary) + '</p>' +
        '<p class="mt-3 text-[12px] font-medium" style="color:' + BRAND.green + '">展开阅读 <span class="inline-block transition-transform duration-200 group-hover:translate-x-1">→</span></p>' +
        '</button>'
      );
      card.addEventListener('click', function () { openArticleModal(a); });
      grid.appendChild(card);
    });

    // 援助通道
    const helpCard = h(
      '<div class="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">' +
      '<div class="flex flex-wrap items-center justify-between gap-2">' +
      '<h3 class="text-base font-semibold" style="color:' + BRAND.ink + '">🏮 校内外专业援助通道</h3>' +
      '<span class="rounded-full px-2.5 py-1 text-[11px]" style="background:' + BRAND.cream + ';color:' +
      BRAND.creamText + '">遇到持续困扰时，主动求助是勇敢的表现</span>' +
      '</div>' +
      '<div data-list class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"></div>' +
      '<p class="mt-3 text-[11px] leading-relaxed" style="color:' + BRAND.sub + '">如果你或身边的人正处在紧急危险中，请优先联系身边可信任的人、校方值守人员或直接拨打 110 / 120。</p>' +
      '</div>'
    );

    const list = helpCard.querySelector('[data-list]');
    HOTLINES.forEach(function (item) {
      const row = h(
        '<div class="rounded-xl p-3" style="background:#FBFCFB;border:1px solid #EFEFEC">' +
        '<div class="flex items-start gap-2.5">' +
        '<span class="text-base leading-none">' + item.icon + '</span>' +
        '<div class="min-w-0 flex-1">' +
        '<p class="text-[13px] font-medium" style="color:' + BRAND.ink + '">' + esc(item.name) + '</p>' +
        '<p class="mt-1 text-[11.5px] leading-relaxed" style="color:' + BRAND.sub + '">' + esc(item.desc) + '</p>' +
        '</div></div>' +
        (item.href
          ? '<a href="' + item.href + '" class="mt-2.5 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[12px] no-underline transition-colors" ' +
            'style="border-color:' + BRAND.greenLine + ';color:' + BRAND.green + '">' + esc(item.action) + '</a>'
          : '<button data-help class="mt-2.5 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[12px] transition-colors" ' +
            'style="border-color:' + BRAND.greenLine + ';color:' + BRAND.green + '">' + esc(item.action) + '</button>') +
        '</div>'
      );
      if (!item.href) {
        row.querySelector('[data-help]').addEventListener('click', function () {
          toast('预约方式：学校官网 / 学工系统"心理服务"入口，或直接到心理中心前台登记');
        });
      }
      list.appendChild(row);
    });

    wrap.appendChild(grid);
    wrap.appendChild(helpCard);
    host.appendChild(wrap);

    return {
      onVisible: function () { },
      onHidden: function () {
        closeArticleModal();
      },
      destroy: function () {
        closeArticleModal();
      }
    };
  }

  /* =========================================================================
   * 子视图三 · 校园群体情绪晴雨表（脱敏演示看板）
   * ========================================================================= */
  const METRICS = [
    { label: '本周校园匿名互动人次', value: '1,284', unit: '人次', note: '较上周 +9.2%' },
    { label: '情绪舒缓正向反馈率', value: '86.4', unit: '%', note: '练习后自评"松了一点"' },
    { label: '自助工具使用次数', value: '642', unit: '次', note: '呼吸训练占 58%' }
  ];

  const STRESS_DATA = [
    { label: '学业考试', value: 38 },
    { label: '实习就业', value: 26 },
    { label: '人际宿舍', value: 19 },
    { label: '作息与精力', value: 11 },
    { label: '其他', value: 6 }
  ];

  const WORD_TAGS = [
    { text: '焦虑', size: 26, weight: 600, op: 1 },
    { text: '疲惫', size: 22, weight: 600, op: 0.9 },
    { text: '迷茫', size: 19, weight: 500, op: 0.85 },
    { text: '内耗', size: 18, weight: 500, op: 0.8 },
    { text: '失眠', size: 16, weight: 500, op: 0.75 },
    { text: '孤独', size: 16, weight: 500, op: 0.7 },
    { text: '烦躁', size: 15, weight: 400, op: 0.68 },
    { text: '期待', size: 14, weight: 400, op: 0.62 },
    { text: '拖延', size: 13, weight: 400, op: 0.58 },
    { text: '松弛', size: 12, weight: 400, op: 0.52 }
  ];

  function buildDashboardView(host) {
    const wrap = h('<div class="space-y-5"></div>');

    /* 隐私合规横幅 */
    wrap.appendChild(
      h(
        '<div class="rounded-2xl p-4" style="background:' + BRAND.greenSoft + ';border:1px solid ' + BRAND.greenLine + '">' +
        '<p class="text-[12px] leading-relaxed" style="color:' + BRAND.greenDeep + '">' +
        '<strong>🔒 隐私合规说明：</strong>本看板仅展示全量匿名脱敏后的宏观统计原型数据，不追溯任何个人记录，' +
        '用于辅助高校辅导员与社区精准开展心理科普与关怀活动。' +
        '</p></div>'
      )
    );

    /* 指标卡 */
    const metricGrid = h('<div class="grid grid-cols-1 gap-4 sm:grid-cols-3"></div>');
    METRICS.forEach(function (m) {
      metricGrid.appendChild(
        h(
          '<div class="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">' +
          '<p class="text-[11.5px] leading-relaxed" style="color:' + BRAND.sub + '">' + esc(m.label) + '</p>' +
          '<p class="mt-2 font-semibold leading-none tabular-nums" style="color:' + BRAND.ink + ';font-size:26px">' +
          esc(m.value) + '<span class="ml-1 text-[12px] font-normal" style="color:' + BRAND.sub + '">' + esc(m.unit) + '</span></p>' +
          '<p class="mt-2 text-[11px]" style="color:' + BRAND.green + '">' + esc(m.note) + '</p>' +
          '</div>'
        )
      );
    });
    wrap.appendChild(metricGrid);

    /* 压力来源条形图 */
    const chartCard = h(
      '<div class="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">' +
      '<div class="flex flex-wrap items-center justify-between gap-2">' +
      '<h3 class="text-base font-semibold" style="color:' + BRAND.ink + '">📊 本学期校园压力来源分布</h3>' +
      '<span class="text-[11px]" style="color:' + BRAND.sub + '">脱敏汇总 · 原型样例数据</span>' +
      '</div>' +
      '<div class="relative mt-4" style="height:280px">' +
      '<canvas data-chart></canvas>' +
      '<div data-fallback class="absolute inset-0 hidden flex-col justify-center gap-2.5"></div>' +
      '</div></div>'
    );

    /* 词云墙 */
    const wordCard = h(
      '<div class="flex h-full flex-col rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">' +
      '<h3 class="text-base font-semibold" style="color:' + BRAND.ink + '">🏷️ 高校高频情绪词墙</h3>' +
      '<p class="mt-1 text-xs" style="color:' + BRAND.sub + '">匿名倾诉文本关键词频次（字号越大表示出现越频繁）</p>' +
      '<div data-words class="mt-4 flex flex-1 flex-wrap content-center items-center gap-x-3 gap-y-2.5 rounded-xl p-4" style="background:#FBFCFB;border:1px dashed #E4E7E5"></div>' +
      '<div class="mt-4 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3 text-[11px]" style="color:' + BRAND.sub + '">' +
      '<span class="rounded-full px-2 py-0.5" style="background:#F1F3F1">焦虑 · 疲惫 · 迷茫</span>' +
      '<span>稳居本学期前三位，期末与秋招双重叠加</span>' +
      '</div>' +
      '<p class="mt-2 text-[11px] leading-relaxed" style="color:#9AA39F">统计口径：近 7 天匿名倾诉文本的分词频次，仅用于趋势观察，不代表任何个体诊断。</p>' +
      '</div>'
    );

    const wordWrap = wordCard.querySelector('[data-words]');
    WORD_TAGS.forEach(function (t) {
      wordWrap.appendChild(
        h(
          '<span class="select-none transition-transform duration-200 hover:scale-105" style="font-size:' + t.size +
          'px;font-weight:' + t.weight + ';color:' + BRAND.green + ';opacity:' + t.op + '">' + esc(t.text) + '</span>'
        )
      );
    });

    /* 社区治理精准干预建议 */
    const suggestCard = h(
      '<div class="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">' +
      '<div class="flex flex-wrap items-center justify-between gap-2">' +
      '<h3 class="text-base font-semibold" style="color:' + BRAND.ink + '">🧭 社区治理精准干预建议</h3>' +
      '<span class="rounded-full px-2.5 py-1 text-[11px]" style="background:' + BRAND.cream + ';color:' +
      BRAND.creamText + '">规则触发 · 第 15-17 周</span>' +
      '</div>' +
      '<div class="mt-3 rounded-xl p-3" style="background:' + BRAND.cream + '">' +
      '<p class="text-[12.5px] leading-relaxed" style="color:#6E6250">' +
      '系统监测到第 15-17 周「学业考试」相关词频较学期均值上升 <strong>23%</strong>，' +
      '深夜 0-3 点互动占比同步升高，建议在考试周前启动定向关怀动作。' +
      '</p></div>' +
      '<ul class="mt-3 space-y-2 text-[12.5px] leading-relaxed" style="color:#4A5450">' +
      '<li class="flex gap-2"><span style="color:' + BRAND.green + '">①</span><span>心理中心定向推送「考前 1 分钟减压呼吸微课」至各学院班级群，配合本平台呼吸工具使用。</span></li>' +
      '<li class="flex gap-2"><span style="color:' + BRAND.green + '">②</span><span>以楼栋为单位开展线下解压活动（自习室解压角、考前团体放松），优先覆盖词频上升最快的学院。</span></li>' +
      '<li class="flex gap-2"><span style="color:' + BRAND.green + '">③</span><span>辅导员关注深夜高频使用群体，以"关心作息"而非"筛查问题"的方式做一次轻量回访。</span></li>' +
      '</ul>' +
      '<p class="mt-3 text-[11px] leading-relaxed" style="color:' + BRAND.sub + '">所有干预均基于匿名聚合统计，不定位、不标记、不评价任何个体；看板数据为课程演示原型，非真实统计口径。</p>' +
      '</div>'
    );

    wrap.appendChild(chartCard);
    const twoCol = h('<div class="grid grid-cols-1 gap-5 lg:grid-cols-2"></div>');
    twoCol.appendChild(wordCard);
    twoCol.appendChild(suggestCard);
    wrap.appendChild(twoCol);

    host.appendChild(wrap);

    /* ---------------- Chart.js 渲染与降级 ---------------- */
    const canvas = chartCard.querySelector('[data-chart]');
    const fallback = chartCard.querySelector('[data-fallback]');
    let chart = null;
    let resizeHandler = null;

    function drawFallbackBars() {
      canvas.style.display = 'none';
      fallback.classList.remove('hidden');
      fallback.classList.add('flex');
      fallback.innerHTML = STRESS_DATA.map(function (d) {
        return (
          '<div class="flex items-center gap-2">' +
          '<span class="w-16 shrink-0 text-right text-[11px]" style="color:' + BRAND.sub + '">' + esc(d.label) + '</span>' +
          '<div class="h-3 flex-1 rounded-full" style="background:#F1F3F1">' +
          '<div class="h-3 rounded-full" style="width:' + d.value * 2.4 + '%;background:' + BRAND.green + '"></div>' +
          '</div>' +
          '<span class="w-8 text-[11px] tabular-nums" style="color:' + BRAND.ink + '">' + d.value + '%</span>' +
          '</div>'
        );
      }).join('');
    }

    function ensureChart() {
      if (chart) {
        chart.resize();
        return;
      }
      if (!isElementVisible(canvas)) return;
      if (typeof window.Chart !== 'function') {
        drawFallbackBars();
        return;
      }
      // Tailwind CDN 尚未渲染完时容器宽度可能为 0，稍等一帧再画
      if (canvas.parentNode.clientWidth < 40) {
        setTimeout(ensureChart, 180);
        return;
      }

      chart = new window.Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: STRESS_DATA.map(function (d) { return d.label; }),
          datasets: [{
            label: '压力来源占比',
            data: STRESS_DATA.map(function (d) { return d.value; }),
            backgroundColor: ['#4A7C6F', '#6E9C8D', '#94B8AB', '#C3D6CD', '#E4EDE8'],
            borderColor: ['#4A7C6F', '#6E9C8D', '#94B8AB', '#C3D6CD', '#E4EDE8'],
            borderWidth: 1,
            borderRadius: 8,
            borderSkipped: false,
            barThickness: 18
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 900, easing: 'easeOutQuart' },
          layout: { padding: { top: 4, bottom: 4, left: 4, right: 12 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(47,58,54,.92)',
              displayColors: false,
              padding: 10,
              callbacks: {
                label: function (ctx) { return ' 占 ' + ctx.parsed.x + '%'; }
              }
            }
          },
          scales: {
            x: {
              max: 40,
              grid: { color: 'rgba(0,0,0,.04)', drawTicks: false },
              border: { display: false },
              ticks: {
                color: '#9AA39F',
                font: { size: 11 },
                callback: function (v) { return v + '%'; },
                stepSize: 10
              }
            },
            y: {
              grid: { display: false },
              border: { display: false },
              ticks: { color: '#5C6662', font: { size: 12 } }
            }
          }
        }
      });

      resizeHandler = function () {
        if (chart && isElementVisible(canvas)) chart.resize();
      };
      window.addEventListener('resize', resizeHandler);
    }

    // 首次直接尝试（若当前页面可见就立刻画，否则等 tabChanged）
    ensureChart();

    return {
      onVisible: function () {
        // 切回本页：容器宽度恢复，补画/重排图表
        setTimeout(ensureChart, 60);
      },
      onHidden: function () { },
      destroy: function () {
        if (resizeHandler) {
          window.removeEventListener('resize', resizeHandler);
          resizeHandler = null;
        }
        if (chart) {
          try { chart.destroy(); } catch (e) { /* ignore */ }
          chart = null;
        }
      }
    };
  }

  /* =========================================================================
   * 视图注册与切换
   * ========================================================================= */
  const VIEWS = {
    relax: {
      label: '🌿 自助放松工具',
      full: '自助放松工具',
      build: buildRelaxView
    },
    edu: {
      label: '📖 校园科普与专业援助',
      full: '校园科普与专业援助',
      build: buildEduView
    },
    dashboard: {
      label: '📊 校园情绪晴雨表',
      full: '校园情绪晴雨表',
      build: buildDashboardView
    }
  };

  let sectionEl = null;
  let navEl = null;
  let hostEl = null;
  let currentKey = 'relax';
  let currentView = null;
  let mounted = false;

  function updateNav() {
    if (!navEl) return;
    Array.prototype.forEach.call(navEl.children, function (btn) {
      const key = btn.getAttribute('data-view');
      const active = key === currentKey;
      btn.className =
        'rounded-full border px-3.5 py-1.5 text-[12.5px] whitespace-nowrap transition-all duration-200';
      if (active) {
        btn.style.background = BRAND.green;
        btn.style.borderColor = BRAND.green;
        btn.style.color = '#FFFFFF';
        btn.style.boxShadow = '0 6px 18px rgba(74,124,111,.22)';
      } else {
        btn.style.background = '#FFFFFF';
        btn.style.borderColor = '#E4E7E5';
        btn.style.color = BRAND.sub;
        btn.style.boxShadow = 'none';
      }
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  function switchView(key) {
    if (!VIEWS[key]) return;
    if (currentView && typeof currentView.destroy === 'function') {
      currentView.destroy();
      currentView = null;
    }
    hostEl.innerHTML = '';
    currentKey = key;
    currentView = VIEWS[key].build(hostEl);
    updateNav();
    // 若切换时页面已可见，通知一次 onVisible
    if (isElementVisible(sectionEl) && currentView && typeof currentView.onVisible === 'function') {
      currentView.onVisible();
    }
  }

  function mount() {
    sectionEl = document.getElementById('tab-tools');
    if (!sectionEl) {
      // 主壳尚未推送时也不报错，静默退出
      return;
    }
    if (mounted) return;
    mounted = true;

    sectionEl.innerHTML =
      '<div id="tools-root" class="w-full py-1">' +
      '<div class="mb-4 flex flex-wrap items-end justify-between gap-2">' +
      '<div>' +
      '<p class="text-[11px] tracking-[.2em]" style="color:' + BRAND.sub + '">自 助 工 具 箱</p>' +
      '<h2 class="mt-1 text-lg font-semibold sm:text-xl" style="color:' + BRAND.ink + '">先让身体慢下来，再陪情绪待一会儿</h2>' +
      '</div>' +
      '<p class="text-[11px] leading-relaxed" style="color:' + BRAND.sub + '">非医疗声明：本页练习属自助放松与心理科普，不替代心理咨询与医疗诊断。</p>' +
      '</div>' +
      '<div id="tools-nav" role="tablist" class="mb-4 flex gap-2 overflow-x-auto pb-1" style="-webkit-overflow-scrolling:touch">' +
      Object.keys(VIEWS).map(function (k) {
        return '<button type="button" role="tab" data-view="' + k + '">' + VIEWS[k].label + '</button>';
      }).join('') +
      '</div>' +
      '<div id="tools-view-host"></div>' +
      '</div>';

    navEl = sectionEl.querySelector('#tools-nav');
    hostEl = sectionEl.querySelector('#tools-view-host');

    Array.prototype.forEach.call(navEl.children, function (btn) {
      btn.addEventListener('click', function () {
        const key = btn.getAttribute('data-view');
        if (key !== currentKey) switchView(key);
      });
    });

    switchView(currentKey);

    // 全站 tab 切换联动：进入刷新图表、离开暂停定时器
    window.addEventListener('tabChanged', onTabChanged);
    // 兜底：有些实现只派发 diaryUpdated 等事件，这里再监听一次自定义跳转
    window.addEventListener('toolsFocus', function (e) {
      const key = e && e.detail && e.detail.view;
      if (key && VIEWS[key]) {
        switchView(key);
        if (sectionEl) sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  function onTabChanged() {
    if (!mounted || !currentView) return;
    if (isElementVisible(sectionEl)) {
      if (typeof currentView.onVisible === 'function') currentView.onVisible();
    } else if (typeof currentView.onHidden === 'function') {
      currentView.onHidden();
    }
  }

  // 对外暴露一个轻量入口，方便 module-chat.js 推荐工具时精确跳到对应练习
  window.ToolsModule = {
    show: function (viewKey) {
      if (VIEWS[viewKey]) switchView(viewKey);
      if (Bridge.switchTab('tools')) return;
      if (sectionEl) {
        sectionEl.classList.remove('hidden');
        switchView(viewKey || 'relax');
      }
    },
    focusBreathing: function () { this.show('relax'); },
    focusCbt: function () { this.show('relax'); },
    refresh: function () { if (mounted) switchView(currentKey); }
  };

  /* ------------------------------------------------------------------ 启动 */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
  // store.js 若在模块之后加载、且当时 tab-tools 已存在，再补一次挂载检查
  window.addEventListener('load', function () {
    if (!mounted) mount();
  });
})();
