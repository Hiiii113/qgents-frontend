(function () {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const byId = (id) => document.getElementById(id);

  const screens = $$('[data-screen]');
  const viewSections = $$('#canvas > section.view');
  const railProject = byId('railProject');
  const railTeam = byId('railTeam');
  const context = byId('context');
  const trace = byId('trace');
  const traceToggle = byId('traceToggle');
  const chatlog = byId('chatlog');
  const canvas = byId('canvas');
  const scrim = byId('scrim');
  const toastEl = byId('toast');
  const composer = byId('composerInput');
  const mentionPop = byId('mentionPop');
  const mentionList = byId('mentionList');
  const mentionEmpty = byId('mentionEmpty');
  const sendBtn = byId('sendBtn');

  const PROJECT_VIEWS = new Set(['chat', 'agents', 'memory', 'skills', 'repos', 'diff', 'project-settings']);
  const TEAM_VIEWS = new Set(['team-home', 'team-settings', 'github', 'product-settings']);

  const MEMBERS = [
    { id: 'u-hele', name: '何乐', kind: '人', note: '项目管理员' },
    { id: 'u-xuyiran', name: '徐亦然', kind: '人', note: '团队管理员' },
    { id: 'u-zhoumu', name: '周牧', kind: '人', note: '项目成员' },
    { id: 'u-chenchi', name: '陈迟', kind: '人', note: '项目成员' },
    { id: 'ag_7f21c9', name: 'Qgent', kind: 'Agent', note: '默认 Agent' }
  ];

  const RUN_STEPS = [
    { name: '读取群上下文', meta: '18 条消息 · memory.md · 2 个附件' },
    { name: '定位相关文件', meta: 'search · src/pages/ProjectDetail' },
    { name: '写入改动', meta: 'edit_file · +42 −8' },
    { name: '运行 lint', meta: 'npm run lint' },
    { name: '跑测试', meta: 'vitest run' },
    { name: '推送分支', meta: 'git push · feat/agent-pending-state' }
  ];
  const RUN_DURATIONS = ['0.4s', '0.2s', '1.1s', '2.6s', '3.8s', '0.9s'];

  const state = {
    view: 'chat',
    group: 'g-default',
    groupName: '默认群',
    project: 'qgents-web',
    team: '砺行科技',
    traceOpen: true,
    traceAvailable: true,
    run: null,
    mentionIndex: 0,
    mentionMatches: [],
    savedTrace: null,
    logs: new Map(),
    roles: { '砺行科技': '团队管理员', '澄海实验室': '团队管理员' },
    github: true,
    bannerDismissed: false,
    loadToken: 0
  };

  const FULL_PROJECT = 'qgents-web';
  const PROJECTS = {
    'qgents-web': {
      desc: '前端工作台，React 19 + TypeScript strict + Ant Design 6。',
      repos: [
        ['qgents-web', 'main', 12],
        ['qgents-api', 'develop', 8],
        ['qgents-infra', 'main', 3]
      ]
    },
    'qgents-api': {
      desc: 'Spring Boot 服务端，MySQL + Redis + Docker。',
      repos: [['qgents-api', 'develop', 8]]
    },
    'qgents-infra': {
      desc: '部署与镜像，nginx 与容器编排。',
      repos: [['qgents-infra', 'main', 3]]
    },
    'design-system': { desc: '已归档，只读。', repos: [] }
  };
  state.logs.set(FULL_PROJECT, chatlog ? chatlog.innerHTML : '');

  /* ---------------- 基础工具 ---------------- */

  let toastTimer = 0;
  function toast(message, tone) {
    if (!toastEl) return;
    const text = byId('toastText');
    if (text) text.textContent = message;
    else toastEl.textContent = message;
    const icon = byId('toastIcon');
    if (icon) icon.setAttribute('href', tone ? '#i-alert' : '#i-check');
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toastEl.hidden = true;
    }, 2600);
  }

  function now() {
    return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }

  function setError(id, message) {
    const node = byId(id);
    if (!node) return;
    node.textContent = message || '';
    node.hidden = !message;
  }

  function clearErrors(ids) {
    ids.forEach((id) => setError(id, ''));
  }

  /* ---------------- 屏幕与视图 ---------------- */

  function setScreen(name) {
    screens.forEach((section) => {
      section.hidden = section.dataset.screen !== name;
    });
    document.body.dataset.screen = name;
  }

  function setView(name) {
    if ((name === 'team-settings' || name === 'github') && state.roles[state.team] !== '团队管理员') {
      setScreen('forbidden');
      return;
    }
    state.view = name;
    setScreen('app');
    viewSections.forEach((section) => {
      section.hidden = section.dataset.view !== name;
    });
    const teamScope = TEAM_VIEWS.has(name);
    railProject.hidden = false;
    railTeam.hidden = true;
    if (teamScope) {
      railProject.hidden = true;
      railTeam.hidden = false;
    }
    $$('.rail__btn[data-view]').forEach((button) => {
      if (button.dataset.view === name) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    const isChat = name === 'chat';
    context.hidden = !isChat;
    if (!isChat) closeContext();
    trace.hidden = !(isChat && state.traceOpen && state.traceAvailable);
    trace.classList.toggle('is-open', !trace.hidden);
    const projectCrumb = byId('projectBtn');
    if (projectCrumb) projectCrumb.hidden = teamScope;
    if (isChat && state.group === 'g-default' && state.project === FULL_PROJECT) {
      applyTraceAvailability(true);
    }
    if (canvas) canvas.scrollTop = 0;
    if (isChat) chatlog.scrollTop = chatlog.scrollHeight;
  }

  function applyTraceAvailability(available) {
    state.traceAvailable = available;
    if (traceToggle) {
      traceToggle.disabled = !available;
      traceToggle.title = available ? '' : '这个群还没有运行记录';
      traceToggle.setAttribute('aria-expanded', String(available && state.traceOpen));
    }
    trace.hidden = !(available && state.traceOpen && state.view === 'chat');
    trace.classList.toggle('is-open', !trace.hidden);
  }

  function setTrace(open) {
    state.traceOpen = open;
    trace.hidden = !(open && state.traceAvailable && state.view === 'chat');
    trace.classList.toggle('is-open', !trace.hidden);
    if (traceToggle) traceToggle.setAttribute('aria-expanded', String(!trace.hidden));
  }

  function openContext() {
    context.classList.add('is-open');
    scrim.hidden = false;
    const toggle = byId('ctxToggle');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
    const search = byId('groupSearch');
    if (search) search.focus();
  }

  function closeContext() {
    if (!context.classList.contains('is-open')) return;
    context.classList.remove('is-open');
    scrim.hidden = true;
    const toggle = byId('ctxToggle');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    if (toggle && toggle.offsetParent) toggle.focus();
  }

  /* ---------------- 浮层 ---------------- */

  let openPop = null;

  function closePopovers(restoreFocus) {
    if (!openPop) return;
    openPop.pop.hidden = true;
    openPop.trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus && openPop.trigger.offsetParent) openPop.trigger.focus();
    openPop = null;
  }

  function openPopover(pop, trigger) {
    if (!pop || !trigger) return;
    if (openPop && openPop.pop === pop) {
      closePopovers(true);
      return;
    }
    closePopovers(false);
    pop.hidden = false;
    const rect = trigger.getBoundingClientRect();
    const width = pop.offsetWidth || 260;
    const height = pop.offsetHeight || 200;
    let left = rect.left;
    if (left + width > window.innerWidth - 12) left = window.innerWidth - width - 12;
    left = Math.max(12, left);
    let top = rect.bottom + 6;
    if (top + height > window.innerHeight - 12) top = Math.max(12, rect.top - height - 6);
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
    trigger.setAttribute('aria-expanded', 'true');
    openPop = { pop, trigger };
    const focusTarget = $('input, button', pop);
    if (focusTarget) focusTarget.focus();
  }

  function bindPopover(triggerId, popId) {
    const trigger = byId(triggerId);
    const pop = byId(popId);
    if (!trigger || !pop) return;
    trigger.addEventListener('click', () => openPopover(pop, trigger));
  }

  bindPopover('projectBtn', 'popProject');
  bindPopover('searchBtn', 'popSearch');
  bindPopover('bellBtn', 'popBell');
  bindPopover('meBtn', 'popMe');

  /* ---------------- 项目与团队切换 ---------------- */

  function openProject(name) {
    if (state.run && state.run.status === 'running') stopRun();
    captureProject();
    state.project = name;
    const label = byId('projectName');
    if (label) label.textContent = name;
    $$('[data-open-project]').forEach((button) => {
      button.setAttribute('aria-current', String(button.dataset.openProject === name));
    });
    closePopovers(false);
    setView('chat');
    renderGroupsFor(name);
    trace.hidden = true;
    state.loadToken += 1;
    const token = state.loadToken;
    skeleton(chatlog, 5);
    window.setTimeout(() => {
      if (token !== state.loadToken) return;
      renderProject(name);
      toast('已切换到项目 ' + name);
    }, 420);
  }

  function switchTeam(name) {
    state.team = name;
    const home = byId('homeTeamName');
    if (home) home.textContent = name;
    const settingsTitle = $('.view[data-view="team-settings"] .h1');
    if (settingsTitle) settingsTitle.textContent = name + ' · 成员';
    $$('[data-switch-team]').forEach((button) => {
      button.setAttribute('aria-current', String(button.dataset.switchTeam === name));
    });
    closePopovers(false);
    setView('team-home');
    toast('已切换到团队 ' + name);
  }

  /* ---------------- 群聊 ---------------- */

  const groupLogs = {
    'g-weekly': [
      ['徐亦然', '09:20', '周四的排期改成下午两点，先用半小时过一遍 diff 审阅页。'],
      ['何乐', '09:22', '可以。那页现在只有通过和请求修改，回退到聊天要保留筛选。'],
      ['叶知秋', '09:26', '间距档位统一到 8 的倍数，别在这一版再引入新的数字。']
    ],
    'g-release': [
      ['Qgent', '昨天 18:02', '分支 feature/release-notes 已推送，3 个文件，未发现 lint 问题。'],
      ['周牧', '昨天 18:10', '先别合并，等接口那边把字段名定下来。']
    ],
    'g-design': [
      ['叶知秋', '昨天 15:40', '头像用首字母，不要引入陌生人照片。'],
      ['徐亦然', '昨天 15:44', '同意。成员列表里的 Agent 和人靠标签区分，不靠颜色。']
    ]
  };

  function renderGroupLog(id) {
    if (id === 'g-default') {
      const saved = state.logs.get(state.project);
      if (saved) {
        chatlog.innerHTML = saved;
      } else {
        chatlog.innerHTML = '';
        chatlog.appendChild(dayMarker('今天'));
        chatlog.appendChild(emptyNote('这个群还没有消息。输入 @ 派活给已启用的 Agent，或先打个招呼。'));
      }
    } else {
      const rows = groupLogs[id] || [];
      chatlog.innerHTML = '';
      const day = document.createElement('p');
      day.className = 'daybreak';
      const dayText = document.createElement('span');
      dayText.textContent = '最近消息';
      day.appendChild(dayText);
      chatlog.appendChild(day);
      if (!rows.length) {
        const empty = document.createElement('p');
        empty.className = 'empty';
        empty.style.borderTop = '0';
        empty.textContent = '这个群还没有消息。输入 @ 派活给已启用的 Agent，或先打个招呼。';
        chatlog.appendChild(empty);
      }
      rows.forEach(([name, time, text]) => {
        const article = document.createElement('article');
        article.className = 'msg';
        const avatar = document.createElement('span');
        avatar.className = name === 'Qgent' ? 'avatar avatar--agent' : 'avatar';
        if (name === 'Qgent') {
          avatar.innerHTML = '<svg viewBox="0 0 32 32" class="mark__svg"><circle cx="15" cy="15" r="8.5" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="26" cy="26" r="3.6" fill="var(--mark)"/></svg>';
        } else {
          avatar.textContent = name.slice(0, 1);
        }
        const body = document.createElement('div');
        body.className = 'msg__body';
        const head = document.createElement('p');
        head.className = 'msg__head';
        const nameEl = document.createElement('span');
        nameEl.className = 'msg__name';
        nameEl.textContent = name;
        if (name === 'Qgent') {
          const tag = document.createElement('span');
          tag.className = 'tag tag--agent';
          tag.textContent = 'Agent';
          head.appendChild(tag);
        }
        const timeEl = document.createElement('time');
        timeEl.className = 'msg__time';
        timeEl.textContent = time;
        head.prepend(nameEl);
        head.appendChild(timeEl);
        const textEl = document.createElement('p');
        textEl.className = 'msg__text';
        textEl.textContent = text;
        body.append(head, textEl);
        article.append(avatar, body);
        chatlog.appendChild(article);
      });
    }
    chatlog.scrollTop = chatlog.scrollHeight;
  }

  function saveTraceSnapshot() {
    if (!state.traceAvailable) return;
    state.savedTrace = {
      title: byId('traceTitle').textContent,
      trigger: $('.trace__trigger').textContent,
      steps: byId('traceSteps').innerHTML,
      foot: byId('traceFoot').textContent
    };
  }

  function restoreTraceSnapshot() {
    if (!state.savedTrace) return;
    byId('traceTitle').textContent = state.savedTrace.title;
    $('.trace__trigger').textContent = state.savedTrace.trigger;
    byId('traceSteps').innerHTML = state.savedTrace.steps;
    byId('traceFoot').textContent = state.savedTrace.foot;
  }

  function resetGroupUI() {
    state.group = 'g-default';
    state.groupName = '默认群';
    $$('.grouprow').forEach((button) => {
      button.setAttribute('aria-current', String(button.dataset.group === 'g-default'));
    });
    const title = $('.chathead .h2');
    if (title) title.textContent = '默认群';
    const meta = $('.chathead .meta');
    if (meta) {
      meta.textContent = '';
      const projectTag = document.createElement('span');
      projectTag.className = 'mono';
      projectTag.textContent = state.project;
      const members = state.project === FULL_PROJECT ? '5 名成员，含 1 个 Agent' : '2 名成员，含 1 个 Agent';
      meta.append(projectTag, document.createTextNode(' · ' + members));
    }
    renderGroupLog('g-default');
    if (state.project === FULL_PROJECT) {
      restoreTraceSnapshot();
      state.traceOpen = true;
      applyTraceAvailability(true);
    } else {
      applyTraceAvailability(false);
      setTrace(false);
    }
  }

  function openGroup(id, name) {
    if (id === state.group) return;
    if (state.run && state.run.status === 'running') stopRun();
    if (state.group === 'g-default') {
      state.logs.set(state.project, chatlog.innerHTML);
      saveTraceSnapshot();
    }
    state.group = id;
    state.groupName = name;
    $$('.grouprow').forEach((button) => {
      button.setAttribute('aria-current', String(button.dataset.group === id));
    });
    const title = $('.chathead .h2');
    if (title) title.textContent = name;
    renderGroupLog(id);
    if (id === 'g-default') {
      restoreTraceSnapshot();
      state.traceOpen = true;
      applyTraceAvailability(true);
    } else {
      applyTraceAvailability(false);
      setTrace(false);
    }
  }

  /* ---------------- 消息与运行 ---------------- */

  function scrollLog() {
    chatlog.scrollTop = chatlog.scrollHeight;
  }

  function appendUserMessage(text) {
    const article = document.createElement('article');
    article.className = 'msg';
    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    avatar.textContent = '徐';
    const body = document.createElement('div');
    body.className = 'msg__body';
    const head = document.createElement('p');
    head.className = 'msg__head';
    const nameEl = document.createElement('span');
    nameEl.className = 'msg__name';
    nameEl.textContent = '徐亦然';
    const tag = document.createElement('span');
    tag.className = 'tag tag--role';
    tag.textContent = '团队管理员';
    const timeEl = document.createElement('time');
    timeEl.className = 'msg__time';
    timeEl.textContent = now();
    head.append(nameEl, tag, timeEl);
    const textEl = document.createElement('p');
    textEl.className = 'msg__text';
    textEl.textContent = text;
    body.append(head, textEl);
    article.append(avatar, body);
    chatlog.appendChild(article);
    scrollLog();
  }

  function createRunMessage(requestText, agentName) {
    const article = document.createElement('article');
    article.className = 'msg';
    article.dataset.runMessage = 'active';
    const avatar = document.createElement('span');
    avatar.className = 'avatar avatar--agent';
    avatar.innerHTML = '<svg viewBox="0 0 32 32" class="mark__svg"><circle cx="15" cy="15" r="8.5" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="26" cy="26" r="3.6" fill="var(--mark)"/></svg>';
    const body = document.createElement('div');
    body.className = 'msg__body';
    const head = document.createElement('p');
    head.className = 'msg__head';
    const nameEl = document.createElement('span');
    nameEl.className = 'msg__name';
    nameEl.textContent = agentName;
    const tag = document.createElement('span');
    tag.className = 'tag tag--agent';
    tag.textContent = 'Agent';
    const timeEl = document.createElement('time');
    timeEl.className = 'msg__time';
    timeEl.textContent = now();
    head.append(nameEl, tag, timeEl);
    const textEl = document.createElement('p');
    textEl.className = 'msg__text';
    textEl.dataset.runText = 'true';
    textEl.textContent = '开始执行：' + requestText.replace(/^(@\S+\s*)+/, '');
    const card = document.createElement('div');
    card.className = 'run run--running';
    card.innerHTML =
      '<div class="run__head">' +
      '<span class="dot dot--live"></span>' +
      '<span class="run__state">运行中</span>' +
      '<span class="run__meta">第 1/' + RUN_STEPS.length + ' 步 · ' + RUN_STEPS[0].name + '</span>' +
      '<button class="btn btn--link" type="button" data-run-stop>停止</button>' +
      '</div>';
    body.append(head, textEl, card);
    article.append(avatar, body);
    chatlog.appendChild(article);
    scrollLog();
    return { article, textEl, card };
  }

  function resetTrace(title, trigger) {
    byId('traceTitle').textContent = title;
    $('.trace__trigger').textContent = trigger;
    const steps = byId('traceSteps');
    steps.innerHTML = '';
    const list = [];
    RUN_STEPS.forEach((step, index) => {
      const li = document.createElement('li');
      li.className = 'step step--idle';
      const indexEl = document.createElement('span');
      indexEl.className = 'step__i';
      indexEl.textContent = String(index + 1);
      const wrap = document.createElement('div');
      const nameEl = document.createElement('p');
      nameEl.className = 'step__name';
      nameEl.textContent = step.name;
      const metaEl = document.createElement('p');
      metaEl.className = 'step__meta';
      metaEl.textContent = step.meta;
      wrap.append(nameEl, metaEl);
      const timeEl = document.createElement('span');
      timeEl.className = 'step__time mono';
      timeEl.textContent = '—';
      li.append(indexEl, wrap, timeEl);
      steps.appendChild(li);
      list.push(li);
    });
    byId('traceFoot').textContent = '运行中 · 改动只在沙箱内';
    return list;
  }

  function clearRun() {
    if (!state.run) return;
    state.run.timers.forEach((timer) => clearTimeout(timer));
    state.run = null;
  }

  function startRun(requestText, agentName) {
    if (state.run && state.run.status === 'running') stopRun();
    clearRun();
    applyTraceAvailability(true);
    setTrace(true);
    const view = createRunMessage(requestText, agentName);
    const steps = resetTrace(
      requestText.replace(/^(@\S+\s*)+/, '').slice(0, 42),
      '触发消息：徐亦然 ' + now() + ' · ' + state.project
    );
    state.run = {
      status: 'running',
      index: -1,
      timers: [],
      els: steps,
      card: view.card,
      textEl: view.textEl,
      article: view.article,
      agent: agentName
    };
    advanceRun();
  }

  function advanceRun() {
    const run = state.run;
    if (!run || run.status !== 'running') return;
    run.index += 1;
    if (run.index >= RUN_STEPS.length) {
      finishRun();
      return;
    }
    if (run.index === 1) {
      if (!hasProjectRepos()) {
        failRun('项目还没有导入仓库，Qgent 无法读写代码');
        return;
      }
      if (!state.github) {
        failRun('团队 GitHub App 已断开，无法读写仓库');
        return;
      }
    }
    const li = run.els[run.index];
    li.className = 'step step--live';
    const meta = $('.run__meta', run.card);
    if (meta) meta.textContent = '第 ' + (run.index + 1) + '/' + RUN_STEPS.length + ' 步 · ' + RUN_STEPS[run.index].name;
    run.timers.push(
      window.setTimeout(() => {
        if (!state.run || state.run.status !== 'running') return;
        li.className = 'step step--done';
        const timeEl = $('.step__time', li);
        if (timeEl) timeEl.textContent = RUN_DURATIONS[run.index] || '0.6s';
        advanceRun();
      }, 900 + run.index * 140)
    );
  }

  function finishRun() {
    const run = state.run;
    if (!run) return;
    run.status = 'done';
    run.timers.forEach((timer) => clearTimeout(timer));
    run.timers = [];
    run.card.className = 'run run--done';
    run.card.innerHTML =
      '<div class="run__head">' +
      '<span class="dot dot--ok"></span>' +
      '<span class="run__state">完成</span>' +
      '<span class="run__meta">6 步 · 9 秒 · 2 个文件</span>' +
      '<button class="btn btn--link" type="button" data-view="diff">审阅分支</button>' +
      '</div>';
    const branchNote = document.createElement('p');
    branchNote.className = 'run__note';
    branchNote.textContent = '分支 feat/agent-pending-state 已推送';
    run.card.appendChild(branchNote);
    run.textEl.textContent = '已完成。Agent 页的申请状态改为从列表读取，待审批仍然只能由默认群的 Qgent 审批。分支已推送，改动等审阅。';
    byId('traceFoot').textContent = '已推送分支 feat/agent-pending-state · 等待审阅';
    toast('运行完成，分支已推送');
  }

  function stopRun() {
    const run = state.run;
    if (!run || run.status !== 'running') return;
    run.status = 'stopped';
    run.timers.forEach((timer) => clearTimeout(timer));
    run.timers = [];
    const current = run.els[run.index];
    if (current) {
      current.className = 'step step--halt';
      const meta = $('.step__meta', current);
      if (meta) meta.textContent = '被徐亦然叫停 · 未执行完';
      const timeEl = $('.step__time', current);
      if (timeEl) timeEl.textContent = '停止';
    }
    run.card.className = 'run run--stopped';
    run.card.innerHTML =
      '<div class="run__head">' +
      '<span class="dot dot--halt"></span>' +
      '<span class="run__state">已叫停</span>' +
      '<span class="run__meta">停在 ' + (run.index + 1) + '/' + RUN_STEPS.length + ' 步</span>' +
      '<button class="btn btn--link" type="button" data-view="diff">查看改动</button>' +
      '</div>';
    run.textEl.textContent = '已停止。改动留在沙箱内，没有推送分支，也没有改写仓库。';
    byId('traceFoot').textContent = '停在 ' + (run.index + 1) + '/' + RUN_STEPS.length + ' 步 · 未推送';
    toast('已停止这次运行');
  }

  /* ---------------- 提及 ---------------- */

  function mentionedMembers(text) {
    return MEMBERS.filter((member) => text.indexOf('@' + member.name) !== -1);
  }

  function renderMention(query) {
    const q = query.trim().toLowerCase();
    state.mentionMatches = MEMBERS.filter(
      (member) => !q || member.name.toLowerCase().includes(q) || member.id.includes(q)
    );
    state.mentionIndex = 0;
    mentionList.innerHTML = '';
    state.mentionMatches.forEach((member, index) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('role', 'option');
      button.dataset.mentionId = member.id;
      button.dataset.mentionIndex = String(index);
      if (index === 0) button.classList.add('is-active');
      const avatar = document.createElement('span');
      avatar.className = member.kind === 'Agent' ? 'avatar avatar--sm avatar--agent' : 'avatar avatar--sm';
      avatar.textContent = member.kind === 'Agent' ? 'Q' : member.name.slice(0, 1);
      const name = document.createElement('span');
      name.textContent = member.name + (member.kind === 'Agent' ? ' · Agent' : '');
      const kind = document.createElement('span');
      kind.className = 'mention__kind';
      kind.textContent = member.note;
      button.append(avatar, name, kind);
      li.appendChild(button);
      mentionList.appendChild(li);
    });
    mentionEmpty.hidden = state.mentionMatches.length > 0;
    mentionPop.hidden = false;
  }

  function closeMention() {
    mentionPop.hidden = true;
    state.mentionMatches = [];
  }

  function currentMentionQuery() {
    const caret = composer.selectionStart;
    const before = composer.value.slice(0, caret);
    const match = before.match(/(?:^|\s)@([^\s@]*)$/);
    return match ? match[1] : null;
  }

  function pickMention(member) {
    const caret = composer.selectionStart;
    const before = composer.value.slice(0, caret);
    const after = composer.value.slice(caret);
    const replaced = before.replace(/(?:^|\s)@([^\s@]*)$/, (full, query) => {
      const space = full.startsWith(' ') ? ' ' : '';
      return space + '@' + member.name + ' ';
    });
    composer.value = replaced + after;
    composer.focus();
    const position = replaced.length;
    composer.setSelectionRange(position, position);
    closeMention();
    autoGrow();
  }

  function adjustMentionActive(delta) {
    if (!state.mentionMatches.length) return;
    state.mentionIndex = (state.mentionIndex + delta + state.mentionMatches.length) % state.mentionMatches.length;
    $$('#mentionList button').forEach((button, index) => {
      button.classList.toggle('is-active', index === state.mentionIndex);
    });
  }

  function autoGrow() {
    composer.style.height = 'auto';
    composer.style.height = Math.min(composer.scrollHeight, 168) + 'px';
  }

  function handleSend() {
    const text = composer.value.trim();
    if (!text) {
      composer.focus();
      return;
    }
    appendUserMessage(text);
    const agents = mentionedMembers(text).filter((member) => member.kind === 'Agent');
    composer.value = '';
    composer.style.height = '';
    closeMention();
    composer.focus();
    if (agents.length) startRun(text, agents[0].name);
  }

  if (composer) {
    composer.addEventListener('input', () => {
      autoGrow();
      const query = currentMentionQuery();
      if (query === null) closeMention();
      else renderMention(query);
    });
    composer.addEventListener('keydown', (event) => {
      if (!mentionPop.hidden) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          adjustMentionActive(1);
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          adjustMentionActive(-1);
          return;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          const member = state.mentionMatches[state.mentionIndex];
          if (member) {
            event.preventDefault();
            pickMention(member);
            return;
          }
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          closeMention();
          return;
        }
      }
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        handleSend();
      }
    });
    composer.addEventListener('blur', () => {
      window.setTimeout(() => {
        if (!mentionPop.hidden && document.activeElement !== composer) closeMention();
      }, 120);
    });
    autoGrow();
  }
  if (sendBtn) sendBtn.addEventListener('click', handleSend);

  /* ---------------- 表格 / 筛选 ---------------- */

  const projectFilter = byId('projectFilter');
  if (projectFilter) {
    projectFilter.addEventListener('input', () => {
      const query = projectFilter.value.trim().toLowerCase();
      let shown = 0;
      $$('#projectTable .table__row[data-project]').forEach((row) => {
        const hit = !query || row.textContent.toLowerCase().includes(query);
        row.hidden = !hit;
        if (hit) shown += 1;
      });
      const empty = byId('projectEmpty');
      if (empty) empty.hidden = shown > 0;
    });
  }

  const groupSearch = byId('groupSearch');
  if (groupSearch) {
    groupSearch.addEventListener('input', () => {
      const query = groupSearch.value.trim().toLowerCase();
      let shown = 0;
      $$('#groupList .grouprow').forEach((button) => {
        const hit = !query || button.textContent.toLowerCase().includes(query);
        button.closest('li').hidden = !hit;
        if (hit) shown += 1;
      });
      const empty = byId('groupEmpty');
      const term = byId('groupEmptyTerm');
      if (term) term.textContent = groupSearch.value.trim();
      if (empty) empty.hidden = shown > 0;
    });
  }

  /* ---------------- 标签页 ---------------- */

  function activateTab(tab) {
    const view = tab.closest('.view');
    if (!view) return;
    $$('.tab', view).forEach((button) => {
      button.setAttribute('aria-selected', String(button === tab));
    });
    $$('.tabpanel', view).forEach((panel) => {
      panel.hidden = panel.dataset.panel !== tab.dataset.tab;
    });
  }

  /* ---------------- Skill ---------------- */

  const SKILLS = {
    s1: {
      name: '接口契约核对',
      meta: '由徐亦然提交 · 使用 36 次 · 最近 09:14',
      status: '已启用',
      tone: 'ok',
      desc: '在执行涉及接口的文件前，先比对 docs/api 与后端 Controller，列出不一致的字段与路径，确认后才改写调用处。',
      trigger: '改动落在 src/api 或 docs/api 时自动加载。',
      rules: ['只读核对，不修改后端仓库。', '不一致项写入运行步骤，不静默跳过。', '确认失败时保留原文，不猜测字段名。']
    },
    s2: {
      name: '消息分页回归',
      meta: '由周牧提交 · 使用 21 次 · 最近昨天 18:02',
      status: '已启用',
      tone: 'ok',
      desc: '改动聊天历史、增量同步或虚拟列表时，跑一遍游标分页、断线补齐与阅读位置保持。',
      trigger: '改动 src/components/chat 或 src/realtime 时自动加载。',
      rules: ['保留历史分页游标与阅读锚点。', '发送与已读不重新加载全部历史。', '并发消息不因发送响应跳过。']
    },
    s3: {
      name: '提交信息规范',
      meta: '由何乐提交 · 待审核',
      status: '待审核',
      tone: 'wait',
      desc: '提交前检查信息前缀与中文具体描述，正文说明改了什么、为什么改、影响范围和实际验证结果。',
      trigger: '运行结束、准备推送分支前加载。',
      rules: ['前缀只用 feat / fix / refactor / docs / test。', '正文必须有验证命令与结果。', '不把未执行的检查写成已通过。']
    }
  };

  function renderSkill(id) {
    const skill = SKILLS[id];
    if (!skill) return;
    state.skillReviewId = id;
    byId('skillName').textContent = skill.name;
    byId('skillMeta').textContent = skill.meta;
    byId('skillDesc').textContent = skill.desc;
    byId('skillTrigger').textContent = skill.trigger;
    const rules = byId('skillRules');
    rules.innerHTML = '';
    skill.rules.forEach((rule) => {
      const li = document.createElement('li');
      li.textContent = rule;
      rules.appendChild(li);
    });
    const status = byId('skillStatus');
    status.textContent = skill.status;
    status.className = 'tag ' + (skill.tone === 'ok' ? 'tag--ok' : 'tag--wait');
    const actions = byId('skillActions');
    actions.hidden = skill.status !== '待审核';
    $$('#skillList .masterrow').forEach((button) => {
      button.setAttribute('aria-current', String(button.dataset.skill === id));
    });
  }

  function updateSkillStatus(id, status, tone) {
    const skill = SKILLS[id];
    if (!skill) return;
    skill.status = status;
    skill.tone = tone;
    const row = $('#skillList .masterrow[data-skill="' + id + '"]');
    if (row) {
      const tag = $('.tag', row);
      if (tag) {
        tag.textContent = status;
        tag.className = 'tag ' + (tone === 'ok' ? 'tag--ok' : 'tag--wait');
      }
    }
    renderSkill(id);
    if (row) row.focus();
  }

  /* ---------------- Diff ---------------- */

  const DIFFS = {
    f1: {
      path: 'src/pages/ProjectDetail/Memory/MemoryPage.tsx',
      count: '+148 / −0',
      code:
        '@@ -0,0 +1,24 @@\n' +
        '+import { useQuery } from \'@tanstack/react-query\'\n' +
        '+import { getProjectMemory } from \'@/api/projects\'\n' +
        '+import { MarkdownView } from \'./MarkdownView\'\n' +
        '+\n' +
        '+export function MemoryPage({ projectId }: { projectId: string }) {\n' +
        '+  const { data, isPending, isError } = useQuery({\n' +
        '+    queryKey: [\'projects\', projectId, \'memory\'],\n' +
        '+    queryFn: () => getProjectMemory(projectId),\n' +
        '+  })\n' +
        '+\n' +
        '+  if (isPending) return &lt;PageSkeleton /&gt;\n' +
        '+  if (isError) return &lt;ErrorState /&gt;\n' +
        '+\n' +
        '+  return (\n' +
        '+    &lt;div className="memory-page"&gt;\n' +
        '+      &lt;MarkdownView source={data.content} /&gt;\n' +
        '+    &lt;/div&gt;\n' +
        '+  )\n' +
        '+}'
    },
    f2: {
      path: 'src/pages/ProjectDetail/Memory/MemoryPage.scss',
      count: '+96 / −0',
      code:
        '@@ -0,0 +1,18 @@\n' +
        '+.memory-page {\n' +
        '+  display: grid;\n' +
        '+  grid-template-columns: 240px minmax(0, 1fr);\n' +
        '+  gap: var(--space-6);\n' +
        '+  padding: var(--space-6) var(--space-8);\n' +
        '+}\n' +
        '+\n' +
        '+.memory-page__doc {\n' +
        '+  max-width: 72ch;\n' +
        '+  font-size: var(--text-base);\n' +
        '+  line-height: 1.7;\n' +
        '+}\n' +
        '+\n' +
        '+.memory-page__doc h2 {\n' +
        '+  font-size: var(--text-h3);\n' +
        '+}'
    },
    f3: {
      path: 'src/routes/index.tsx',
      count: '+6 / −0',
      code:
        '@@ -12,6 +12,12 @@\n' +
        ' const MemoryPage = lazy(async () => ({\n' +
        '   default: (await import(\'@/pages/ProjectDetail/Memory/MemoryPage\')).MemoryPage,\n' +
        ' }))\n' +
        '+\n' +
        '+// 记忆页只读：路由挂在项目布局下，没有编辑或审核入口。\n' +
        '+  <Route path="memory" element={&lt;MemoryPage /&gt;} />'
    }
  };

  function renderDiffFile(id) {
    const file = DIFFS[id];
    if (!file) return;
    byId('diffPath').textContent = file.path;
    byId('diffCount').textContent = file.count;
    const code = $('#diff code');
    if (code) {
      code.innerHTML = file.code
        .split('\n')
        .map((line) => {
          if (line.startsWith('+')) return '<span class="add">' + line + '</span>';
          if (line.startsWith('@@')) return '<span class="meta">' + line + '</span>';
          return line;
        })
        .join('\n');
    }
    $$('.diffile').forEach((button) => {
      button.setAttribute('aria-current', String(button.dataset.difffile === id));
    });
  }

  function commitDiff(kind) {
    const banner = byId('diffBanner');
    if (!banner || !banner.hidden) return;
    banner.hidden = false;
    if (kind === 'approve') {
      banner.dataset.tone = 'ok';
      banner.textContent = '已合并到 main · 提交 a3f9c21。分支 feat/memory-readonly 已删除远端副本。';
      toast('已合并到 main');
    } else {
      banner.dataset.tone = 'reject';
      banner.textContent = '已请求修改，分支保留在 feat/memory-readonly。回复会回到默认群。';
      toast('已请求修改');
    }
    $$('[data-diff]').forEach((button) => {
      button.disabled = true;
    });
  }

  /* ---------------- 行内确认（破坏性操作） ---------------- */

  function inlineConfirm(button, confirmLabel, onConfirm, fallbackSelector) {
    const cell = button.parentElement;
    if (!cell || cell.dataset.confirming === 'true') return;
    cell.dataset.confirming = 'true';
    const original = cell.innerHTML;
    cell.innerHTML = '';
    const wrap = document.createElement('span');
    wrap.className = 'row row--tight';
    const yes = document.createElement('button');
    yes.type = 'button';
    yes.className = 'btn btn--link';
    yes.textContent = confirmLabel;
    const no = document.createElement('button');
    no.type = 'button';
    no.className = 'btn btn--link';
    no.style.color = 'var(--ink-500)';
    no.textContent = '取消';
    wrap.append(yes, no);
    cell.appendChild(wrap);
    yes.focus();
    no.addEventListener('click', () => {
      cell.dataset.confirming = 'false';
      cell.innerHTML = original;
      const restored = $('[data-repo-remove], [data-remove-member]', cell);
      if (restored) restored.focus();
    });
    yes.addEventListener('click', () => {
      onConfirm();
      const row = cell.closest('li');
      if (row) row.remove();
      const view = cell.closest('.view');
      const fallback = view && fallbackSelector ? $(fallbackSelector, view) : null;
      if (fallback) fallback.focus();
      toast('已完成移除');
    });
  }

  /* ---------------- 表格行构建 ---------------- */

  function addTableRow(table, cells, options) {
    const row = document.createElement('li');
    row.className = 'table__row';
    cells.forEach((cell, index) => {
      const span = document.createElement('span');
      span.className = 'table__cell' + (options && options.endIndex === index ? ' table__cell--end' : '');
      if (cell.kind === 'stack') {
        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = cell.name;
        span.appendChild(name);
        if (cell.meta) {
          const meta = document.createElement('span');
          meta.className = 'meta';
          meta.textContent = cell.meta;
          span.appendChild(meta);
        }
        if (cell.button) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'btn btn--link';
          button.textContent = cell.button.label;
          button.dataset[cell.button.data] = cell.button.value;
          span.appendChild(button);
        }
      } else {
        span.textContent = cell.text;
      }
      row.appendChild(span);
    });
    table.appendChild(row);
    return row;
  }

  /* ---------------- 对话框 ---------------- */

  let dlgReturnFocus = null;

  function openDialog(id, trigger) {
    const dialog = byId(id);
    if (!dialog) return;
    closePopovers(false);
    dlgReturnFocus = trigger || document.activeElement;
    dialog.showModal();
    const first = $('input:not([readonly]), textarea, select', dialog);
    if (first) first.focus();
    else {
      const primary = $('.btn--primary', dialog);
      if (primary) primary.focus();
    }
  }

  $$('dialog').forEach((dialog) => {
    dialog.addEventListener('close', () => {
      if (dlgReturnFocus && dlgReturnFocus.isConnected) dlgReturnFocus.focus();
      dlgReturnFocus = null;
    });
  });

  /* ---------------- 表单校验 ---------------- */

  function validateLogin() {
    const account = byId('login-account');
    const password = byId('login-password');
    clearErrors(['login-account-err', 'login-password-err']);
    let ok = true;
    if (!account.value.trim()) {
      setError('login-account-err', '填写邮箱或用户名后再登录。');
      ok = false;
    }
    if (password.value.length < 6) {
      setError('login-password-err', '密码至少 6 位。');
      ok = false;
    }
    return ok;
  }

  const formLogin = byId('form-login');
  if (formLogin) {
    formLogin.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!validateLogin()) return;
      setView('team-home');
      toast('已登录，进入砺行科技');
    });
    $$('input', formLogin).forEach((input) => {
      input.addEventListener('blur', () => {
        if (input.value.length) validateLogin();
      });
    });
  }

  const formRegister = byId('form-register');
  if (formRegister) {
    formRegister.addEventListener('submit', (event) => {
      event.preventDefault();
      clearErrors(['reg-name-err', 'reg-mail-err', 'reg-code-err']);
      let ok = true;
      if (!byId('reg-name').value.trim()) {
        setError('reg-name-err', '昵称用于成员列表与消息，填一个 2 字以上。');
        ok = false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(byId('reg-mail').value.trim())) {
        setError('reg-mail-err', '邮箱格式不对，例如 name@company.com。');
        ok = false;
      }
      if (byId('reg-code').value.trim() !== '483920') {
        setError('reg-code-err', '验证码不正确。演示环境固定为 483920。');
        ok = false;
      }
      if (!ok) return;
      const nickname = byId('reg-name').value.trim();
      const meName = byId('meName');
      if (meName) meName.value = nickname;
      setView('team-home');
      toast('已注册，进入砺行科技');
    });
    const sendCode = byId('reg-sendcode');
    if (sendCode) {
      sendCode.addEventListener('click', () => {
        const hint = byId('reg-code-hint');
        const mail = byId('reg-mail').value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
          setError('reg-mail-err', '先填一个有效的邮箱再获取验证码。');
          return;
        }
        setError('reg-mail-err', '');
        if (hint) hint.textContent = '验证码已发送到 ' + mail + '（演示环境固定 483920）';
        toast('验证码已发送');
      });
    }
  }

  const formForgot = byId('form-forgot');
  if (formForgot) {
    formForgot.addEventListener('submit', (event) => {
      event.preventDefault();
      const mail = byId('forgot-mail').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
        setError('forgot-mail-err', '邮箱格式不对，例如 name@company.com。');
        return;
      }
      setError('forgot-mail-err', '');
      setScreen('login');
      toast('重设链接已发送（演示环境不发信）');
    });
  }

  const formTeamCreate = byId('form-team-create');
  if (formTeamCreate) {
    formTeamCreate.addEventListener('submit', (event) => {
      event.preventDefault();
      clearErrors(['team-name-err', 'team-slug-err']);
      let ok = true;
      const name = byId('team-name').value.trim();
      const slug = byId('team-slug').value.trim();
      if (!name) {
        setError('team-name-err', '团队名称不能为空，例如「砺行科技」。');
        ok = false;
      }
      if (!/^[a-z0-9-]{2,}$/.test(slug)) {
        setError('team-slug-err', '标识用小写字母、数字或连字符，至少 2 位。');
        ok = false;
      }
      if (!ok) return;
      state.team = name;
      const home = byId('homeTeamName');
      if (home) home.textContent = name;
      setView('team-home');
      toast('团队已创建');
    });
  }

  const formTeamJoin = byId('form-team-join');
  if (formTeamJoin) {
    formTeamJoin.addEventListener('submit', (event) => {
      event.preventDefault();
      const code = byId('join-code').value.trim();
      setError('join-code-err', code ? '' : '填入管理员给你的邀请码。');
      if (!code) return;
      setView('team-home');
      toast('已加入砺行科技');
    });
  }

  const formProject = byId('form-project');
  if (formProject) {
    formProject.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = byId('proj-name');
      setError('proj-name-err', name.value.trim() ? '' : '项目名称不能为空。');
      if (!name.value.trim()) return;
      const saved = byId('projSaved');
      if (saved) saved.hidden = false;
      toast('项目信息已保存');
    });
  }

  const formAccount = byId('form-account');
  if (formAccount) {
    formAccount.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = byId('acc-name');
      setError('acc-name-err', name.value.trim() ? '' : '昵称不能为空。');
      if (!name.value.trim()) return;
      const meName = byId('meName');
      if (meName) meName.value = name.value.trim();
      const railName = $('.rail__me-name');
      if (railName) railName.textContent = name.value.trim();
      const saved = byId('accSaved');
      if (saved) saved.hidden = false;
      toast('昵称已保存');
    });
  }

  byId('meSave') && byId('meSave').addEventListener('click', () => {
    const meName = byId('meName');
    const value = meName.value.trim();
    if (!value) {
      meName.focus();
      toast('昵称不能为空', 'warn');
      return;
    }
    const railName = $('.rail__me-name');
    if (railName) railName.textContent = value;
    const accName = byId('acc-name');
    if (accName) accName.value = value;
    closePopovers(false);
    toast('昵称已保存');
  });

  const avatarSwap = byId('avatarSwap');
  if (avatarSwap) {
    const tones = ['', 'avatar--t2', 'avatar--t3'];
    let toneIndex = 0;
    avatarSwap.addEventListener('click', () => {
      toneIndex = (toneIndex + 1) % tones.length;
      const avatars = $$('#meAvatar, #accAvatar, .rail__me .avatar');
      avatars.forEach((avatar) => {
        avatar.classList.remove('avatar--t2', 'avatar--t3');
        if (tones[toneIndex]) avatar.classList.add(tones[toneIndex]);
      });
      toast('头像已更换');
    });
  }

  /* ---------------- 提交处理器（对话框） ---------------- */

  const formNewProject = byId('form-newproject');
  if (formNewProject) {
    formNewProject.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = byId('np-name');
      const name = input.value.trim();
      setError('np-name-err', name ? '' : '项目名称不能为空，例如 qgents-docs。');
      if (!name) return;
      const pickedRepo = byId('np-repo').value;
      PROJECTS[name] = {
        desc: '新建项目，还没有写说明。',
        repos: pickedRepo ? [[pickedRepo, 'main', 0]] : []
      };
      const table = byId('projectTable');
      const row = addTableRow(
        table,
        [
          { kind: 'stack', name: name, meta: '新建 · 默认群已生成', button: { label: '打开', data: 'openProject', value: name } },
          { text: pickedRepo || '—' },
          { text: '1 人' },
          { text: '刚刚' }
        ]
      );
      row.dataset.project = name;
      row.dataset.status = 'active';
      const popList = byId('popProjectList');
      if (popList) {
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'menu__item';
        button.dataset.openProject = name;
        button.textContent = name;
        li.appendChild(button);
        popList.appendChild(li);
      }
      formNewProject.reset();
      byId('dlg-project').close();
      toast('项目已创建，默认群和 Qgent 已就位');
      const opened = $('[data-open-project="' + name + '"]', table);
      if (opened) opened.focus();
    });
  }

  const formNewGroup = byId('form-newgroup');
  if (formNewGroup) {
    formNewGroup.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = byId('ng-name').value.trim();
      setError('ng-name-err', name ? '' : '群名不能为空。');
      if (!name) return;
      const id = 'g-' + name;
      const list = byId('groupList');
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'grouprow';
      button.dataset.group = id;
      const nameEl = document.createElement('span');
      nameEl.className = 'grouprow__name';
      nameEl.textContent = name;
      const meta = document.createElement('span');
      meta.className = 'grouprow__meta';
      const preview = document.createElement('span');
      preview.className = 'grouprow__preview';
      preview.textContent = '刚创建 · 还没有消息';
      const time = document.createElement('time');
      time.textContent = now();
      meta.append(preview, time);
      button.append(nameEl, meta);
      li.appendChild(button);
      list.prepend(li);
      groupLogs[id] = [];
      formNewGroup.reset();
      byId('dlg-group').close();
      button.focus();
      toast('群聊已创建');
    });
  }

  const formAgent = byId('form-agent');
  if (formAgent) {
    formAgent.addEventListener('submit', (event) => {
      event.preventDefault();
      clearErrors(['aa-name-err', 'aa-duty-err', 'aa-prompt-err']);
      let ok = true;
      const name = byId('aa-name').value.trim();
      const duty = byId('aa-duty').value.trim();
      const prompt = byId('aa-prompt').value.trim();
      if (!name) {
        setError('aa-name-err', '名称必填，用于成员列表与 @ 提及。');
        ok = false;
      }
      if (!duty) {
        setError('aa-duty-err', '写一句它的职责，审批时要用。');
        ok = false;
      }
      if (prompt.length < 10) {
        setError('aa-prompt-err', '系统提示词太短，至少写清楚它能读什么、不能做什么。');
        ok = false;
      }
      if (!ok) return;
      const table = byId('agentTable');
      addTableRow(
        table,
        [
          { kind: 'stack', name: name, meta: '由何乐申请' },
          { text: duty },
          { text: '待审批' },
          { text: '#A-1043' }
        ]
      );
      const tag = $('.table__row:last-child .table__cell:nth-child(3)', table);
      if (tag) {
        tag.innerHTML = '<span class="tag tag--wait">待审批</span>';
      }
      const count = byId('agentCount');
      if (count) count.textContent = '3 个';
      formAgent.reset();
      byId('dlg-agent-apply').close();
      const note = byId('agentApplied');
      if (note) {
        note.hidden = false;
        note.textContent = '已提交「' + name + '」（#A-1043）。到默认群 @Qgent 并带上编号即可跟进审批。';
      }
      toast('申请已提交，等待默认群审批');
    });
  }

  const formSkill = byId('form-skill');
  if (formSkill) {
    formSkill.addEventListener('submit', (event) => {
      event.preventDefault();
      clearErrors(['sk-name-err', 'sk-purpose-err']);
      let ok = true;
      const name = byId('sk-name').value.trim();
      const purpose = byId('sk-purpose').value.trim();
      if (!name) {
        setError('sk-name-err', '名称必填。');
        ok = false;
      }
      if (purpose.length < 8) {
        setError('sk-purpose-err', '用途写清楚一点，至少一句完整的话。');
        ok = false;
      }
      if (!ok) return;
      const id = 's' + (Object.keys(SKILLS).length + 1);
      SKILLS[id] = {
        name: name,
        meta: '由何乐提交 · 待审核',
        status: '待审核',
        tone: 'wait',
        desc: purpose,
        trigger: '审核通过后由管理员指定触发条件。',
        rules: ['审核通过前不参与任何运行。', '写入只在沙箱内进行。']
      };
      const list = byId('skillList');
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'masterrow';
      button.dataset.skill = id;
      const title = document.createElement('span');
      title.className = 'name';
      title.textContent = name;
      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = '刚提交';
      const tag = document.createElement('span');
      tag.className = 'tag tag--wait';
      tag.textContent = '待审核';
      button.append(title, meta, tag);
      li.appendChild(button);
      list.appendChild(li);
      formSkill.reset();
      byId('dlg-skill-apply').close();
      renderSkill(id);
      button.focus();
      toast('Skill 已提交，等待审核');
    });
  }

  const formRepo = byId('form-repo');
  if (formRepo) {
    formRepo.addEventListener('submit', (event) => {
      event.preventDefault();
      const picked = $$('input[name="repo"]:checked', formRepo).map((input) => input.value);
      const error = byId('repo-err');
      if (!picked.length) {
        if (error) error.hidden = false;
        return;
      }
      if (error) error.hidden = true;
      const project = PROJECTS[state.project] || (PROJECTS[state.project] = { desc: '', repos: [] });
      picked.forEach((repo) => {
        if (!project.repos.some((item) => item[0] === repo)) project.repos.push([repo, 'main', 0]);
      });
      renderRepoTable();
      formRepo.reset();
      byId('dlg-repo').close();
      toast(picked.length > 1 ? '已导入 ' + picked.length + ' 个仓库' : '已导入仓库');
      const removed = $('[data-repo-remove]');
      if (removed) removed.focus();
    });
  }

  const formInvite = byId('form-invite');
  if (formInvite) {
    formInvite.addEventListener('submit', (event) => {
      event.preventDefault();
      const mail = byId('iv-mail');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail.value.trim())) {
        setError('iv-mail-err', '邮箱格式不对，例如 name@company.com。');
        return;
      }
      setError('iv-mail-err', '');
      const table = byId('teamMemberTable');
      addTableRow(table, [
        { kind: 'stack', name: mail.value.trim().split('@')[0], meta: '邀请已发送' },
        { text: mail.value.trim() },
        { text: byId('iv-role').value },
        { text: '待接受邀请' }
      ], { endIndex: 3 });
      formInvite.reset();
      byId('dlg-invite').close();
      toast('邀请已发送');
    });
  }

  const formProjectMember = byId('form-project-member');
  if (formProjectMember) {
    formProjectMember.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = byId('pm-mail').value;
      const role = byId('pm-role').value;
      const table = byId('projectMemberTable');
      addTableRow(table, [
        { kind: 'stack', name: name },
        { text: name === '叶知秋' ? 'yezhiqiu@lixing.tech' : 'chenchi@lixing.tech' },
        { text: role },
        { kind: 'stack', button: { label: '移出', data: 'removeMember', value: name } }
      ], { endIndex: 3 });
      byId('dlg-project-member').close();
      toast('已添加 ' + name + ' 到项目');
    });
  }

  const formArchive = byId('form-archive');
  if (formArchive) {
    formArchive.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = byId('ar-confirm').value.trim();
      setError('ar-err', value === state.project ? '' : '名称不一致，项目未归档。');
      if (value !== state.project) return;
      formArchive.reset();
      byId('dlg-archive').close();
      toast('项目已归档，现在只读');
      const archived = state.project;
      $$('#projectTable .table__row[data-project] .name').forEach((node) => {
        if (node.textContent === archived) node.textContent = archived + '（已归档）';
      });
    });
  }

  const formPassword = byId('form-password');
  if (formPassword) {
    formPassword.addEventListener('submit', (event) => {
      event.preventDefault();
      clearErrors(['pw-old-err', 'pw-new-err']);
      let ok = true;
      if (!byId('pw-old').value) {
        setError('pw-old-err', '填入当前密码。');
        ok = false;
      }
      if (byId('pw-new').value.length < 6) {
        setError('pw-new-err', '新密码至少 6 位。');
        ok = false;
      }
      if (!ok) return;
      formPassword.reset();
      byId('dlg-password').close();
      toast('密码已更新');
    });
  }

  byId('signoutOthers') && byId('signoutOthers').addEventListener('click', () => {
    const note = byId('securityNote');
    if (note) {
      note.hidden = false;
      note.textContent = '已退出其他设备上的会话（演示环境不涉及真实会话）。';
    }
    toast('已退出其他会话');
  });

  byId('ghSync') && byId('ghSync').addEventListener('click', () => {
    if (!state.github) return;
    const body = byId('repoBody');
    const sync = byId('ghSync');
    if (sync) sync.disabled = true;
    skeleton(body, 4);
    window.setTimeout(() => {
      renderRepoTable();
      const at = byId('ghSyncedAt');
      if (at) at.textContent = '刚刚';
      if (sync) sync.disabled = false;
      toast('仓库列表已同步');
    }, 700);
  });

  byId('ghToggle') && byId('ghToggle').addEventListener('click', () => {
    setGithub(!state.github);
  });

  byId('bannerClose') && byId('bannerClose').addEventListener('click', () => {
    state.bannerDismissed = true;
    const banner = byId('banner');
    if (banner) banner.hidden = true;
    const trigger = byId('bellBtn');
    if (trigger) trigger.focus();
  });

  /* ---------------- 项目数据、状态与骨架 ---------------- */

  let fullSnapshot = null;

  function dayMarker(text) {
    const day = document.createElement('p');
    day.className = 'daybreak';
    const span = document.createElement('span');
    span.textContent = text;
    day.appendChild(span);
    return day;
  }

  function emptyNote(text) {
    const note = document.createElement('p');
    note.className = 'empty';
    note.style.borderTop = '0';
    note.innerHTML = '<svg class="od-icon" style="--od-icon-size:16px" aria-hidden="true"><use href="#i-search"></use></svg>';
    note.append(document.createTextNode(text));
    return note;
  }

  function rowEmpty(title, desc, tag) {
    const wrap = document.createElement(tag || 'div');
    wrap.className = 'row-empty';
    const icon = document.createElement('span');
    icon.className = 'row-empty__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = '<svg class="od-icon" style="--od-icon-size:18px"><use href="#i-inbox"></use></svg>';
    const head = document.createElement('p');
    head.className = 'row-empty__title';
    head.textContent = title;
    const body = document.createElement('p');
    body.className = 'row-empty__desc';
    body.textContent = desc;
    wrap.append(icon, head, body);
    return wrap;
  }

  function skeleton(container, rows) {
    if (!container) return;
    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'sk';
    wrap.setAttribute('aria-hidden', 'true');
    const title = document.createElement('span');
    title.className = 'sk__bar sk__bar--title';
    wrap.appendChild(title);
    for (let index = 0; index < rows; index += 1) {
      const bar = document.createElement('span');
      bar.className = 'sk__bar' + (index % 4 === 3 ? ' sk__bar--short' : '');
      wrap.appendChild(bar);
    }
    container.appendChild(wrap);
  }

  function hasProjectRepos() {
    const project = PROJECTS[state.project];
    return Boolean(project && project.repos && project.repos.length);
  }

  function captureProject() {
    if (state.group === 'g-default') state.logs.set(state.project, chatlog.innerHTML);
    if (state.project !== FULL_PROJECT) return;
    const html = (id) => {
      const node = byId(id);
      return node ? node.innerHTML : '';
    };
    fullSnapshot = {
      groups: html('groupList'),
      skills: html('skillList'),
      detail: html('skillDetail'),
      memory: html('memoryDoc'),
      agents: html('agentTable'),
      count: byId('agentCount') ? byId('agentCount').textContent : ''
    };
  }

  function defaultGroupRow() {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'grouprow';
    button.dataset.group = 'g-default';
    button.setAttribute('aria-current', 'true');
    const name = document.createElement('span');
    name.className = 'grouprow__name';
    name.textContent = '默认群';
    const meta = document.createElement('span');
    meta.className = 'grouprow__meta';
    const preview = document.createElement('span');
    preview.className = 'grouprow__preview';
    preview.textContent = '还没有消息';
    const time = document.createElement('time');
    time.textContent = '—';
    meta.append(preview, time);
    button.append(name, meta);
    li.appendChild(button);
    return li;
  }

  function renderGroupsFor(name) {
    if (name === FULL_PROJECT) {
      if (fullSnapshot && byId('groupList')) byId('groupList').innerHTML = fullSnapshot.groups;
      return;
    }
    const list = byId('groupList');
    if (!list) return;
    list.innerHTML = '';
    list.appendChild(defaultGroupRow());
  }

  function renderRepoTable() {
    const body = byId('repoBody');
    if (!body) return;
    const repos = ((PROJECTS[state.project] || {}).repos || []);
    body.innerHTML = '';
    if (!repos.length) {
      body.appendChild(
        rowEmpty(
          '这个项目还没有导入仓库',
          'Qgent 需要在仓库里读写代码。导入团队 App 授权范围内的仓库后，才能在这个项目里派活。'
        )
      );
      return;
    }
    const table = document.createElement('ul');
    table.className = 'table table--repos';
    table.id = 'repoTable';
    const head = document.createElement('li');
    head.className = 'table__row table__row--head';
    head.setAttribute('aria-hidden', 'true');
    ['仓库', '默认分支', '分支', ''].forEach((label) => {
      const span = document.createElement('span');
      span.textContent = label;
      head.appendChild(span);
    });
    table.appendChild(head);
    repos.forEach(([repo, branch, count]) => {
      addTableRow(
        table,
        [
          { kind: 'stack', name: repo, meta: 'github.com/lixingtech/' + repo },
          { text: branch },
          { text: String(count) },
          { kind: 'stack', button: { label: '移除', data: 'repoRemove', value: repo } }
        ],
        { endIndex: 3 }
      );
    });
    body.appendChild(table);
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent = '移除只是取消本项目引用，不会删除 GitHub 上的仓库，也不影响团队其他项目。';
    body.appendChild(note);
  }

  function renderKnowledge(name) {
    if (name === FULL_PROJECT) {
      if (!fullSnapshot) return;
      byId('skillList').innerHTML = fullSnapshot.skills;
      byId('skillDetail').innerHTML = fullSnapshot.detail;
      byId('memoryDoc').innerHTML = fullSnapshot.memory;
      byId('agentTable').innerHTML = fullSnapshot.agents;
      byId('agentCount').textContent = fullSnapshot.count;
      return;
    }
    const list = byId('skillList');
    list.innerHTML = '';
    list.appendChild(
      rowEmpty('还没有 Skill', '这个项目还没有可复用的能力。提交申请后由管理员审核，通过后才能被 Agent 调用。', 'li')
    );
    const detail = byId('skillDetail');
    detail.innerHTML = '';
    const title = document.createElement('h2');
    title.className = 'h2';
    title.textContent = '还没有 Skill 详情';
    const desc = document.createElement('p');
    desc.className = 'panel__desc';
    desc.textContent = '左边的列表是空的，这里不展示内容。提交第一个 Skill 申请后，这里会出现它的说明与触发条件。';
    detail.append(title, desc);

    const doc = byId('memoryDoc');
    doc.innerHTML = '';
    const memTitle = document.createElement('h2');
    memTitle.textContent = '还没有项目记忆';
    const memDesc = document.createElement('p');
    memDesc.textContent =
      '这个项目还没有 memory.md。Qgent 在项目管理员确认后写入第一次内容时创建，所有项目成员可读。';
    doc.append(memTitle, memDesc);

    const agents = byId('agentTable');
    agents.innerHTML = '';
    agents.appendChild(
      rowEmpty('还没有自定义 Agent', '默认 Agent Qgent 已经可用。需要专项能力时在本页提交申请，审批在默认群完成。', 'li')
    );
    byId('agentCount').textContent = '0 个';
  }

  function renderSettingsFields(name) {
    const nameInput = byId('proj-name');
    if (nameInput) nameInput.value = name;
    const desc = byId('proj-desc');
    if (desc) desc.value = (PROJECTS[name] || {}).desc || '这个项目的说明还没有写。';
    const archiveLabel = byId('archiveLabel');
    if (archiveLabel) archiveLabel.textContent = '归档 ' + name;
    const archiveTitle = byId('archiveTitle');
    if (archiveTitle) archiveTitle.textContent = '归档 ' + name;
    const archiveName = byId('archiveName');
    if (archiveName) archiveName.textContent = name;
    const saved = byId('projSaved');
    if (saved) saved.hidden = true;
    setError('ar-err', '');
  }

  function renderKickers(name) {
    $$('.view .kicker').forEach((node) => {
      if (node.textContent.indexOf('项目 ') === 0) node.textContent = '项目 ' + name;
    });
  }

  function renderProject(name) {
    renderGroupsFor(name);
    renderRepoTable();
    renderKnowledge(name);
    renderSettingsFields(name);
    renderKickers(name);
    resetGroupUI();
    if (name === FULL_PROJECT && byId('skillName')) {
      renderSkill(state.skillReviewId || 's1');
    }
  }

  function setGithub(connected, options) {
    state.github = connected;
    const block = byId('repoBlock');
    const body = byId('repoBody');
    if (block) block.hidden = connected;
    if (body) body.hidden = !connected;
    const banner = byId('banner');
    if (banner) banner.hidden = connected || state.bannerDismissed;
    const stateTag = byId('ghState');
    if (stateTag) {
      stateTag.textContent = connected ? '已连接' : '已断开';
      stateTag.className = 'tag ' + (connected ? 'tag--ok' : 'tag--stop');
    }
    const toggle = byId('ghToggleLabel');
    if (toggle) toggle.textContent = connected ? '断开连接' : '重新连接';
    const toggleIcon = $('#ghToggle use');
    if (toggleIcon) toggleIcon.setAttribute('href', connected ? '#i-unlink' : '#i-refresh');
    const sync = byId('ghSync');
    if (sync) sync.disabled = !connected;
    const note = byId('ghNote');
    if (note) note.hidden = connected;
    const importButton = $('.view[data-view="repos"] [data-dialog="dlg-repo"]');
    if (importButton) importButton.disabled = !connected;
    if (!options || !options.silent) {
      toast(connected ? 'GitHub App 已重新连接' : '已断开 GitHub App，仓库暂停访问', connected ? '' : 'warn');
    }
  }

  function failRun(reason) {
    const run = state.run;
    if (!run) return;
    run.status = 'failed';
    run.timers.forEach((timer) => clearTimeout(timer));
    run.timers = [];
    const current = run.els[run.index];
    if (current) {
      current.className = 'step step--fail';
      const meta = $('.step__meta', current);
      if (meta) meta.textContent = reason;
      const time = $('.step__time', current);
      if (time) time.textContent = '失败';
    }
    run.card.className = 'run run--fail';
    run.card.innerHTML =
      '<div class="run__head">' +
      '<span class="dot dot--fail"></span>' +
      '<span class="run__state">失败</span>' +
      '<span class="run__meta">停在 ' + (run.index + 1) + '/' + RUN_STEPS.length + ' 步</span>' +
      '<button class="btn btn--link" type="button" data-view="repos">去导入仓库</button>' +
      '</div>';
    const note = document.createElement('p');
    note.className = 'run__note';
    note.textContent = reason;
    run.card.appendChild(note);
    run.textEl.textContent = '没有跑完：' + reason + '。改动没有提交，也没有推送。';
    byId('traceFoot').textContent = '失败于 ' + (run.index + 1) + '/' + RUN_STEPS.length + ' 步 · 未推送';
    toast('运行失败，已停止', 'warn');
  }

  const ATTACHMENTS = {
    mem: {
      name: 'memory.md',
      meta: '4.2 KB · 文本附件 · 由何乐上传 · 09:12',
      body:
        '# qgents-web 项目记忆\n\n## 项目约定\n\n- 视觉数值只写在 src/theme/tokens.ts，页面样式只引用变量。\n- 请求统一经 src/api/client.ts，组件不处理认证头。\n- 后端数据用 TanStack Query，全局 UI 状态用 Zustand。\n\n## 接口与数据\n\n- 聊天回复使用 replyToId + content，停止执行按触发消息取消。\n- 项目记忆：GET /projects/{id}/memory，只读。\n\n## 已知问题\n\n- 多实例部署时，流式正文只在单实例内存内可见。\n- 移动端只承担读消息、回复和确认。'
    },
    log: {
      name: 'run-2317.log',
      meta: '12.6 KB · 文本附件 · 运行 #R-2317 · 09:14',
      body:
        '[09:12:41] run R-2317 起于项目 qgents-web\n' +
        '[09:12:41] step 1/6 读取群上下文 ok 0.4s\n' +
        '[09:12:42] step 2/6 定位相关文件 ok 0.2s  files=3\n' +
        '[09:12:43] step 3/6 写入改动 ok 1.1s  +148 -0\n' +
        '[09:12:46] step 4/6 npm run lint ok 2.6s\n' +
        '[09:12:50] step 5/6 vitest run ok 3.8s  42 passed\n' +
        '[09:12:54] step 6/6 git push ok 0.9s  feat/memory-readonly\n' +
        '[09:12:54] run finished state=done files=3'
    }
  };

  /* ---------------- 全局委托 ---------------- */

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const viewButton = target.closest('button[data-view], a[data-view]');
    if (viewButton) {
      event.preventDefault();
      closePopovers(false);
      setView(viewButton.dataset.view);
      return;
    }

    const goButton = target.closest('[data-go]');
    if (goButton) {
      event.preventDefault();
      closePopovers(false);
      setScreen(goButton.dataset.go);
      return;
    }

    const dialogButton = target.closest('[data-dialog]');
    if (dialogButton) {
      event.preventDefault();
      openDialog(dialogButton.dataset.dialog, dialogButton);
      return;
    }

    const closeButton = target.closest('[data-close]');
    if (closeButton) {
      const dialog = closeButton.closest('dialog');
      if (dialog) dialog.close();
      return;
    }

    const teamButton = target.closest('[data-switch-team]');
    if (teamButton) {
      switchTeam(teamButton.dataset.switchTeam);
      return;
    }

    const projectButton = target.closest('[data-open-project]');
    if (projectButton) {
      openProject(projectButton.dataset.openProject);
      return;
    }

    const groupButton = target.closest('[data-group]');
    if (groupButton) {
      const name = $('.grouprow__name', groupButton);
      openGroup(groupButton.dataset.group, name ? name.textContent : '群聊');
      return;
    }

    const runStop = target.closest('[data-run-stop]');
    if (runStop) {
      stopRun();
      return;
    }

    const mentionButton = target.closest('[data-mention-id]');
    if (mentionButton) {
      const member = MEMBERS.find((item) => item.id === mentionButton.dataset.mentionId);
      if (member) pickMention(member);
      return;
    }

    const tab = target.closest('[data-tab]');
    if (tab) {
      activateTab(tab);
      return;
    }

    const skillRow = target.closest('[data-skill]');
    if (skillRow) {
      renderSkill(skillRow.dataset.skill);
      return;
    }

    const skillAction = target.closest('[data-skill-action]');
    if (skillAction) {
      const id = state.skillReviewId || 's3';
      if (skillAction.dataset.skillAction === 'accept') {
        updateSkillStatus(id, '已启用', 'ok');
        toast('Skill 已通过审核');
      } else {
        updateSkillStatus(id, '已退回', 'wait');
        toast('Skill 已退回，申请人会收到通知');
      }
      return;
    }

    const diffFile = target.closest('[data-difffile]');
    if (diffFile) {
      renderDiffFile(diffFile.dataset.difffile);
      return;
    }

    const diffAction = target.closest('[data-diff]');
    if (diffAction) {
      commitDiff(diffAction.dataset.diff);
      return;
    }

    const repoRemove = target.closest('[data-repo-remove]');
    if (repoRemove) {
      const repoName = repoRemove.dataset.repoRemove;
      inlineConfirm(
        repoRemove,
        '确认移除',
        () => {
          const project = PROJECTS[state.project];
          if (!project) return;
          project.repos = project.repos.filter((item) => item[0] !== repoName);
          renderRepoTable();
        },
        '.view[data-view="repos"] .btn--primary'
      );
      return;
    }

    const memberRemove = target.closest('[data-remove-member]');
    if (memberRemove) {
      inlineConfirm(memberRemove, '确认移出', () => {}, '[data-dialog="dlg-project-member"]');
      return;
    }

    const attachButton = target.closest('[data-attach]');
    if (attachButton) {
      const data = ATTACHMENTS[attachButton.dataset.attach];
      if (data) {
        byId('attachName').textContent = data.name;
        byId('attachMeta').textContent = data.meta;
        byId('attachBody').textContent = data.body;
        openDialog('dlg-attach', attachButton);
      }
      return;
    }

    const ghButton = target.closest('[data-gh]');
    if (ghButton) {
      setGithub(ghButton.dataset.gh === 'on');
      return;
    }

    const missingLink = target.closest('[data-missing]');
    if (missingLink) {
      setScreen('notfound');
      return;
    }

    const statusAction = target.closest('button[data-status]');
    if (statusAction) {
      setView(statusAction.dataset.status === 'chat' ? 'chat' : 'team-home');
      return;
    }

    const out = target.closest('[data-out]');
    if (out) {
      closePopovers(false);
      setScreen('login');
      toast('已退出登录');
      return;
    }

    if (byId('ctxToggle') && target.closest('#ctxToggle')) {
      if (context.classList.contains('is-open')) closeContext();
      else openContext();
      return;
    }

    if (target.closest('#traceClose') || target.closest('#traceToggle')) {
      if (target.closest('#traceToggle') && traceToggle.disabled) return;
      setTrace(target.closest('#traceClose') ? false : !state.traceOpen);
      return;
    }

    if (openPop && !target.closest('.popover') && !openPop.trigger.contains(target)) closePopovers(false);
  });

  document.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !target.matches('[data-role]')) return;
    const value = target.value;
    if (target.id === 'role-xuyiran') {
      state.roles[state.team] = value;
      toast(value === '团队管理员' ? '你仍是团队管理员' : '已改为成员｜成员管理与 GitHub 授权会返回 403');
      return;
    }
    toast('角色已改为' + value);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (openPop) closePopovers(true);
      if (context.classList.contains('is-open')) closeContext();
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      const trigger = byId('searchBtn');
      if (trigger && trigger.offsetParent) openPopover(byId('popSearch'), trigger);
    }
  });

  scrim && scrim.addEventListener('click', closeContext);

  /* ---------------- 项目搜索 ---------------- */

  const SEARCH_PROJECTS = [
    { name: 'qgents-web', repo: 'qgents-web', note: 'React 19 · 前端' },
    { name: 'qgents-api', repo: 'qgents-api', note: 'Spring Boot · 服务端' },
    { name: 'qgents-infra', repo: 'qgents-infra', note: '部署与镜像' },
    { name: 'design-system', repo: 'design-system', note: '已归档' }
  ];

  const searchInput = byId('searchInput');
  function renderSearch() {
    const query = (searchInput ? searchInput.value : '').trim().toLowerCase();
    const results = byId('searchResults');
    const empty = byId('searchEmpty');
    if (!results) return;
    results.innerHTML = '';
    const matches = SEARCH_PROJECTS.filter(
      (item) => !query || item.name.includes(query) || item.repo.includes(query) || item.note.includes(query)
    );
    matches.forEach((item) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'menu__item';
      button.dataset.openProject = item.name;
      const name = document.createElement('span');
      name.textContent = item.name;
      const note = document.createElement('span');
      note.className = 'meta';
      note.textContent = item.note;
      button.append(name, note);
      li.appendChild(button);
      results.appendChild(li);
    });
    if (empty) empty.hidden = matches.length > 0;
  }

  if (searchInput) {
    searchInput.addEventListener('input', renderSearch);
    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        const first = $('#searchResults [data-open-project]');
        if (first) first.click();
      }
    });
    renderSearch();
  }

  /* ---------------- 初始化 ---------------- */

  setView('chat');
  setScreen('login');
  renderSkill('s1');
  setGithub(true, { silent: true });
  const titleNote = $('.chathead .meta');
  if (titleNote) titleNote.innerHTML = '<span class="mono">qgents-web</span> · 5 名成员，含 1 个 Agent';

  window.addEventListener('resize', () => {
    if (window.innerWidth > 1100) {
      context.classList.remove('is-open');
      scrim.hidden = true;
      const toggle = byId('ctxToggle');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }
    if (openPop) closePopovers(false);
  });
})();
