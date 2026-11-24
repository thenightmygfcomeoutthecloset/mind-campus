/**
 * js/store.js — 心栖校园 (MindCampus) 全局数据中心与通信总线
 * 负责：localStorage 存储、7天预置模拟数据、跨模块事件通知、全局Tab切换、心理危机拦截检测
 * 作者：吴磊
 */

(function () {
  'use strict';

  const STORAGE_KEY_DIARY = 'mind_campus_v1_diary';
  const STORAGE_KEY_CHAT = 'mind_campus_v1_chat';

  // 辅助函数：格式化 YYYY-MM-DD
  function formatDate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 辅助函数：获取相对今天的日期字符串（offsetDays: 0为今天，-1为昨天...）
  function getRelativeDateStr(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return formatDate(d);
  }

  // 生成贴合中国大学生的 7 天预置情绪日记模拟数据（动态对齐当前日期）
  function generate7DaysDemoDiary() {
    return [
      {
        id: 'diary-demo-7',
        date: getRelativeDateStr(-6),
        mood: '焦虑',
        score: 2,
        tags: ['期末考试', '绩点复习', '图书馆'],
        note: '高数和专业课期末考挤在同一周，厚厚一叠课件怎么也翻不完，坐在图书馆自习室感觉呼吸都急促了，好担心挂科影响保研。',
        aiQuote: '把大任务切成微小的番茄钟，允许自己一步一步来。你比想象中更坚韧。'
      },
      {
        id: 'diary-demo-6',
        date: getRelativeDateStr(-5),
        mood: '疲惫',
        score: 2,
        tags: ['小组作业', '沟通不畅', '熬夜赶工'],
        note: '小组大作业快到截止日，同组有人失联不交部分，最后只能自己连夜通宵改 PPT 和排版，眼睛酸涩，心里又气又累。',
        aiQuote: '划清责任的边界，守护好自己的心力。今晚先好好睡个整觉吧。'
      },
      {
        id: 'diary-demo-5',
        date: getRelativeDateStr(-4),
        mood: '低落',
        score: 1,
        tags: ['求职秋招', '面试受挫', '未来迷茫'],
        note: '投递了好几家心仪实习都显示简历未通过，下午收到了感谢信。同寝室室友已经拿到大厂 offer，突然陷入强烈的同辈比较与自我怀疑。',
        aiQuote: '每个人的时钟都有自己的节奏。被拒绝并不代表你不优秀，只是方向还在调校。'
      },
      {
        id: 'diary-demo-4',
        date: getRelativeDateStr(-3),
        mood: '平静',
        score: 3,
        tags: ['操场夜跑', '晚风晚霞', '耳机单曲'],
        note: '吃完晚饭去东区操场慢跑了五公里，晚风吹过很舒服，耳机里听着喜欢的歌，看到看台上很多人坐着聊天，杂乱的心情逐渐沉静下来。',
        aiQuote: '奔跑时的心跳是生命力最真实的证明，在脚步里重构自己的秩序。'
      },
      {
        id: 'diary-demo-3',
        date: getRelativeDateStr(-2),
        mood: '烦躁',
        score: 2,
        tags: ['宿舍作息', '生活琐事', '人际距离'],
        note: '宿舍作息有些不太同步，想早睡的时候室友在开麦打游戏，虽然沟通了但也有些尴尬，感觉集体生活中拥有个人独立空间好奢侈。',
        aiQuote: '戴上降噪耳机，构建一个属于你自己的微型精神避难所。'
      },
      {
        id: 'diary-demo-2',
        date: getRelativeDateStr(-1),
        mood: '平静',
        score: 4,
        tags: ['热奶茶', '小步前进', '自我宽容'],
        note: '下午完成了两篇论文文献精读，犒劳了自己一杯热烤奶。坐在窗边看着银杏叶飘落，突然意识到没必要非得做到完美，能完成就已经很棒了。',
        aiQuote: '完成了比完美更重要。接纳不完美的自己，本身就是一种成熟的勇气。'
      },
      {
        id: 'diary-demo-1',
        date: getRelativeDateStr(0),
        mood: '开心',
        score: 5,
        tags: ['火锅小聚', '期末通关', '朋友倾听'],
        note: '跟好友一起去校门口吃了热气腾腾的铜锅涮肉，聊了好多各自的糗事和焦虑，原来大家都有相似的挣扎，倾诉完后浑身轻松又充满能量！',
        aiQuote: '温暖的连接是治愈孤独最良性的解药。记住此刻闪光的欢笑。'
      }
    ];
  }

  // 初始欢迎消息
  function getInitialChatMessages() {
    return [
      {
        role: 'assistant',
        content: '同学你好呀！我是「心栖校园」的情绪陪伴 AI 树洞 🍃。\n\n无论今天是考试复习压力、宿舍人际摩擦、未来升学秋招迷茫，还是仅仅觉得有些疲惫想找人说说话，我都在这里温和地倾听你。你可以直接打字倾诉，或者点击下方的常见场景卡片开始～'
      }
    ];
  }

  // 高危危机关键词本地硬过滤词库
  const CRISIS_KEYWORDS = [
    '自杀', '自残', '割腕', '跳楼', '服毒', '不想活了', '结束生命',
    '活着没意思', '离开这个世界', '吃安眠药', '上吊', '想死', '绝望厌世',
    '去死', '轻生', '杀了我', '想要死掉', '准备跳下去'
  ];

  // 全局 Store 定义
  const AppStore = {
    /**
     * 1. 情绪日记相关方法
     */
    getDiaryEntries: function () {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_DIARY);
        if (!raw) {
          const defaultData = generate7DaysDemoDiary();
          localStorage.setItem(STORAGE_KEY_DIARY, JSON.stringify(defaultData));
          return defaultData;
        }
        const parsed = JSON.parse(raw);
        // 按日期降序排列（最新的一天在最前）
        return Array.isArray(parsed)
          ? parsed.sort((a, b) => new Date(b.date) - new Date(a.date))
          : [];
      } catch (err) {
        console.error('[AppStore] 读取日记数据失败，重置为预置数据:', err);
        return generate7DaysDemoDiary();
      }
    },

    addDiaryEntry: function (entry) {
      if (!entry || !entry.date) return false;
      const list = this.getDiaryEntries();
      
      // 检查当天是否已有日记，有则更新，无则新增
      const existingIndex = list.findIndex(item => item.date === entry.date || (entry.id && item.id === entry.id));
      if (existingIndex >= 0) {
        list[existingIndex] = { ...list[existingIndex], ...entry };
      } else {
        const newEntry = {
          id: entry.id || 'diary-' + Date.now(),
          score: entry.score || 3,
          mood: entry.mood || '平静',
          tags: entry.tags || [],
          note: entry.note || '',
          aiQuote: entry.aiQuote || '记录本身就是一种自我疗愈。',
          ...entry
        };
        list.unshift(newEntry);
      }

      try {
        localStorage.setItem(STORAGE_KEY_DIARY, JSON.stringify(list));
        // 派发自定义全局事件通知其他模块刷新（例如王雨涵的日历与图表）
        window.dispatchEvent(new CustomEvent('diaryUpdated', { detail: { entry, list } }));
        return true;
      } catch (err) {
        console.error('[AppStore] 写入日记数据失败:', err);
        return false;
      }
    },

    /**
     * 2. 对话历史记录相关方法
     */
    getChatHistory: function () {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_CHAT);
        if (!raw) return getInitialChatMessages();
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : getInitialChatMessages();
      } catch (err) {
        console.error('[AppStore] 读取聊天记录失败:', err);
        return getInitialChatMessages();
      }
    },

    saveChatHistory: function (messages) {
      try {
        localStorage.setItem(STORAGE_KEY_CHAT, JSON.stringify(messages || []));
        window.dispatchEvent(new CustomEvent('chatUpdated', { detail: { messages } }));
      } catch (err) {
        console.error('[AppStore] 保存聊天记录失败:', err);
      }
    },

    clearChatHistory: function () {
      try {
        const initial = getInitialChatMessages();
        localStorage.setItem(STORAGE_KEY_CHAT, JSON.stringify(initial));
        window.dispatchEvent(new CustomEvent('chatUpdated', { detail: { messages: initial } }));
      } catch (err) {
        console.error('[AppStore] 清空聊天记录失败:', err);
      }
    },

    /**
     * 3. 标签页切换逻辑
     */
    switchTab: function (tabId) {
      const validTabs = ['chat', 'diary', 'tools'];
      if (!validTabs.includes(tabId)) return;

      // 切换视图容器显隐
      validTabs.forEach(id => {
        const el = document.getElementById('tab-' + id);
        if (el) {
          if (id === tabId) {
            el.classList.remove('hidden');
          } else {
            el.classList.add('hidden');
          }
        }
      });

      // 更新 PC 导航按钮高亮状态
      document.querySelectorAll('#pc-nav .nav-btn').forEach(btn => {
        const target = btn.getAttribute('data-tab');
        if (target === tabId) {
          btn.className = 'nav-btn px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-1.5 bg-white text-[#4A7C6F] shadow-xs';
        } else {
          btn.className = 'nav-btn px-4 py-2 rounded-lg text-sm font-medium text-stone-600 hover:text-stone-900 transition-all duration-150 flex items-center gap-1.5';
        }
      });

      // 更新移动端导航按钮高亮状态
      document.querySelectorAll('#mobile-nav .mobile-nav-btn').forEach(btn => {
        const target = btn.getAttribute('data-tab');
        if (target === tabId) {
          btn.className = 'mobile-nav-btn flex flex-col items-center gap-1 text-[#4A7C6F]';
        } else {
          btn.className = 'mobile-nav-btn flex flex-col items-center gap-1 text-stone-400';
        }
      });

      // 派发全局 tabChanged 事件，供各自模块懒加载或重绘图表（如 Chart.js resize）
      window.dispatchEvent(new CustomEvent('tabChanged', { detail: { tabId } }));
    },

    /**
     * 4. 心理危机检测与弹窗控制
     */
    checkLocalCrisis: function (text) {
      if (!text || typeof text !== 'string') return false;
      const lower = text.toLowerCase();
      return CRISIS_KEYWORDS.some(kw => lower.includes(kw));
    },

    openCrisisModal: function (reason) {
      const modal = document.getElementById('crisis-modal');
      const reasonEl = document.getElementById('crisis-modal-reason');
      if (reasonEl && reason) {
        reasonEl.textContent = typeof reason === 'string' ? reason : '检测到强烈的痛苦感受或危机信号';
      }
      if (modal) {
        modal.classList.remove('hidden');
      }
    },

    closeCrisisModal: function () {
      const modal = document.getElementById('crisis-modal');
      if (modal) {
        modal.classList.add('hidden');
      }
    },

    /**
     * 5. 重置 7 天演示数据（方便课堂演示、期末答辩）
     */
    resetDemoData: function () {
      const freshData = generate7DaysDemoDiary();
      localStorage.setItem(STORAGE_KEY_DIARY, JSON.stringify(freshData));
      this.clearChatHistory();
      window.dispatchEvent(new CustomEvent('diaryUpdated', { detail: { list: freshData } }));
      
      // 轻量浮动提示
      const toast = document.createElement('div');
      toast.className = 'fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#4A7C6F] text-white text-xs px-4 py-2 rounded-full shadow-lg transition-all animate-bounce';
      toast.textContent = '✨ 7 天真实大学生演示数据已重置完成！';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2500);
    }
  };

  // 挂载到全局 window 对象
  window.AppStore = AppStore;

  // 页面加载完成时初始化日记数据
  document.addEventListener('DOMContentLoaded', function () {
    // 触发一次读取以确保 localStorage 中有预置数据
    AppStore.getDiaryEntries();
  });

})();
