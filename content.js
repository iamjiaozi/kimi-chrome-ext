(() => {
  if (window.__kimiEnhancerInitialized) return;
  window.__kimiEnhancerInitialized = true;

  const state = {
    DEBUG: true, // 调试模式开关
    DEBUG: false, // 注释掉打开 DEBUG 
    items: [], // { id, text, el }
    elToId: new WeakMap(),
    panel: null,
    ui: {
      listEl: null,
      inputEl: null,
      toggleEl: null,
      collapsed: false,
      filter: '',
    },
    nextId: 1,
  };

  console.debug('[kimi增强助手] 内容脚本已加载');

  function createPanel() {
    const rootPanel = document.createElement('div');
    rootPanel.className = 'root-panel';
    rootPanel.style.position = 'fixed';
    rootPanel.style.zIndex = '2147483646';
    rootPanel.style.right = '180px';  // 默认值是 180px
    rootPanel.style.top = '20px';
    rootPanel.style.width = '280px';
    rootPanel.style.pointerEvents = 'auto';

    const container = document.createElement('div');
    container.id = 'kne-panel';   // kne-pannel
    container.style.width = '100%';
    container.style.height = '100%';

    const shadow = container.attachShadow({ mode: 'open' });

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('textContent.css');

    const wrap = document.createElement('div');
    wrap.className = 'panel';

    const header = document.createElement('div');
    header.className = 'header';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = '问题列表';
    const toggle = document.createElement('button');
    toggle.className = 'toggle';
    toggle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" role="img" width="1em" height="1em" viewBox="0 0 1024 1024" name="Down_b" class="iconify expand-icon"><path d="M482.95936 717.33248a36.864 36.864 0 0 0 52.0192-0.08192l285.696-285.696a36.864 36.864 0 1 0-52.10112-52.10112l-259.72736 259.6864-261.69344-259.80928a36.864 36.864 0 1 0-51.93728 52.34688l287.744 285.65504z" fill="currentColor"></path></svg>`;
    
    const updateState = (collapsed) => {
      state.ui.collapsed = collapsed;
      wrap.classList.toggle('collapsed', collapsed);
      toggle.classList.toggle('collapsed', collapsed);
    };
    state.ui.setCollapsed = updateState;

    // 初始状态为收起
    state.ui.collapsed = true;
    wrap.classList.add('collapsed');

    wrap.addEventListener('mouseenter', () => {
      updateState(false);
    });

    wrap.addEventListener('mouseleave', () => {
      if (state.DEBUG) {
        log('调试模式开启：鼠标离开面板，但不自动隐藏');
        return;
      }
      updateState(true);
    });

    const input = document.createElement('input');
    input.className = 'search';
    input.placeholder = '搜索';
    input.addEventListener('input', () => {
      state.ui.filter = input.value.trim();
      renderList();
    });

    header.appendChild(title);
    header.appendChild(toggle);

    // 拖拽逻辑
    let isDragging = false;
    let startX, startY, startRight, startTop;

    header.addEventListener('mousedown', (e) => {
      // 如果点击的是 toggle 按钮，不触发拖拽
      if (e.target.closest('.toggle')) return;
      
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      
      const rect = rootPanel.getBoundingClientRect();
      // 计算 right 值 (window.innerWidth - rect.right)
      startRight = window.innerWidth - rect.right;
      startTop = rect.top;
      
      // 防止选中文本
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      // 因为是 right 定位，向右移动 right 变小，向左移动 right 变大
      // deltaX > 0 (向右)，right 应该减小
      rootPanel.style.right = `${startRight - deltaX}px`;
      rootPanel.style.top = `${startTop + deltaY}px`;
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
    
    const body = document.createElement('div');
    body.className = 'body';
    body.appendChild(input);
    const list = document.createElement('div');
    list.className = 'list';
    body.appendChild(list);

    wrap.appendChild(header);
    wrap.appendChild(body);

    shadow.appendChild(link);
    shadow.appendChild(wrap);

    state.ui.listEl = list;
    state.ui.inputEl = input;
    state.ui.toggleEl = toggle;
    state.panel = container;
    state.rootPanel = rootPanel;
    
    rootPanel.appendChild(container);
    document.body.appendChild(rootPanel);

    // 初始化时检查 URL
    checkUrl();
  }

  function checkUrl() {
    if (!state.rootPanel) return;
    const isChat = window.location.href.includes('/chat/');
    state.rootPanel.style.display = isChat ? 'block' : 'none';
  }

  function textOf(el) {
    const t = (el.textContent || '').trim();
    return t.replace(/\s+/g, ' ');
  }

  function indexQuestions() {
    const nodes = document.querySelectorAll('.user-content');
    nodes.forEach((el) => {
      if (!el || state.elToId.has(el)) return;
      const text = textOf(el);
      if (!text) return;
      const id = `kne-q-${state.nextId++}`;
      state.elToId.set(el, id);
      el.setAttribute('data-kne-id', id);
      state.items.push({ id, text, el });
    });
  }

  function renderList() {
    if (!state.ui.listEl) return;
    state.ui.listEl.innerHTML = '';
    const filtered = state.ui.filter
      ? state.items.filter((it) => it.text.toLowerCase().includes(state.ui.filter.toLowerCase()))
      : state.items;

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = state.items.length === 0 ? '尚未发现用户问题' : '没有匹配的结果';
      state.ui.listEl.appendChild(empty);
      return;
    }

    filtered.forEach((it, idx) => {
      const item = document.createElement('div');
      item.className = 'item';
      item.addEventListener('click', () => jumpTo(it));
      const text = document.createElement('div');
      text.className = 'text';
      text.textContent = it.text;
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = ``;
      // meta.textContent = `#${idx + 1} · ${it.id}`;  // 问题 html id 位置
      item.appendChild(text);
      item.appendChild(meta);
      state.ui.listEl.appendChild(item);
    });
  }

  function jumpTo(it) {
    if (!it || !it.el || !document.body.contains(it.el)) return;
    // 使用 auto 替代 smooth，解决部分场景下向下滚动定位无效的问题
    it.el.scrollIntoView({ behavior: 'auto', block: 'center' });
    try {
      it.el.classList.add('kne-highlight');
      setTimeout(() => it.el && it.el.classList.remove('kne-highlight'), 1500);
    } catch {}

    if (state.ui.setCollapsed) {
      state.ui.setCollapsed(true);
    }
  }

  function init() {
    createPanel();
    indexQuestions();
    renderList();

    // 监听 URL 变化
    // 由于 SPA 页面切换可能不会触发 popstate，需要 patch pushState/replaceState 或使用 MutationObserver 辅助
    // 这里简单起见，使用 MutationObserver 并在每次变化时检查 URL
    // 也可以监听 popstate
    window.addEventListener('popstate', checkUrl);

    // 打印第一个 .segment-container 的宽度
    const segmentContainer = document.querySelector('.segment-container');
    if (segmentContainer) {
      const rect = segmentContainer.getBoundingClientRect();
      console.log('Width of first .segment-container:', rect.width);
    } else {
      console.log('.segment-container not found');
    }

    // 打印第一个 .chat-content-list 的宽度
    const chatContentList = document.querySelector('div.chat-content-list');
    if (chatContentList) {
      const rect = chatContentList.getBoundingClientRect();
      console.log('Width of first .chat-content-list:', rect.width);
    } else {
      console.log('.chat-content-list not found');
    }

    // 打印 #page-layout-container 的宽度
    const pageLayoutContainer = document.getElementById('page-layout-container');
    if (pageLayoutContainer) {
      const rect = pageLayoutContainer.getBoundingClientRect();
      console.log('Width of #page-layout-container:', rect.width);
    } else {
      console.log('#page-layout-container not found');
    }

    // 观察 DOM 变化，动态更新
    const observer = new MutationObserver((mutations) => {
      let changed = false;
      
      // 每次 DOM 变化都检查一次 URL
      checkUrl();

      for (const m of mutations) {
        if (m.type === 'childList') {
          m.addedNodes && m.addedNodes.forEach((n) => {
            if (!(n instanceof Element)) return;
            // 自身就是用户问题
            if (n.matches && n.matches('.user-content')) {
              const text = textOf(n);
              if (text && !state.elToId.has(n)) {
                const id = `kne-q-${state.nextId++}`;
                state.elToId.set(n, id);
                n.setAttribute('data-kne-id', id);
                state.items.push({ id, text, el: n });
                changed = true;
              }
            }
            // 子树中包含用户问题
            const inner = n.querySelectorAll ? n.querySelectorAll('.user-content') : [];
            inner && inner.forEach((el) => {
              const text = textOf(el);
              if (text && !state.elToId.has(el)) {
                const id = `kne-q-${state.nextId++}`;
                state.elToId.set(el, id);
                el.setAttribute('data-kne-id', id);
                state.items.push({ id, text, el });
                changed = true;
              }
            });
          });
          // 移除的节点进行 GC
          if (m.removedNodes && m.removedNodes.length) {
            gcDisconnected();
            changed = true;
          }
        }
      }
      if (changed) renderList();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function gcDisconnected() {
    // 清除已不在文档中的项
    state.items = state.items.filter((it) => it.el && document.body.contains(it.el));
  }

  init();
})();
