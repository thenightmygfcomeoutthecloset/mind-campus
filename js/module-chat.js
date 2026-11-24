/* ============================================================
 * module-chat.js
 * 「心栖校园（MindCampus）」AI 情绪陪伴对话模块
 * 负责人：符冰雅
 *
 * 运行环境：纯 HTML5 + Tailwind CSS (CDN) + 原生 JavaScript
 * 渲染容器：<section id="tab-chat">（由 index.html 提供）
 * 可选依赖：window.AppStore（所有调用均已做存在性判断，可独立调试）
 *
 * 核心功能：
 *   1. 欢迎区 + 4 个大学生高频倾诉场景快捷卡片
 *   2. AI 结构化思考过程可视化（情绪标签/场景徽章 + 可折叠步骤条 + 正文 + 推荐工具卡）
 *   3. 前端高危词前置拦截 -> 危机援助弹窗
 *   4. /api/chat 失败时自动降级为内置模拟数据，保证离线演示不白屏
 *   5. 输入框回车发送 / Shift+Enter 换行 / 一键清空 / 发送防连点
 * ============================================================ */

(function () {
  'use strict';

  /* ------------------------------------------------------------
   * 一、常量与配置
   * ------------------------------------------------------------ */
  var API_URL = '/api/chat';

  // 低饱和治愈风配色（与全站统一视觉规范一致）
  var COLOR = {
    primary: '#4A7C6F',
    primaryHover: '#3B655A',
    accent: '#F3ECE1',      // 浅杏暖米（提示语、标签底色）
    bg: '#F6F8F6',
    crisis: '#D9534F',
    textDark: '#374151',
    text: '#4B5563',
    textMuted: '#9CA3AF',
    border: '#EDEAE2'
  };

  // 大学生高频倾诉场景快捷卡片
  var SCENE_CARDS = [
    { icon: '📚', text: '期末复习进度落后，怕挂科影响绩点' },
    { icon: '🛏️', text: '宿舍作息不同步，又不好意思开口沟通' },
    { icon: '💼', text: '看到同学都拿到实习或保研，我很焦虑迷茫' },
    { icon: '🌧️', text: '莫名其妙提不起劲，觉得自己什么都做不好' }
  ];

  // 接口等待阶段文案（用于优雅的动态加载态）
  var LOADING_STEPS = ['情绪感知中', '匹配校园支持策略', '生成共情回应'];

  /* ------------------------------------------------------------
   * 二、全局对象引用（做存在性判断，支持独立调试）
   * ------------------------------------------------------------ */
  var AppStore = (typeof window !== 'undefined' && window.AppStore && typeof window.AppStore === 'object')
    ? window.AppStore
    : null;

  function storeGetChatHistory() {
    if (AppStore && typeof AppStore.getChatHistory === 'function') {
      try { return AppStore.getChatHistory(); } catch (e) { return []; }
    }
    return [];
  }
  function storeSaveChatHistory(list) {
    if (AppStore && typeof AppStore.saveChatHistory === 'function') {
      try { AppStore.saveChatHistory(list); } catch (e) { /* 忽略 */ }
    }
  }
  function storeCheckLocalCrisis(text) {
    if (AppStore && typeof AppStore.checkLocalCrisis === 'function') {
      try { return !!AppStore.checkLocalCrisis(text); } catch (e) { return false; }
    }
    return false;
  }
  function storeOpenCrisisModal(text) {
    if (AppStore && typeof AppStore.openCrisisModal === 'function') {
      try { AppStore.openCrisisModal(text); return true; } catch (e) { return false; }
    }
    return false;
  }
  function storeSwitchTab(tabId) {
    if (AppStore && typeof AppStore.switchTab === 'function') {
      try { AppStore.switchTab(tabId); return true; } catch (e) { return false; }
    }
    return false;
  }

  /* ------------------------------------------------------------
   * 三、模块状态
   * ------------------------------------------------------------ */
  var messages = [];       // 本地对话记录（含结构化的 AI 回复）
  var isSending = false;   // 发送中防连点标志
  var loadingTimer = null; // 加载动画定时器
  var container = null;    // <section id="tab-chat">
  var messagesEl = null;   // 消息列表容器
  var inputEl = null;      // 输入框
  var sendBtn = null;      // 发送按钮

  /* ------------------------------------------------------------
   * 四、工具函数
   * ------------------------------------------------------------ */
  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function scrollToBottom() {
    if (messagesEl) {
      requestAnimationFrame(function () {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      });
    }
  }

  /* ------------------------------------------------------------
   * 五、离线演示兜底：内置模拟 JSON
   *    当 /api/chat 调用失败（如未配 API Key）时使用，
   *    保证页面不白屏、能完整演示结构化渲染效果。
   * ------------------------------------------------------------ */
  var FALLBACK_SCENES = [
    {
      keys: ['期末', '复习', '挂科', '绩点', '考试', '考不好', '不及格', '背书'],
      data: {
        isCrisis: false,
        emotion: '学业焦虑',
        emotionLevel: 4,
        scene: '期末与绩点压力',
        steps: [
          '情绪识别：检测到高频紧张、失控与自我怀疑',
          '场景匹配：高校考试周学业压力典型情境',
          '策略调用：共情接纳 + 拆分最小复习目标 + 4-7-8 呼吸降噪'
        ],
        reply: '听起来，期末的复习进度让你现在有点喘不过气来。担心挂科、怕影响绩点，这种紧绷是很多同学在考试周都会经历的，它说明你其实很在乎、也很想做好。我们不妨先把“复习不完”这件大事，拆成一个今天就能完成的、很小的一步——比如只整理某一章的重点。允许自己先完成最小的一步，你已经在努力了。',
        recommendedTool: { type: 'breathing', title: '试着做 1 分钟 4-7-8 呼吸训练', desc: '先让紧绷的身体慢下来，再回到书桌前' },
        dailyQuote: '允许自己今天只完成最小的一步，你已经很努力了。'
      }
    },
    {
      keys: ['宿舍', '作息', '室友', '舍友', '睡眠', '熄灯', '吵'],
      data: {
        isCrisis: false,
        emotion: '人际困扰',
        emotionLevel: 3,
        scene: '宿舍作息与人际边界',
        steps: [
          '情绪识别：检测到憋闷、委屈与不敢表达的顾虑',
          '场景匹配：宿舍作息不同步引发的边界困扰',
          '策略调用：情绪安抚 + 非暴力沟通三步法引导'
        ],
        reply: '作息不同步又不好意思开口，这种憋在心里的小委屈，时间久了确实会累积成疲惫。你不是在“找麻烦”，你只是在照顾自己的睡眠和状态，这是完全正当的需要。可以试试非暴力沟通的方式：先讲事实（“最近我睡得比较早”），再讲感受（“有点担心休息不好”），最后提一个具体的小请求。很多时候，温和地说出来，对方反而更容易配合。',
        recommendedTool: { type: 'cbt', title: '用 CBT 转念，放下“说了会尴尬”的担心', desc: '把脑海里的预判拆开看一看' },
        dailyQuote: '温和而清楚地表达需求，是善待自己也善待他人。'
      }
    },
    {
      keys: ['实习', '保研', 'offer', '同学', '就业', '秋招', '比较', '羡慕', '迷茫'],
      data: {
        isCrisis: false,
        emotion: '就业迷茫',
        emotionLevel: 4,
        scene: '同辈比较与职业规划压力',
        steps: [
          '情绪识别：检测到焦虑、迷茫与比较带来的自我怀疑',
          '场景匹配：实习/保研/秋招阶段的同辈压力',
          '策略调用：正常化感受 + 聚焦自身节奏 + 具体行动建议'
        ],
        reply: '看到身边的同学陆续有了着落，自己却还在迷茫，这种感觉真的很不好受。但每个人的起点、节奏和机会都不同，用别人的“高光时刻”来对照自己的“进行时”，往往会放大焦虑。与其盯着别人，不如回到自己身上：你真正想要的方向是什么？哪怕还不清晰，也可以先迈出一小步——改一版简历、投一份实习、和一位学长聊聊。一步步走，路会慢慢清晰。',
        recommendedTool: { type: 'cbt', title: '用 CBT 转念，把“我落后了”重新写一遍', desc: '识别比较带来的认知偏差' },
        dailyQuote: '你的人生有自己的时区，不必和任何人抢跑。'
      }
    },
    {
      keys: ['提不起劲', '做不好', '没意思', '低落', '难受', '崩溃', '累', '无意义', '什么都'],
      data: {
        isCrisis: false,
        emotion: '情绪低落',
        emotionLevel: 4,
        scene: '情绪疲惫与自我价值感',
        steps: [
          '情绪识别：检测到持续低能量与自我否定倾向',
          '场景匹配：情绪疲惫期的动力低谷',
          '策略调用：去病理化安抚 + 降低自我要求 + 温柔行动提示'
        ],
        reply: '莫名提不起劲、觉得自己什么都做不好，这种状态本身就很消耗人。请先别急着责怪自己“不够努力”——情绪的低谷和身体的疲惫一样，需要被照顾，而不是被批评。今天可以先不要求自己“振作”，只做一件很小、很轻的事：出门晒晒太阳、喝一杯温水、把乱糟糟的桌子收拾一小块。你的价值从来不取决于“做得好不好”，而在于你这个人本身。',
        recommendedTool: { type: 'breathing', title: '做一次 4-7-8 呼吸，给情绪一个出口', desc: '什么都不用想，只跟着呼吸的节奏' },
        dailyQuote: '你不需要今天就好起来，只需要今天温柔地陪着自己。'
      }
    }
  ];

  var FALLBACK_GENERIC = {
    isCrisis: false,
    emotion: '情绪波动',
    emotionLevel: 3,
    scene: '校园日常情绪困扰',
    steps: [
      '情绪识别：捕捉到你此刻的烦闷与疲惫',
      '场景匹配：校园生活中的常见情绪困扰',
      '策略调用：共情陪伴 + 情绪命名 + 呼吸降噪'
    ],
    reply: '谢谢你愿意把此刻的感受说出来，这本身就是很勇敢的一步。情绪没有对错，它会来，也会慢慢过去。此刻如果觉得累，就先不要急着解决什么，允许自己停下来喘口气。我会一直在这里陪着你，你可以再多说一点，我们一起慢慢理一理。',
    recommendedTool: { type: 'breathing', title: '做一次 4-7-8 呼吸，让紧绷慢下来', desc: '跟随呼吸的节奏，给自己一分钟安静' },
    dailyQuote: '情绪会来，也会过去，而你并不孤单。'
  };

  function buildFallbackReply(userText) {
    var text = String(userText || '');
    for (var i = 0; i < FALLBACK_SCENES.length; i++) {
      var scene = FALLBACK_SCENES[i];
      for (var j = 0; j < scene.keys.length; j++) {
        if (text.indexOf(scene.keys[j]) !== -1) {
          return scene.data;
        }
      }
    }
    return FALLBACK_GENERIC;
  }

  /* ------------------------------------------------------------
   * 六、界面渲染
   * ------------------------------------------------------------ */

  // 注入模块专属样式（颜色精确到规范值，类名以 mc- 前缀避免冲突）
  function injectStyles() {
    if (document.getElementById('mc-chat-style')) return;
    var style = document.createElement('style');
    style.id = 'mc-chat-style';
    style.textContent = [
      '.mc-wrap { max-width: 760px; margin: 0 auto; padding: 20px 16px 96px; }',
      '.mc-card { background:#FFFFFF; border:1px solid ' + COLOR.border + '; border-radius:1rem; box-shadow:0 1px 2px rgba(0,0,0,0.04); }',
      '.mc-bubble { max-width: 82%; padding: 14px 16px; border-radius: 1rem; line-height: 1.7; font-size: 15px; word-break: break-word; }',
      '.mc-user-bubble { margin-left: auto; background:' + COLOR.primary + '; color:#fff; border-bottom-right-radius: 4px; }',
      '.mc-ai-bubble { margin-right: auto; background:#fff; border:1px solid ' + COLOR.border + '; border-bottom-left-radius: 4px; color:' + COLOR.textDark + '; }',
      '.mc-badge { display:inline-block; padding:2px 10px; border-radius:999px; font-size:12px; line-height:1.6; }',
      '.mc-badge-emotion { background:' + COLOR.accent + '; color:' + COLOR.primary + '; font-weight:600; }',
      '.mc-badge-scene { background:' + COLOR.bg + '; color:' + COLOR.text + '; }',
      '.mc-steps { margin-top:10px; background:' + COLOR.bg + '; border:1px solid ' + COLOR.border + '; border-radius:0.75rem; padding:10px 12px; font-size:13px; }',
      '.mc-steps summary { cursor:pointer; color:' + COLOR.primary + '; font-weight:600; user-select:none; }',
      '.mc-steps ol { margin:10px 0 2px; padding-left: 18px; color:' + COLOR.text + '; }',
      '.mc-steps ol li { margin-bottom:6px; }',
      '.mc-reply { margin-top:10px; }',
      '.mc-tool-card { margin-top:12px; background:' + COLOR.accent + '; border:1px solid ' + COLOR.border + '; border-radius:0.75rem; padding:12px 14px; display:flex; align-items:center; justify-content:space-between; gap:10px; }',
      '.mc-tool-title { font-weight:600; color:' + COLOR.textDark + '; font-size:14px; }',
      '.mc-tool-desc { font-size:12px; color:' + COLOR.text + '; margin-top:2px; }',
      '.mc-tool-btn { flex-shrink:0; background:' + COLOR.primary + '; color:#fff; border:none; border-radius:999px; padding:7px 14px; font-size:13px; cursor:pointer; transition:background .15s; }',
      '.mc-tool-btn:hover { background:' + COLOR.primaryHover + '; }',
      '.mc-quote { margin-top:10px; font-size:12px; color:' + COLOR.textMuted + '; font-style:italic; }',
      '.mc-scene-grid { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:10px; }',
      '@media (max-width: 480px){ .mc-scene-grid { grid-template-columns:1fr; } .mc-bubble{ max-width:92%; } }',
      '.mc-scene-btn { text-align:left; background:#fff; border:1px solid ' + COLOR.border + '; border-radius:0.9rem; padding:12px; cursor:pointer; font-size:13px; color:' + COLOR.textDark + '; transition:border-color .15s, box-shadow .15s; }',
      '.mc-scene-btn:hover { border-color:' + COLOR.primary + '; box-shadow:0 2px 8px rgba(74,124,111,0.12); }',
      '.mc-loading-row { display:flex; align-items:center; gap:8px; padding:6px 0; font-size:13px; color:' + COLOR.textMuted + '; transition:all .3s; }',
      '.mc-loading-row.active { color:' + COLOR.primary + '; font-weight:600; }',
      '.mc-dot { width:8px; height:8px; border-radius:999px; background:#ddd; flex-shrink:0; }',
      '.mc-loading-row.active .mc-dot { background:' + COLOR.primary + '; animation:mc-pulse 1s infinite; }',
      '@keyframes mc-pulse { 0%,100%{ opacity:1; transform:scale(1);} 50%{ opacity:.4; transform:scale(1.4);} }',
      '.mc-crisis-tip { background:#FDF0EF; border:1px solid ' + COLOR.crisis + '; color:' + COLOR.crisis + '; border-radius:0.9rem; padding:14px 16px; font-size:14px; }',
      '.mc-input { width:100%; min-height:44px; max-height:120px; resize:none; border:1px solid ' + COLOR.border + '; border-radius:0.9rem; padding:12px 14px; font-size:14px; color:' + COLOR.textDark + '; background:#fff; outline:none; transition:border-color .15s; }',
      '.mc-input:focus { border-color:' + COLOR.primary + '; }',
      '.mc-send-btn { background:' + COLOR.primary + '; color:#fff; border:none; border-radius:0.9rem; padding:0 20px; font-size:14px; cursor:pointer; transition:background .15s; white-space:nowrap; }',
      '.mc-send-btn:hover:not(:disabled) { background:' + COLOR.primaryHover + '; }',
      '.mc-send-btn:disabled { opacity:.5; cursor:not-allowed; }',
      '.mc-clear-btn { background:transparent; border:none; color:' + COLOR.textMuted + '; font-size:12px; cursor:pointer; text-decoration:underline; }',
      '.mc-clear-btn:hover { color:' + COLOR.textDark + '; }'
    ].join('\n');
    document.head.appendChild(style);
  }

  function renderWelcome() {
    var cardsHtml = SCENE_CARDS.map(function (c) {
      return '<button type="button" class="mc-scene-btn" data-scene="' + escapeHtml(c.text) + '">' +
        '<span style="margin-right:6px;">' + c.icon + '</span>' + escapeHtml(c.text) +
        '</button>';
    }).join('');

    var el = document.createElement('div');
    el.className = 'mc-welcome';
    el.innerHTML =
      '<div class="mc-card" style="padding:20px; margin-bottom:16px;">' +
        '<h3 style="margin:0 0 6px; font-size:17px; color:' + COLOR.textDark + ';">🌿 你好呀，我是心栖</h3>' +
        '<p style="margin:0; font-size:13px; color:' + COLOR.text + ';">在这里，你可以安心地把情绪说出来。我不会评判你，只会陪着你慢慢理一理。<br>' +
        '<span style="color:' + COLOR.textMuted + ';">本平台仅提供情绪陪伴，不替代专业心理咨询与医疗诊断。</span></p>' +
      '</div>' +
      '<div style="font-size:13px; color:' + COLOR.text + '; margin:0 0 8px 2px;">✨ 也可以从一个场景开始聊：</div>' +
      '<div class="mc-scene-grid">' + cardsHtml + '</div>';
    messagesEl.appendChild(el);
  }

  function renderUserMessage(content) {
    var el = document.createElement('div');
    el.className = 'mc-bubble mc-user-bubble';
    el.textContent = content; // 用 textContent 防 XSS
    messagesEl.appendChild(el);
  }

  function renderCrisisTip() {
    var el = document.createElement('div');
    el.className = 'mc-crisis-tip';
    el.innerHTML = '🫂 我注意到你的话里可能藏着很难受的时刻。请先停一下，看看这个页面上的专业求助方式——有人能真正帮到你，也请记得，你很重要。';
    messagesEl.appendChild(el);
  }

  // 渲染纯文本的 AI 消息（兼容 store.js 初始欢迎语等只有 content 字段的记录）
  function renderPlainAssistant(content) {
    var el = document.createElement('div');
    el.className = 'mc-bubble mc-ai-bubble';
    el.textContent = content;
    messagesEl.appendChild(el);
  }

  function renderAssistantMessage(data) {
    var el = document.createElement('div');
    el.className = 'mc-bubble mc-ai-bubble';

    var stepsHtml = (data.steps && data.steps.length)
      ? '<details class="mc-steps" open>' +
          '<summary>💡 AI 情绪理解过程</summary>' +
          '<ol>' + data.steps.map(function (s) { return '<li>' + escapeHtml(s) + '</li>'; }).join('') + '</ol>' +
        '</details>'
      : '';

    var toolHtml = '';
    var tool = data.recommendedTool;
    if (tool && tool.type && tool.type !== 'none') {
      toolHtml =
        '<div class="mc-tool-card">' +
          '<div>' +
            '<div class="mc-tool-title">🧘 ' + escapeHtml(tool.title || '推荐自助小练习') + '</div>' +
            '<div class="mc-tool-desc">' + escapeHtml(tool.desc || '') + '</div>' +
          '</div>' +
          '<button type="button" class="mc-tool-btn" data-goto="tools">去练习 →</button>' +
        '</div>';
    }

    var quoteHtml = data.dailyQuote
      ? '<p class="mc-quote">“' + escapeHtml(data.dailyQuote) + '”</p>'
      : '';

    el.innerHTML =
      '<div style="margin-bottom:4px;">' +
        '<span class="mc-badge mc-badge-emotion">😌 ' + escapeHtml(data.emotion || '情绪') + '</span> ' +
        '<span class="mc-badge mc-badge-scene">' + escapeHtml(data.scene || '校园日常') + '</span>' +
      '</div>' +
      stepsHtml +
      '<p class="mc-reply">' + escapeHtml(data.reply || '') + '</p>' +
      toolHtml +
      quoteHtml;

    messagesEl.appendChild(el);
  }

  // 渲染优雅的三阶段加载态
  function renderLoading() {
    var el = document.createElement('div');
    el.className = 'mc-bubble mc-ai-bubble';
    el.id = 'mc-loading-bubble';
    var rows = LOADING_STEPS.map(function (s, i) {
      return '<div class="mc-loading-row' + (i === 0 ? ' active' : '') + '" data-step="' + i + '">' +
        '<span class="mc-dot"></span><span>' + s + '</span>' +
        (i < LOADING_STEPS.length - 1 ? '<span style="margin-left:auto; color:#ddd;">⋯</span>' : '') +
      '</div>';
    }).join('');
    el.innerHTML = rows;
    messagesEl.appendChild(el);

    // 循环切换三个阶段的文案
    var step = 0;
    loadingTimer = setInterval(function () {
      step = (step + 1) % LOADING_STEPS.length;
      var rowsEl = el.querySelectorAll('.mc-loading-row');
      rowsEl.forEach(function (row, idx) {
        if (idx === step) { row.classList.add('active'); } else { row.classList.remove('active'); }
      });
    }, 900);
  }

  function removeLoading() {
    if (loadingTimer) { clearInterval(loadingTimer); loadingTimer = null; }
    var bubble = document.getElementById('mc-loading-bubble');
    if (bubble && bubble.parentNode) { bubble.parentNode.removeChild(bubble); }
  }

  function renderAll() {
    if (!messagesEl) return;
    messagesEl.innerHTML = '';

    if (messages.length === 0) {
      renderWelcome();
    } else {
      // 对话非空时，顶部保留可折叠的快捷倾诉入口
      var quick = document.createElement('div');
      quick.className = 'mc-card';
      quick.style.cssText = 'padding:12px 16px; margin-bottom:16px;';
      quick.innerHTML =
        '<details>' +
          '<summary style="cursor:pointer; color:' + COLOR.primary + '; font-size:13px; font-weight:600;">✨ 快捷倾诉（点此展开）</summary>' +
          '<div class="mc-scene-grid" style="margin-top:10px;">' +
            SCENE_CARDS.map(function (c) {
              return '<button type="button" class="mc-scene-btn" data-scene="' + escapeHtml(c.text) + '">' +
                '<span style="margin-right:6px;">' + c.icon + '</span>' + escapeHtml(c.text) + '</button>';
            }).join('') +
          '</div>' +
        '</details>';
      messagesEl.appendChild(quick);

      messages.forEach(function (m) {
        if (m.role === 'user') {
          renderUserMessage(m.content);
        } else if (m.role === 'assistant') {
          if (m.isCrisisLocal) {
            renderCrisisTip();
          } else if (m.reply || m.emotion || (m.steps && m.steps.length)) {
            renderAssistantMessage(m);
          } else if (m.content) {
            renderPlainAssistant(m.content);
          }
        }
      });
    }
    scrollToBottom();
  }

  /* ------------------------------------------------------------
   * 七、发送逻辑
   * ------------------------------------------------------------ */
  function setSending(sending) {
    isSending = sending;
    if (sendBtn) sendBtn.disabled = sending;
    if (inputEl) {
      inputEl.disabled = sending;
      if (sending) {
        inputEl.blur();
      } else {
        inputEl.focus();
      }
    }
  }

  function send(text) {
    if (isSending) return;
    text = String(text || '').trim();
    if (!text) return;

    // 1. 前端高危词前置拦截（不发常规闲聊）
    if (storeCheckLocalCrisis(text)) {
      messages.push({ role: 'user', content: text });
      messages.push({ role: 'assistant', isCrisisLocal: true });
      storeSaveChatHistory(messages);
      inputEl.value = '';
      renderAll();
      storeOpenCrisisModal(text); // 弹出全站统一危机援助弹窗
      return;
    }

    // 2. 记录用户消息
    messages.push({ role: 'user', content: text });
    storeSaveChatHistory(messages);
    inputEl.value = '';
    renderAll();
    setSending(true);
    renderLoading();

    // 3. 构造发送给后端的 messages（仅 role + content）
    var payloadMessages = messages
      .filter(function (m) { return m.role === 'user' || (m.role === 'assistant' && (m.reply || m.content)); })
      .map(function (m) {
        return { role: m.role, content: m.role === 'user' ? m.content : (m.reply || m.content) };
      });
    payloadMessages.push({ role: 'user', content: text });

    callApi(payloadMessages, text);
  }

  function callApi(payloadMessages, rawText) {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timeoutId = setTimeout(function () { if (controller) controller.abort(); }, 20000);

    var fetchOpts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: payloadMessages })
    };
    if (controller) { fetchOpts.signal = controller.signal; }

    fetch(API_URL, fetchOpts)
      .then(function (res) {
        if (!res.ok) { throw new Error('HTTP ' + res.status); }
        return res.json();
      })
      .then(function (data) { handleSuccess(data, false); })
      .catch(function (err) {
        // 4. 离线/未配 Key 兜底：用内置模拟 JSON 完整演示渲染效果
        handleSuccess(buildFallbackReply(rawText), true);
      })
      .finally(function () {
        if (timeoutId) { clearTimeout(timeoutId); }
      });
  }

  function handleSuccess(data, isFallback) {
    removeLoading();
    setSending(false);

    var msg = {
      role: 'assistant',
      isCrisis: !!data.isCrisis,
      emotion: data.emotion || '情绪波动',
      emotionLevel: data.emotionLevel || 3,
      scene: data.scene || '校园日常',
      steps: data.steps || [],
      reply: data.reply || '我在，我在听。',
      recommendedTool: data.recommendedTool || { type: 'none' },
      dailyQuote: data.dailyQuote || '',
      isFallback: isFallback
    };
    messages.push(msg);
    storeSaveChatHistory(messages);
    renderAll();

    // 后端判定为危机 -> 弹出统一援助弹窗
    if (msg.isCrisis) {
      storeOpenCrisisModal(msg.reply);
    }
  }

  /* ------------------------------------------------------------
   * 八、事件绑定与初始化
   * ------------------------------------------------------------ */
  function bindEvents() {
    // 场景卡片 / 快捷倾诉（事件委托）
    messagesEl.addEventListener('click', function (e) {
      var sceneBtn = e.target.closest('[data-scene]');
      if (sceneBtn) {
        var t = sceneBtn.getAttribute('data-scene');
        inputEl.value = t;
        inputEl.focus();
        return;
      }
      var toolBtn = e.target.closest('[data-goto="tools"]');
      if (toolBtn) {
        storeSwitchTab('tools');
      }
    });

    // 发送按钮
    sendBtn.addEventListener('click', function () {
      send(inputEl.value);
    });

    // 回车发送 / Shift+Enter 换行
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send(inputEl.value);
      }
    });

    // 输入框高度自适应
    inputEl.addEventListener('input', function () {
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
    });
  }

  function init() {
    container = document.getElementById('tab-chat');
    if (!container) {
      // 主页面容器缺失时不报错（可能主框架尚未推送），仅静默退出
      console.warn('[module-chat] 未找到 <section id="tab-chat">，模块未挂载。');
      return;
    }

    injectStyles();
    container.innerHTML = '';

    // 布局骨架
    container.innerHTML =
      '<div class="mc-wrap">' +
        '<div id="mc-messages" style="display:flex; flex-direction:column; gap:12px; padding-bottom:8px;"></div>' +
        '<div style="position:fixed; bottom:0; left:0; right:0; background:rgba(246,248,246,0.96); backdrop-filter:blur(6px); border-top:1px solid ' + COLOR.border + '; padding:12px 16px; z-index:20;">' +
          '<div class="mc-wrap" style="padding:0; display:flex; gap:10px; align-items:flex-end;">' +
            '<textarea id="mc-input" class="mc-input" rows="1" placeholder="把此刻的感受说出来吧…（Enter 发送，Shift+Enter 换行）"></textarea>' +
            '<button type="button" id="mc-send" class="mc-send-btn">发送</button>' +
          '</div>' +
          '<div class="mc-wrap" style="padding:4px 0 0; text-align:right;">' +
            '<button type="button" id="mc-clear" class="mc-clear-btn">清空当前对话</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    messagesEl = document.getElementById('mc-messages');
    inputEl = document.getElementById('mc-input');
    sendBtn = document.getElementById('mc-send');

    var clearBtn = document.getElementById('mc-clear');
    clearBtn.addEventListener('click', function () {
      messages = [];
      storeSaveChatHistory(messages);
      renderAll();
    });

    // 恢复历史对话；若只有初始欢迎语（尚无任何用户消息），则展示本模块自己的欢迎区
    var history = storeGetChatHistory();
    if (Array.isArray(history) && history.length) {
      var hasUserMsg = history.some(function (m) { return m && m.role === 'user'; });
      messages = hasUserMsg ? history : [];
    }

    bindEvents();
    renderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
