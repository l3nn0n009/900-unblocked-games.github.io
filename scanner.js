(() => {
  if (window.__jamestoreScanner) {
    window.__jamestoreScanner.focus();
    return;
  }

  const WORKER_COUNT = 10;
  const CLASS_RANGES = Array.from({ length: 10 }, (_, i) => {
    const start = i * 100 + 1;
    return {
      label: `${start}-${start + 99}`,
      start,
      end: start + 99,
    };
  });
  const IMG_ROOT = 'https://jamestore214.github.io/img/class-';
  const GAME_ROOT = 'https://jamestore214.github.io';
  const state = {
    queue: [],
    seen: new Set(),
    inFlight: new Set(),
    running: false,
    rows: new Map(),
    lastMessage: '',
  };

  const styles = `
    #jamestore-scanner {
      position: fixed;
      top: 10vh;
      left: 10vw;
      width: 480px;
      height: 520px;
      background: #10131a;
      color: #f5f6f8;
      border: 1px solid #3a4254;
      border-radius: 8px;
      box-shadow: 0 16px 40px rgba(0,0,0,0.55);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      display: flex;
      flex-direction: column;
      z-index: 2147483647;
      box-sizing: border-box;
      overflow: hidden;
    }
    #jamestore-scanner button,
    #jamestore-scanner select {
      font-size: 13px;
    }
    #jamestore-scanner * {
      box-sizing: border-box;
    }
    #jamestore-scanner .scanner-header {
      height: 40px;
      padding: 0 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: linear-gradient(135deg, #1d2433, #131820);
      cursor: move;
      user-select: none;
    }
    #jamestore-scanner .scanner-close {
      background: transparent;
      border: none;
      color: #9da8c6;
      font-size: 18px;
      cursor: pointer;
      width: 28px;
      height: 28px;
      line-height: 28px;
      padding: 0;
    }
    #jamestore-scanner .scanner-close:hover {
      color: #ff6b81;
    }
    #jamestore-scanner .scanner-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 12px;
      gap: 10px;
      overflow: hidden;
    }
    #jamestore-scanner .controls {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    #jamestore-scanner label {
      font-weight: 600;
      color: #c3cbe3;
    }
    #jamestore-scanner select,
    #jamestore-scanner button {
      background: #1c2231;
      color: #f5f6f8;
      border: 1px solid #31394d;
      border-radius: 4px;
      padding: 6px 8px;
    }
    #jamestore-scanner button {
      cursor: pointer;
      transition: background 0.15s ease;
    }
    #jamestore-scanner button:hover {
      background: #2a3245;
    }
    #jamestore-scanner button:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    #jamestore-scanner .status-bar {
      min-height: 22px;
      color: #87d7ff;
      font-variant-numeric: tabular-nums;
    }
    #jamestore-scanner .table-wrapper {
      flex: 1;
      border: 1px solid #242b3b;
      border-radius: 6px;
      overflow: auto;
      background: rgba(16, 19, 26, 0.85);
    }
    #jamestore-scanner table {
      width: 100%;
      border-collapse: collapse;
      min-width: 440px;
    }
    #jamestore-scanner thead {
      position: sticky;
      top: 0;
      background: #1b2230;
      z-index: 1;
    }
    #jamestore-scanner th,
    #jamestore-scanner td {
      padding: 6px 8px;
      border-bottom: 1px solid #232a3a;
      vertical-align: top;
      word-break: break-word;
    }
    #jamestore-scanner tbody tr:nth-child(odd) {
      background: rgba(24, 29, 40, 0.55);
    }
    #jamestore-scanner tbody tr:hover {
      background: rgba(47, 62, 102, 0.3);
    }
    #jamestore-scanner a {
      color: #7ab7ff;
      text-decoration: none;
    }
    #jamestore-scanner a:hover {
      text-decoration: underline;
    }
    #jamestore-scanner .logs {
      border: 1px solid #242b3b;
      border-radius: 6px;
      padding: 6px 8px;
      background: #111722;
      height: 80px;
      overflow: auto;
      font-family: "Roboto Mono", "SFMono-Regular", Menlo, monospace;
      font-size: 12px;
      color: #96a2c3;
    }
    #jamestore-scanner .scanner-resizer {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 16px;
      height: 16px;
      cursor: nwse-resize;
      background: linear-gradient(135deg, transparent 60%, rgba(138, 155, 202, 0.45));
    }
  `;
  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);

  const container = document.createElement('div');
  container.id = 'jamestore-scanner';

  const header = document.createElement('div');
  header.className = 'scanner-header';
  header.innerHTML = `<span style="font-weight:600;">Jamestore Class Scanner</span>`;
  const closeBtn = document.createElement('button');
  closeBtn.className = 'scanner-close';
  closeBtn.textContent = '×';
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'scanner-body';

  const controls = document.createElement('div');
  controls.className = 'controls';
  const rangeLabel = document.createElement('label');
  rangeLabel.textContent = 'Class Range';
  rangeLabel.setAttribute('for', 'scanner-range');
  const rangeSelect = document.createElement('select');
  rangeSelect.id = 'scanner-range';
  CLASS_RANGES.forEach((range) => {
    const opt = document.createElement('option');
    opt.value = `${range.start}-${range.end}`;
    opt.textContent = range.label;
    rangeSelect.appendChild(opt);
  });

  const startBtn = document.createElement('button');
  startBtn.textContent = 'Queue Range';
  const resumeBtn = document.createElement('button');
  resumeBtn.textContent = 'Resume';
  const pauseBtn = document.createElement('button');
  pauseBtn.textContent = 'Pause';
  pauseBtn.disabled = true;
  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'Clear Results';

  controls.append(rangeLabel, rangeSelect, startBtn, resumeBtn, pauseBtn, clearBtn);

  const statusBar = document.createElement('div');
  statusBar.className = 'status-bar';
  statusBar.textContent = 'Idle';

  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'table-wrapper';
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  thead.innerHTML = `<tr>
      <th style="width:60px;">Class</th>
      <th style="width:150px;">Site Name</th>
      <th style="width:200px;">Game URL</th>
      <th style="width:200px;">Image URL</th>
      <th>Status</th>
    </tr>`;
  const tbody = document.createElement('tbody');
  table.append(thead, tbody);
  tableWrapper.appendChild(table);

  const logBox = document.createElement('div');
  logBox.className = 'logs';

  const resizer = document.createElement('div');
  resizer.className = 'scanner-resizer';

  body.append(controls, statusBar, tableWrapper, logBox);
  container.append(header, body, resizer);
  document.body.appendChild(container);

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function log(message) {
    const now = new Date();
    const timestamp = now.toLocaleTimeString();
    state.lastMessage = message;
    const line = `[${timestamp}] ${message}`;
    const lineEl = document.createElement('div');
    lineEl.textContent = line;
    logBox.appendChild(lineEl);
    logBox.scrollTop = logBox.scrollHeight;
    statusBar.textContent = message;
  }

  function parseRange(value) {
    const [startStr, endStr] = value.split('-');
    return { start: Number(startStr), end: Number(endStr) };
  }

  function enqueueRange(range) {
    const added = [];
    for (let classId = range.start; classId <= range.end; classId++) {
      if (state.seen.has(classId)) continue;
      state.seen.add(classId);
      state.queue.push(classId);
      added.push(classId);
      ensureRow(classId).status.textContent = 'Queued';
    }
    if (added.length) {
      log(`Queued ${added.length} class${added.length === 1 ? '' : 'es'} (${range.start}-${range.end}).`);
      startProcessing();
    } else {
      log(`No new classes in ${range.start}-${range.end}; all already processed.`);
    }
  }

  function ensureRow(classId) {
    if (state.rows.has(classId)) return state.rows.get(classId);
    const row = document.createElement('tr');
    const classCell = document.createElement('td');
    classCell.textContent = classId;
    const nameCell = document.createElement('td');
    nameCell.textContent = '—';
    const gameCell = document.createElement('td');
    gameCell.textContent = '—';
    const imageCell = document.createElement('td');
    imageCell.textContent = '—';
    const statusCell = document.createElement('td');
    statusCell.textContent = 'Queued';
    row.append(classCell, nameCell, gameCell, imageCell, statusCell);
    tbody.appendChild(row);
    const rowObj = {
      row,
      name: nameCell,
      game: gameCell,
      image: imageCell,
      status: statusCell,
    };
    state.rows.set(classId, rowObj);
    return rowObj;
  }

  async function fetchOk(url, { expectText = false } = {}) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
      });
      if (!res.ok) return null;
      if (expectText) {
        const text = await res.text();
        return { res, text };
      }
      return { res };
    } catch (err) {
      return null;
    }
  }

  async function findGameForClass(classId) {
    for (let gameIndex = 1; gameIndex <= 100; gameIndex++) {
      const url = `${GAME_ROOT}/g${gameIndex}/class-${classId}`;
      const result = await fetchOk(url, { expectText: true });
      if (result) {
        const title = extractTitle(result.text) || `Jamestore g${gameIndex}`;
        return { url, title };
      }
      await delay(30);
    }
    return null;
  }

  function extractTitle(html) {
    const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (match && match[1]) return match[1].trim();
    return null;
  }

  async function processClass(classId) {
    const row = ensureRow(classId);
    row.status.textContent = 'Checking image…';
    const imageUrl = `${IMG_ROOT}${classId}.png`;
    const imgResult = await fetchOk(imageUrl);
    if (!imgResult) {
      row.status.textContent = 'Image missing';
      return;
    }
    row.image.innerHTML = `<a href="${imageUrl}" target="_blank" rel="noopener">Image</a>`;
    row.status.textContent = 'Searching game link…';
    const game = await findGameForClass(classId);
    if (!game) {
      row.status.textContent = 'Game not found';
      return;
    }
    row.game.innerHTML = `<a href="${game.url}" target="_blank" rel="noopener">${game.url}</a>`;
    row.name.textContent = game.title;
    row.status.textContent = 'Found';
  }

  async function workerLoop(workerIndex) {
    log(`Worker ${workerIndex + 1} online.`);
    while (state.running) {
      const classId = state.queue.shift();
      if (classId === undefined) {
        if (!state.running) break;
        await delay(150);
        continue;
      }
      state.inFlight.add(classId);
      log(`Worker ${workerIndex + 1} -> class ${classId}`);
      try {
        await processClass(classId);
      } catch (err) {
        const row = ensureRow(classId);
        row.status.textContent = 'Error';
        log(`Error on class ${classId}: ${err.message}`);
      } finally {
        state.inFlight.delete(classId);
        if (!state.running) continue;
        if (!state.queue.length && !state.inFlight.size) {
          state.running = false;
          pauseBtn.disabled = true;
          resumeBtn.disabled = false;
          log('Queue drained. All workers idle.');
        }
      }
    }
    log(`Worker ${workerIndex + 1} offline.`);
  }

  function startProcessing() {
    if (state.running) return;
    if (!state.queue.length) {
      log('No queued classes to process.');
      return;
    }
    state.running = true;
    pauseBtn.disabled = false;
    resumeBtn.disabled = true;
    for (let i = 0; i < WORKER_COUNT; i++) {
      workerLoop(i);
    }
    log(`Processing started with ${WORKER_COUNT} workers.`);
  }

  function pauseProcessing() {
    if (!state.running) return;
    state.running = false;
    pauseBtn.disabled = true;
    resumeBtn.disabled = false;
    log('Processing paused.');
  }

  function resumeProcessing() {
    if (state.running) return;
    if (!state.queue.length) {
      log('Nothing to resume; queue is empty.');
      return;
    }
    startProcessing();
  }

  function clearResults() {
    state.queue = [];
    state.inFlight.clear();
    state.seen.clear();
    state.rows.clear();
    tbody.innerHTML = '';
    log('Cleared queue and results.');
    pauseProcessing();
  }

  function makeDraggable(element, handle) {
    let offsetX = 0;
    let offsetY = 0;
    let dragging = false;

    handle.addEventListener('mousedown', (event) => {
      if (event.target.closest('button')) return;
      dragging = true;
      offsetX = event.clientX - element.offsetLeft;
      offsetY = event.clientY - element.offsetTop;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      event.preventDefault();
    });

    function onMouseMove(event) {
      if (!dragging) return;
      element.style.left = `${Math.max(0, event.clientX - offsetX)}px`;
      element.style.top = `${Math.max(0, event.clientY - offsetY)}px`;
    }

    function onMouseUp() {
      dragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
  }

  function makeResizable(element, handle) {
    let resizing = false;
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;

    handle.addEventListener('mousedown', (event) => {
      resizing = true;
      startX = event.clientX;
      startY = event.clientY;
      startWidth = element.offsetWidth;
      startHeight = element.offsetHeight;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      event.preventDefault();
    });

    function onMouseMove(event) {
      if (!resizing) return;
      const newWidth = Math.max(320, startWidth + (event.clientX - startX));
      const newHeight = Math.max(360, startHeight + (event.clientY - startY));
      element.style.width = `${newWidth}px`;
      element.style.height = `${newHeight}px`;
    }

    function onMouseUp() {
      resizing = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
  }

  startBtn.addEventListener('click', () => enqueueRange(parseRange(rangeSelect.value)));
  resumeBtn.addEventListener('click', resumeProcessing);
  pauseBtn.addEventListener('click', pauseProcessing);
  clearBtn.addEventListener('click', clearResults);

  closeBtn.addEventListener('click', () => {
    pauseProcessing();
    container.remove();
    styleEl.remove();
    delete window.__jamestoreScanner;
  });

  makeDraggable(container, header);
  makeResizable(container, resizer);

  window.__jamestoreScanner = {
    focus() {
      container.style.display = 'flex';
    },
  };
})();
