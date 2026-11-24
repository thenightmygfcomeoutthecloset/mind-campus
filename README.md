# 「心栖校园 MindCampus」大学生 AI 情绪支持平台

> **项目定位**：面向中国大学生的非诊断型 AI 情绪疏导、心理自助打卡与校园心理健康辅助平台。  
> **核心原则**：纯前端轻量化、零数据库（`localStorage` 本地安全存储 + 7天预置演示数据）、极简后端（原生 Node.js / Vercel Serverless 代理 DeepSeek API）。

---

## 一、团队成员与 Git 文件独占分工

本项目采用 **“文件严格物理隔离、AI 辅助编程、全员直接 Git 推送”** 的零冲突协作模式。每位同学仅修改和提交属于自己的独立文件：

| 成员 | 角色定位 | 核心负责文件（Git 独占） | 核心交付功能 |
| :--- | :--- | :--- | :--- |
| **吴磊** | 仓库管理、系统底座与后端 | `index.html`<br>`js/store.js`<br>`api/chat.js`<br>`server.js`<br>`.gitignore` | 网站骨架外壳、全局数据中心（localStorage + 7天模拟数据）、DeepSeek 接口转发、高危心理危机硬拦截弹窗、Vercel 部署 |
| **符冰雅** | AI 情绪陪伴交互 | `js/module-chat.js` | 情绪对话流、大学生高频场景快捷入口（期末/考公/宿舍/情感）、思考步骤可视化步骤条、智能工具卡片推荐 |
| **王雨涵** | 情绪数据可视化与传播 | `js/module-diary.js` | 每日情绪打卡表单、月度情绪日历、情绪变化趋势折线图（Chart.js）、一键导出「今日情绪明信片」（html2canvas） |
| **程苏皖** | 心理自助工具与校园治理 | `js/module-tools.js` | 4-7-8 呼吸减压训练动效、CBT 思维转念练习卡片、校园互助科普、全校脱敏情绪晴雨表大屏 |

---

## 二、极简 3 步本地运行（无需复杂打包）

本项目前端全部采用 CDN 引入（Tailwind CSS、Chart.js、html2canvas），后端使用 Node.js 原生模块，**无需执行任何 `npm install` 安装！**

### 1. 克隆代码
```bash
git clone https://github.com/thenightmygfcomeoutthecloset/mind-campus.git
cd mind-campus
```

### 2. 配置环境变量
复制环境模板并填入你的 DeepSeek API Key（若未配置 Key，平台内置了温柔的智能兜底应答）：
```bash
cp .env.example .env
# Windows PowerShell:
# Copy-Item .env.example .env
```
打开 `.env` 文件填入：
```env
DEEPSEEK_API_KEY=sk-xxxxxx你的真实Keyxxxxxx
```

### 3. 启动本地服务
```bash
node server.js
```
打开浏览器访问：`http://localhost:3000`

---

## 三、队友日常 Git 提交流程（口诀：拉取 -> 只加自己文件 -> 推送）

每位同学请严格遵守**只提交自己名下文件**的原则，避免合并冲突：

```bash
# 1. 提交前拉取最新代码
git pull --rebase origin main

# 2. 只添加自己负责的文件（以符冰雅为例，换成你自己的文件名）
git add js/module-chat.js

# 3. 提交并推送到 GitHub
git commit -m "feat: 更新AI对话模块核心逻辑"
git push origin main
```

---

## 四、免责声明与危机援助通道

> ⚠️ **非医疗诊断声明**：本平台仅提供大学生情绪倾听、心理科普与自助调节练习，绝不替代专业心理咨询、心理评估或医疗精神科诊断。

若遇到紧急心理危机或自伤冲动，请立即拨打以下专业援助通道：
* **共青团 12355 青少年权益与心理咨询服务台**：直拨 `12355`
* **全国 24 小时免费心理危机干预热线**：`400-161-9995` / `010-82951332`
* **北京心理危机研究与干预中心热线**：`010-82951332`
* **校园紧急渠道**：请联系所在高校校医院急诊或心理健康教育中心 24 小时值班老师。
