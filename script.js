/* ─────────────────────────────────────────
   CONFIGURAÇÃO
───────────────────────────────────────── */
const COLS = [
    { id: 'todo', name: 'A fazer', cls: 'col-todo' },
    { id: 'prog', name: 'Em progresso', cls: 'col-prog' },
    { id: 'done', name: 'Finalizado', cls: 'col-done' },
    { id: 'hist', name: 'Histórico', cls: 'col-hist' },
];

const COL_ORDER = ['todo', 'prog', 'done'];

/* ─────────────────────────────────────────
   ESTADO INICIAL
───────────────────────────────────────── */
var tasks = [
    { id: 1, title: 'Pesquisar concorrentes', desc: 'Analisar os 5 principais concorrentes', col: 'todo', prio: 'alta', createdAt: todayStr() },
    { id: 2, title: 'Criar wireframes', desc: 'Wireframes das telas principais', col: 'todo', prio: 'media', createdAt: todayStr() },
    { id: 3, title: 'Reunião com cliente', desc: 'Alinhamento de requisitos', col: 'prog', prio: 'alta', createdAt: todayStr() },
    { id: 4, title: 'Setup do ambiente', desc: 'Configurar Docker e dependências', col: 'prog', prio: 'baixa', createdAt: todayStr() },
    { id: 5, title: 'Design do logo', desc: 'Versão final aprovada', col: 'hist', prio: 'media', createdAt: '10/03/2026', finishedAt: '10/03/2026' },
];

var nextId = 6;
var editingId = null;
var ctxId = null;
var dragId = null;
var newPrio = 'alta';
var editPrio = 'media';

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
function todayStr() {
    return new Date().toLocaleDateString('pt-BR');
}

function getTask(id) {
    return tasks.find(function (t) { return t.id === id; });
}

function colIndex(col) {
    return COL_ORDER.indexOf(col);
}

/* ─────────────────────────────────────────
   ESTATÍSTICAS DO TOPBAR
───────────────────────────────────────── */
function updateStats() {
    document.getElementById('stat-todo').textContent =
        tasks.filter(function (t) { return t.col === 'todo'; }).length;
    document.getElementById('stat-prog').textContent =
        tasks.filter(function (t) { return t.col === 'prog'; }).length;
    document.getElementById('stat-done').textContent =
        tasks.filter(function (t) { return t.col === 'done' || t.col === 'hist'; }).length;
}

/* ─────────────────────────────────────────
   RENDERIZAÇÃO DO BOARD
───────────────────────────────────────── */
function render() {
    var board = document.getElementById('board');
    board.innerHTML = '';

    COLS.forEach(function (col) {
        var colTasks = tasks.filter(function (t) { return t.col === col.id; });

        /* Coluna */
        var div = document.createElement('div');
        div.className = 'kb-col ' + col.cls;
        div.dataset.col = col.id;

        /* Drop */
        div.addEventListener('dragover', function (e) {
            e.preventDefault();
            div.classList.add('hovered');
        });
        div.addEventListener('dragleave', function (e) {
            if (!div.contains(e.relatedTarget)) div.classList.remove('hovered');
        });
        div.addEventListener('drop', function (e) {
            e.preventDefault();
            div.classList.remove('hovered');
            if (dragId !== null) moveTaskToCol(dragId, col.id);
        });

        /* Cabeçalho */
        var head = document.createElement('div');
        head.className = 'col-head';
        head.innerHTML =
            '<div class="col-stripe"></div>' +
            '<span class="col-name">' + col.name + '</span>' +
            '<span class="col-count">' + colTasks.length + '</span>';
        div.appendChild(head);

        /* Corpo */
        var body = document.createElement('div');
        body.className = 'col-body';

        colTasks.forEach(function (t) {
            body.appendChild(buildCard(t));
        });

        /* Botão Nova Tarefa — apenas na coluna "A fazer" */
        if (col.id === 'todo') {
            var addBtn = document.createElement('button');
            addBtn.className = 'col-add-btn';
            addBtn.innerHTML =
                '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">' +
                '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
                'Nova tarefa';
            addBtn.addEventListener('click', function () { openModal(); });
            body.appendChild(addBtn);
        }

        div.appendChild(body);
        board.appendChild(div);
    });

    updateStats();
}

/* ─────────────────────────────────────────
   CONSTRUÇÃO DO CARD
───────────────────────────────────────── */
function buildCard(t) {
    var card = document.createElement('div');
    card.className = 'kb-card' + (t.col === 'hist' ? ' hist-card' : '');
    card.draggable = (t.col !== 'hist');
    card.dataset.id = t.id;

    /* Drag */
    card.addEventListener('dragstart', function () {
        dragId = t.id;
        setTimeout(function () { card.classList.add('dragging'); }, 0);
    });
    card.addEventListener('dragend', function () {
        dragId = null;
        card.classList.remove('dragging');
    });

    /* Topo: título + menu */
    var top = document.createElement('div');
    top.className = 'card-top';
    top.innerHTML =
        '<span class="card-title">' + escHtml(t.title) + '</span>';

    if (t.col !== 'hist') {
        var menuBtn = document.createElement('button');
        menuBtn.className = 'card-menu-btn';
        menuBtn.textContent = '⋯';
        menuBtn.setAttribute('aria-label', 'Opções');
        menuBtn.addEventListener('click', function (e) { openCtx(e, t.id); });
        top.appendChild(menuBtn);
    }
    card.appendChild(top);

    /* Descrição */
    if (t.desc) {
        var desc = document.createElement('div');
        desc.className = 'card-desc';
        desc.textContent = t.desc;
        card.appendChild(desc);
    }

    /* Rodapé: botões de mover + badge */
    var foot = document.createElement('div');
    foot.className = 'card-foot';

    var moves = document.createElement('div');
    moves.className = 'card-moves';
    moves.innerHTML = buildMoveBtns(t);
    foot.appendChild(moves);

    var badgeMap = { alta: 'badge-alta', media: 'badge-media', baixa: 'badge-baixa' };
    var labelMap = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
    var badge = document.createElement('span');
    badge.className = 'prio-badge ' + badgeMap[t.prio];
    badge.textContent = labelMap[t.prio];
    foot.appendChild(badge);

    card.appendChild(foot);

    /* Data */
    var dateEl = document.createElement('div');
    dateEl.className = 'card-date';
    dateEl.innerHTML =
        '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
        '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>' +
        '<line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>' +
        '<line x1="3" y1="10" x2="21" y2="10"/></svg>' +
        escHtml(t.createdAt);
    card.appendChild(dateEl);

    /* Histórico: stamp de conclusão */
    if (t.col === 'hist') {
        var stamp = document.createElement('div');
        stamp.className = 'hist-stamp';
        stamp.innerHTML =
            '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">' +
            '<polyline points="20 6 9 17 4 12"/></svg>' +
            'Concluído em ' + escHtml(t.finishedAt);
        card.appendChild(stamp);
    }

    return card;
}

/* ─────────────────────────────────────────
   BOTÕES ◀ ▶
───────────────────────────────────────── */
function buildMoveBtns(t) {
    var idx = colIndex(t.col);
    var html = '';
    if (idx > 0)
        html += '<button class="move-btn" onclick="moveTask(' + t.id + ',-1)">◀</button>';
    if (idx < COL_ORDER.length - 1)
        html += '<button class="move-btn" onclick="moveTask(' + t.id + ',1)">▶</button>';
    return html;
}

/* ─────────────────────────────────────────
   MOVER TAREFAS
───────────────────────────────────────── */
function moveTask(id, dir) {
    var t = getTask(id);
    if (!t) return;
    var ni = colIndex(t.col) + dir;
    if (ni >= 0 && ni < COL_ORDER.length) {
        t.col = COL_ORDER[ni];
        render();
    }
}

function moveTaskToCol(id, col) {
    var t = getTask(id);
    if (!t || t.col === 'hist') return;
    if (col === 'hist') { archiveTask(id); return; }
    t.col = col;
    render();
}

function archiveTask(id) {
    var t = getTask(id);
    if (!t) return;
    t.col = 'hist';
    t.finishedAt = todayStr();
    render();
}

/* ─────────────────────────────────────────
   MODAL NOVA TAREFA
───────────────────────────────────────── */
function openModal() {
    document.getElementById('f-title').value = '';
    document.getElementById('f-desc').value = '';
    document.getElementById('f-title').classList.remove('error');
    newPrio = 'alta';
    syncPrio('prio-selector', 'alta');
    document.getElementById('modal-bg').classList.add('open');
    setTimeout(function () { document.getElementById('f-title').focus(); }, 60);
}

function closeModal() {
    document.getElementById('modal-bg').classList.remove('open');
}

function saveTask() {
    var titleEl = document.getElementById('f-title');
    var title = titleEl.value.trim();
    if (!title) {
        titleEl.classList.add('error');
        titleEl.focus();
        return;
    }
    titleEl.classList.remove('error');

    tasks.push({
        id: nextId++,
        title: title,
        desc: document.getElementById('f-desc').value.trim(),
        col: 'todo',
        prio: newPrio,
        createdAt: todayStr(),
    });

    closeModal();
    render();
}

/* ─────────────────────────────────────────
   MODAL EDITAR TAREFA
───────────────────────────────────────── */
function openEditModal(id) {
    var t = getTask(id);
    if (!t) return;
    editingId = id;
    editPrio = t.prio;
    document.getElementById('ef-title').value = t.title;
    document.getElementById('ef-desc').value = t.desc || '';
    document.getElementById('ef-title').classList.remove('error');
    syncPrio('edit-prio-selector', t.prio);
    document.getElementById('edit-modal-bg').classList.add('open');
    setTimeout(function () { document.getElementById('ef-title').focus(); }, 60);
}

function closeEditModal() {
    document.getElementById('edit-modal-bg').classList.remove('open');
    editingId = null;
}

function saveEdit() {
    var titleEl = document.getElementById('ef-title');
    var title = titleEl.value.trim();
    if (!title) {
        titleEl.classList.add('error');
        titleEl.focus();
        return;
    }
    titleEl.classList.remove('error');

    var t = getTask(editingId);
    if (t) {
        t.title = title;
        t.desc = document.getElementById('ef-desc').value.trim();
        t.prio = editPrio;
    }
    closeEditModal();
    render();
}

/* ─────────────────────────────────────────
   SELETOR DE PRIORIDADE
───────────────────────────────────────── */
function syncPrio(selectorId, prio) {
    var btns = document.querySelectorAll('#' + selectorId + ' .prio-btn');
    btns.forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.prio === prio);
    });
}

document.addEventListener('click', function (e) {
    var btn = e.target.closest('.prio-btn');
    if (!btn) return;
    var sel = btn.closest('.prio-row');
    if (!sel) return;
    var p = btn.dataset.prio;
    if (sel.id === 'prio-selector') {
        newPrio = p;
        syncPrio('prio-selector', p);
    } else if (sel.id === 'edit-prio-selector') {
        editPrio = p;
        syncPrio('edit-prio-selector', p);
    }
});

/* ─────────────────────────────────────────
   CONTEXT MENU
───────────────────────────────────────── */
function openCtx(e, id) {
    e.stopPropagation();
    ctxId = id;
    var t = getTask(id);
    var menu = document.getElementById('ctx-menu');
    var idx = t ? colIndex(t.col) : -1;

    document.getElementById('ctx-left-btn').classList.toggle('disabled', idx <= 0);
    document.getElementById('ctx-right-btn').classList.toggle('disabled', idx >= COL_ORDER.length - 1);

    /* Posição — evita que saia da tela */
    var x = Math.min(e.clientX, window.innerWidth - 210);
    var y = Math.min(e.clientY, window.innerHeight - 200);
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.classList.add('open');
}

function closeCtx() {
    document.getElementById('ctx-menu').classList.remove('open');
    ctxId = null;
}

function ctxEdit() { var id = ctxId; closeCtx(); openEditModal(id); }
function ctxMove(dir) { var id = ctxId; closeCtx(); moveTask(id, dir); }
function ctxArchive() { var id = ctxId; closeCtx(); archiveTask(id); }
function ctxDelete() {
    var id = ctxId; closeCtx();
    tasks = tasks.filter(function (x) { return x.id !== id; });
    render();
}

/* ─────────────────────────────────────────
   EVENTOS GLOBAIS
───────────────────────────────────────── */
/* Fechar context menu ao clicar fora */
document.addEventListener('click', function (e) {
    if (!e.target.closest('.ctx-menu') && !e.target.closest('.card-menu-btn')) closeCtx();
});

/* ESC fecha modais e menu */
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeModal(); closeEditModal(); closeCtx(); }
});

/* Clique no backdrop fecha modal */
document.getElementById('modal-bg').addEventListener('click', function (e) {
    if (e.target === this) closeModal();
});
document.getElementById('edit-modal-bg').addEventListener('click', function (e) {
    if (e.target === this) closeEditModal();
});

/* ─────────────────────────────────────────
   ESCAPE SEGURO PARA HTML
───────────────────────────────────────── */
function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/* ─────────────────────────────────────────
   INIT
───────────────────────────────────────── */
render();