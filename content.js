(() => {
  if (window.__kimiEnhancerInitialized) return;
  window.__kimiEnhancerInitialized = true;

  const state = {
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
    const container = document.createElement('div');
    container.id = 'kne-panel';
    container.style.position = 'fixed';
    container.style.zIndex = '2147483646';
    container.style.right = '80px';
    container.style.top = '10px';
    container.style.width = '320px';
    container.style.pointerEvents = 'auto';

    const shadow = container.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      *, *::before, *::after { box-sizing: border-box; }
      :host { all: initial; }
      .panel { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        background: #fff; 
        border: 1px solid #e5e7eb; 
        border-radius: 8px; 
        box-shadow: 0 10px 25px rgba(0,0,0,0.12);
        overflow: hidden;
      }
      .header { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: #f8fafc; border-bottom: 1px solid #e5e7eb; }
      .title { font-size: 14px; font-weight: 600; color: #111827; flex: 1; }
      .toggle { border: none; background: transparent; cursor: pointer; color: #4f46e5; font-weight: 600; }
      .search { width: 100%; padding: 8px 10px; border: 1px solid #e5e7eb; border-radius: 6px; outline: none; font-size: 13px; }
      .search:focus { border-color: #a5b4fc; box-shadow: 0 0 0 3px rgba(165,180,252,0.3); }
      .body { padding: 10px 12px; }
      .empty { color: #6b7280; font-size: 13px; padding: 8px 0; }
      .list { display: flex; flex-direction: column; gap: 6px; max-height: 52vh; overflow: auto; }
      .item { 
        border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; cursor: pointer; background: #ffffff;
        transition: border-color 160ms ease, background 160ms ease;
      }
      .item:hover { border-color: #c7d2fe; background: #f8fafc; }
      .text { color: #111827; font-size: 13px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
      .meta { color: #6b7280; font-size: 12px; margin-top: 4px; }
      .collapsed .body { display: none; }
    `;

    const wrap = document.createElement('div');
    wrap.className = 'panel';

    const header = document.createElement('div');
    header.className = 'header';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = '问题列表';
    const toggle = document.createElement('button');
    toggle.className = 'toggle';
    toggle.textContent = '展开';
    
    const updateState = (collapsed) => {
      state.ui.collapsed = collapsed;
      wrap.classList.toggle('collapsed', collapsed);
      toggle.textContent = collapsed ? '展开' : '收起';
    };

    // 初始状态为收起
    state.ui.collapsed = true;
    wrap.classList.add('collapsed');

    wrap.addEventListener('mouseenter', () => {
      updateState(false);
    });

    wrap.addEventListener('mouseleave', () => {
      updateState(true);
    });
    const input = document.createElement('input');
    input.className = 'search';
    input.placeholder = '搜索问题（关键字过滤）';
    input.addEventListener('input', () => {
      state.ui.filter = input.value.trim();
      renderList();
    });

    header.appendChild(title);
    header.appendChild(toggle);
    
    const body = document.createElement('div');
    body.className = 'body';
    body.appendChild(input);
    const list = document.createElement('div');
    list.className = 'list';
    body.appendChild(list);

    wrap.appendChild(header);
    wrap.appendChild(body);

    shadow.appendChild(style);
    shadow.appendChild(wrap);

    state.ui.listEl = list;
    state.ui.inputEl = input;
    state.ui.toggleEl = toggle;
    state.panel = container;
    document.body.appendChild(container);
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
      meta.textContent = `#${idx + 1} · ${it.id}`;
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
  }

  function init() {
    createPanel();
    indexQuestions();
    renderList();

    // 观察 DOM 变化，动态更新
    const observer = new MutationObserver((mutations) => {
      let changed = false;
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
