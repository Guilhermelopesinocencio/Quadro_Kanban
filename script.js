/* ─────────────────────────────────────────
   CONFIGURAÇÃO DAS COLUNAS
   Define as 4 colunas do quadro Kanban:
   cada objeto tem um id interno, um nome
   visível e uma classe CSS para estilização.
───────────────────────────────────────── */
const COLS = [
    { id: 'todo', name: 'A fazer', cls: 'col-todo' },
    { id: 'prog', name: 'Em progresso', cls: 'col-prog' },
    { id: 'done', name: 'Finalizado', cls: 'col-done' },
    { id: 'hist', name: 'Histórico', cls: 'col-hist' },
];

/*
   COL_ORDER: ordem das colunas que participam
   do fluxo de movimentação (◀ ▶ e drag & drop).
   A coluna 'hist' é excluída — ela só recebe
   tarefas arquivadas e não permite mover de volta.
*/
const COL_ORDER = ['todo', 'prog', 'done'];

/* ─────────────────────────────────────────
   ESTADO INICIAL DA APLICAÇÃO
   `tasks` é o array principal que guarda
   todas as tarefas. Cada tarefa possui:
     - id        : identificador único
     - title     : título da tarefa
     - desc      : descrição (pode ser vazia)
     - col       : coluna atual ('todo','prog','done','hist')
     - prio      : prioridade ('alta','media','baixa')
     - createdAt : data de criação (string pt-BR)
     - finishedAt: data de conclusão (só nas arquivadas)
───────────────────────────────────────── */
var tasks = [
    { id: 1, title: 'Pesquisar concorrentes', desc: 'Analisar os 5 principais concorrentes', col: 'todo', prio: 'alta', createdAt: todayStr() },
    { id: 2, title: 'Criar wireframes', desc: 'Wireframes das telas principais', col: 'todo', prio: 'media', createdAt: todayStr() },
    { id: 3, title: 'Reunião com cliente', desc: 'Alinhamento de requisitos', col: 'prog', prio: 'alta', createdAt: todayStr() },
    { id: 4, title: 'Setup do ambiente', desc: 'Configurar Docker e dependências', col: 'prog', prio: 'baixa', createdAt: todayStr() },
    { id: 5, title: 'Design do logo', desc: 'Versão final aprovada', col: 'hist', prio: 'media', createdAt: '10/03/2026', finishedAt: '10/03/2026' },
];

var nextId = 6;        // próximo id a ser atribuído a uma nova tarefa
var editingId = null;     // id da tarefa que está sendo editada no momento
var ctxId = null;     // id da tarefa vinculada ao context menu aberto
var dragId = null;     // id da tarefa que está sendo arrastada (drag & drop)
var newPrio = 'alta';   // prioridade selecionada no modal "Nova tarefa"
var editPrio = 'media';  // prioridade selecionada no modal "Editar tarefa"

/* ─────────────────────────────────────────
   HELPERS (funções auxiliares reutilizáveis)
───────────────────────────────────────── */

/* Retorna a data de hoje formatada como dd/mm/aaaa no padrão pt-BR */
function todayStr() {
    return new Date().toLocaleDateString('pt-BR');
}

/* Busca uma tarefa pelo seu id numérico no array `tasks`.
   Retorna o objeto tarefa ou undefined se não encontrar. */
function getTask(id) {
    return tasks.find(function (t) { return t.id === id; });
}

/* Retorna a posição (índice) de uma coluna dentro de COL_ORDER.
   Exemplo: colIndex('prog') → 1
   Retorna -1 se a coluna não existir em COL_ORDER (ex.: 'hist'). */
function colIndex(col) {
    return COL_ORDER.indexOf(col);
}

/* ─────────────────────────────────────────
   ESTATÍSTICAS DO TOPBAR
   Atualiza os contadores exibidos na barra
   superior após qualquer alteração no estado.
───────────────────────────────────────── */
function updateStats() {
    /* Conta tarefas na coluna "A fazer" */
    document.getElementById('stat-todo').textContent =
        tasks.filter(function (t) { return t.col === 'todo'; }).length;

    /* Conta tarefas na coluna "Em progresso" */
    document.getElementById('stat-prog').textContent =
        tasks.filter(function (t) { return t.col === 'prog'; }).length;

    /* Conta tarefas concluídas: inclui "Finalizado" + "Histórico" */
    document.getElementById('stat-done').textContent =
        tasks.filter(function (t) { return t.col === 'done' || t.col === 'hist'; }).length;
}

/* ─────────────────────────────────────────
   RENDERIZAÇÃO DO BOARD
   Reconstrói todo o HTML do quadro a partir
   do array `tasks`. Chamada sempre que o
   estado muda (nova tarefa, mover, excluir…).
───────────────────────────────────────── */
function render() {
    var board = document.getElementById('board');
    board.innerHTML = ''; // limpa o board antes de reconstruir

    /* Itera sobre cada coluna definida em COLS */
    COLS.forEach(function (col) {
        /* Filtra apenas as tarefas que pertencem a esta coluna */
        var colTasks = tasks.filter(function (t) { return t.col === col.id; });

        /* ── Cria o elemento da coluna ── */
        var div = document.createElement('div');
        div.className = 'kb-col ' + col.cls; // aplica classe de cor da coluna
        div.dataset.col = col.id;             // guarda o id para uso no drop

        /* ── Eventos de Drag & Drop na coluna ── */

        /* Permite soltar cards nesta coluna (necessário para o drop funcionar) */
        div.addEventListener('dragover', function (e) {
            e.preventDefault(); // sem isso o drop não dispara
            div.classList.add('hovered'); // destaca a coluna visualmente
        });

        /* Remove o destaque quando o cursor sai da área da coluna */
        div.addEventListener('dragleave', function (e) {
            /* Verifica se o cursor saiu para fora da coluna de verdade
               (não apenas entrou em um filho) */
            if (!div.contains(e.relatedTarget)) div.classList.remove('hovered');
        });

        /* Executa a movimentação quando o card é solto na coluna */
        div.addEventListener('drop', function (e) {
            e.preventDefault();
            div.classList.remove('hovered');
            if (dragId !== null) moveTaskToCol(dragId, col.id); // move a tarefa arrastada
        });

        /* ── Cabeçalho da coluna ── */
        var head = document.createElement('div');
        head.className = 'col-head';
        head.innerHTML =
            '<div class="col-stripe"></div>' +                         // barra colorida lateral
            '<span class="col-name">' + col.name + '</span>' +         // nome da coluna
            '<span class="col-count">' + colTasks.length + '</span>';  // contador de tarefas
        div.appendChild(head);

        /* ── Corpo da coluna (onde os cards ficam) ── */
        var body = document.createElement('div');
        body.className = 'col-body';

        /* Cria um card para cada tarefa desta coluna */
        colTasks.forEach(function (t) {
            body.appendChild(buildCard(t));
        });

        /* ── Botão "Nova tarefa" — aparece apenas na coluna "A fazer" ── */
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
        board.appendChild(div); // adiciona a coluna ao board
    });

    updateStats(); // atualiza os chips de contagem no topbar
}

/* ─────────────────────────────────────────
   CONSTRUÇÃO DO CARD
   Monta o elemento HTML completo de uma
   tarefa a partir do objeto `t`.
───────────────────────────────────────── */
function buildCard(t) {
    var card = document.createElement('div');
    /* Cards do histórico recebem classe extra para estilo "riscado" */
    card.className = 'kb-card' + (t.col === 'hist' ? ' hist-card' : '');
    /* Cards do histórico não podem ser arrastados */
    card.draggable = (t.col !== 'hist');
    card.dataset.id = t.id; // guarda o id no DOM para referência

    /* ── Eventos de Drag & Drop no card ── */

    /* Ao começar a arrastar: registra o id e aplica opacidade reduzida */
    card.addEventListener('dragstart', function () {
        dragId = t.id;
        /* setTimeout 0 garante que o estilo visual seja aplicado
           após o navegador criar a imagem de arrastar */
        setTimeout(function () { card.classList.add('dragging'); }, 0);
    });

    /* Ao soltar: limpa o estado de arraste */
    card.addEventListener('dragend', function () {
        dragId = null;
        card.classList.remove('dragging');
    });

    /* ── Topo do card: título + botão de menu (⋯) ── */
    var top = document.createElement('div');
    top.className = 'card-top';
    /* escHtml previne XSS ao renderizar o título do usuário */
    top.innerHTML = '<span class="card-title">' + escHtml(t.title) + '</span>';

    /* O botão de menu não aparece em cards do histórico */
    if (t.col !== 'hist') {
        var menuBtn = document.createElement('button');
        menuBtn.className = 'card-menu-btn';
        menuBtn.textContent = '⋯'; // ícone de três pontos
        menuBtn.setAttribute('aria-label', 'Opções');
        /* Abre o context menu posicionado no clique */
        menuBtn.addEventListener('click', function (e) { openCtx(e, t.id); });
        top.appendChild(menuBtn);
    }
    card.appendChild(top);

    /* ── Descrição (opcional) ── */
    if (t.desc) {
        var desc = document.createElement('div');
        desc.className = 'card-desc';
        desc.textContent = t.desc; // textContent é seguro (não interpreta HTML)
        card.appendChild(desc);
    }

    /* ── Rodapé do card: botões de mover + badge de prioridade ── */
    var foot = document.createElement('div');
    foot.className = 'card-foot';

    /* Botões ◀ ▶ gerados dinamicamente conforme a posição da coluna */
    var moves = document.createElement('div');
    moves.className = 'card-moves';
    moves.innerHTML = buildMoveBtns(t);
    foot.appendChild(moves);

    /* Mapeia o valor de prioridade para classe CSS e texto legível */
    var badgeMap = { alta: 'badge-alta', media: 'badge-media', baixa: 'badge-baixa' };
    var labelMap = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
    var badge = document.createElement('span');
    badge.className = 'prio-badge ' + badgeMap[t.prio];
    badge.textContent = labelMap[t.prio];
    foot.appendChild(badge);

    card.appendChild(foot);

    /* ── Data de criação ── */
    var dateEl = document.createElement('div');
    dateEl.className = 'card-date';
    dateEl.innerHTML =
        /* ícone de calendário inline */
        '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
        '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>' +
        '<line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>' +
        '<line x1="3" y1="10" x2="21" y2="10"/></svg>' +
        escHtml(t.createdAt); // data formatada
    card.appendChild(dateEl);

    /* ── Stamp de conclusão — exibido apenas em cards do histórico ── */
    if (t.col === 'hist') {
        var stamp = document.createElement('div');
        stamp.className = 'hist-stamp';
        stamp.innerHTML =
            /* ícone de check */
            '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">' +
            '<polyline points="20 6 9 17 4 12"/></svg>' +
            'Concluído em ' + escHtml(t.finishedAt);
        card.appendChild(stamp);
    }

    return card;
}

/* ─────────────────────────────────────────
   BOTÕES ◀ ▶ (mover para coluna anterior/próxima)
   Gera o HTML dos botões de acordo com a
   posição atual da tarefa no COL_ORDER.
   - Se estiver na primeira coluna, não exibe ◀
   - Se estiver na última coluna, não exibe ▶
───────────────────────────────────────── */
function buildMoveBtns(t) {
    var idx = colIndex(t.col); // posição atual (0, 1 ou 2)
    var html = '';

    /* Botão "mover para esquerda" — só se não estiver na primeira coluna */
    if (idx > 0)
        html += '<button class="move-btn" onclick="moveTask(' + t.id + ',-1)">◀</button>';

    /* Botão "mover para direita" — só se não estiver na última coluna */
    if (idx < COL_ORDER.length - 1)
        html += '<button class="move-btn" onclick="moveTask(' + t.id + ',1)">▶</button>';

    return html;
}

/* ─────────────────────────────────────────
   MOVER TAREFAS
───────────────────────────────────────── */

/*
   moveTask: move uma tarefa uma posição para
   a esquerda (dir = -1) ou direita (dir = 1)
   dentro de COL_ORDER e re-renderiza o board.
*/
function moveTask(id, dir) {
    var t = getTask(id);
    if (!t) return;
    var ni = colIndex(t.col) + dir; // novo índice calculado
    if (ni >= 0 && ni < COL_ORDER.length) {
        t.col = COL_ORDER[ni]; // atualiza a coluna da tarefa
        render();
    }
}

/*
   moveTaskToCol: move uma tarefa diretamente
   para uma coluna específica (usada no drop).
   - Ignora drops em tarefas do histórico.
   - Se o destino for 'hist', arquiva a tarefa.
*/
function moveTaskToCol(id, col) {
    var t = getTask(id);
    if (!t || t.col === 'hist') return; // histórico é imutável
    if (col === 'hist') { archiveTask(id); return; } // arquiva ao soltar no histórico
    t.col = col;
    render();
}

/*
   archiveTask: move a tarefa para o histórico
   ('hist') e registra a data de conclusão.
*/
function archiveTask(id) {
    var t = getTask(id);
    if (!t) return;
    t.col = 'hist';
    t.finishedAt = todayStr(); // registra quando foi concluída
    render();
}

/* ─────────────────────────────────────────
   MODAL NOVA TAREFA
   Controla a abertura, fechamento e salvamento
   do formulário de criação de tarefas.
───────────────────────────────────────── */

/* Abre o modal, limpa campos e foca o título */
function openModal() {
    document.getElementById('f-title').value = '';
    document.getElementById('f-desc').value = '';
    document.getElementById('f-title').classList.remove('error'); // remove erro anterior
    newPrio = 'alta';                         // reseta prioridade para o padrão
    syncPrio('prio-selector', 'alta');        // marca o botão "Alta" como ativo
    document.getElementById('modal-bg').classList.add('open'); // exibe o modal
    /* Foca o input com pequeno delay para garantir visibilidade do modal */
    setTimeout(function () { document.getElementById('f-title').focus(); }, 60);
}

/* Fecha o modal de nova tarefa removendo a classe 'open' */
function closeModal() {
    document.getElementById('modal-bg').classList.remove('open');
}

/* Valida o formulário, cria a tarefa e re-renderiza */
function saveTask() {
    var titleEl = document.getElementById('f-title');
    var title = titleEl.value.trim();

    /* Validação: título é obrigatório */
    if (!title) {
        titleEl.classList.add('error'); // borda vermelha de erro
        titleEl.focus();
        return; // interrompe sem salvar
    }
    titleEl.classList.remove('error');

    /* Adiciona a nova tarefa ao array com id incremental */
    tasks.push({
        id: nextId++,
        title: title,
        desc: document.getElementById('f-desc').value.trim(),
        col: 'todo',      // toda nova tarefa começa em "A fazer"
        prio: newPrio,     // prioridade escolhida no seletor
        createdAt: todayStr(),
    });

    closeModal();
    render(); // atualiza o board com a nova tarefa
}

/* ─────────────────────────────────────────
   MODAL EDITAR TAREFA
   Preenche o formulário com os dados da
   tarefa existente e salva as alterações.
───────────────────────────────────────── */

/* Abre o modal de edição preenchido com os dados da tarefa `id` */
function openEditModal(id) {
    var t = getTask(id);
    if (!t) return;
    editingId = id;           // guarda qual tarefa está sendo editada
    editPrio = t.prio;       // carrega a prioridade atual

    /* Preenche os campos com os valores atuais da tarefa */
    document.getElementById('ef-title').value = t.title;
    document.getElementById('ef-desc').value = t.desc || '';
    document.getElementById('ef-title').classList.remove('error');

    syncPrio('edit-prio-selector', t.prio); // marca a prioridade correta
    document.getElementById('edit-modal-bg').classList.add('open');
    setTimeout(function () { document.getElementById('ef-title').focus(); }, 60);
}

/* Fecha o modal de edição e reseta o id em edição */
function closeEditModal() {
    document.getElementById('edit-modal-bg').classList.remove('open');
    editingId = null;
}

/* Valida e aplica as alterações da edição na tarefa */
function saveEdit() {
    var titleEl = document.getElementById('ef-title');
    var title = titleEl.value.trim();

    /* Validação: título é obrigatório */
    if (!title) {
        titleEl.classList.add('error');
        titleEl.focus();
        return;
    }
    titleEl.classList.remove('error');

    /* Atualiza os campos da tarefa no array */
    var t = getTask(editingId);
    if (t) {
        t.title = title;
        t.desc = document.getElementById('ef-desc').value.trim();
        t.prio = editPrio; // prioridade selecionada durante a edição
    }

    closeEditModal();
    render();
}

/* ─────────────────────────────────────────
   SELETOR DE PRIORIDADE
   Sincroniza o visual dos botões Alta/Média/Baixa
   em ambos os modais (novo e editar).
───────────────────────────────────────── */

/*
   syncPrio: recebe o id do seletor e o valor
   de prioridade, e marca o botão correspondente
   como 'active' (desmarcando os demais).
*/
function syncPrio(selectorId, prio) {
    var btns = document.querySelectorAll('#' + selectorId + ' .prio-btn');
    btns.forEach(function (btn) {
        /* toggle: adiciona 'active' se o data-prio bate, remove se não */
        btn.classList.toggle('active', btn.dataset.prio === prio);
    });
}

/*
   Listener global de clique nos botões de prioridade.
   Identifica em qual seletor o clique ocorreu
   (novo ou editar) e atualiza a variável correspondente.
*/
document.addEventListener('click', function (e) {
    var btn = e.target.closest('.prio-btn'); // encontra o botão clicado
    if (!btn) return;
    var sel = btn.closest('.prio-row');      // encontra o seletor pai
    if (!sel) return;
    var p = btn.dataset.prio;               // valor da prioridade

    if (sel.id === 'prio-selector') {
        /* Seletor do modal "Nova tarefa" */
        newPrio = p;
        syncPrio('prio-selector', p);
    } else if (sel.id === 'edit-prio-selector') {
        /* Seletor do modal "Editar tarefa" */
        editPrio = p;
        syncPrio('edit-prio-selector', p);
    }
});

/* ─────────────────────────────────────────
   CONTEXT MENU (menu de contexto do card)
   Menu flutuante com opções: Editar, Mover
   para esquerda/direita, Excluir.
───────────────────────────────────────── */

/* Abre o menu de contexto posicionado próximo ao clique */
function openCtx(e, id) {
    e.stopPropagation(); // evita que o clique feche o menu imediatamente
    ctxId = id;          // vincula o menu à tarefa

    var t = getTask(id);
    var menu = document.getElementById('ctx-menu');
    var idx = t ? colIndex(t.col) : -1;

    /* Desabilita "Mover para esquerda" se já estiver na primeira coluna */
    document.getElementById('ctx-left-btn').classList.toggle('disabled', idx <= 0);

    /* Desabilita "Mover para direita" se já estiver na última coluna */
    document.getElementById('ctx-right-btn').classList.toggle('disabled', idx >= COL_ORDER.length - 1);

    /* Calcula a posição do menu garantindo que não saia da viewport */
    var x = Math.min(e.clientX, window.innerWidth - 210); // 210px = largura aprox. do menu
    var y = Math.min(e.clientY, window.innerHeight - 200); // 200px = altura aprox. do menu
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.classList.add('open'); // exibe o menu
}

/* Fecha o menu de contexto e limpa o id vinculado */
function closeCtx() {
    document.getElementById('ctx-menu').classList.remove('open');
    ctxId = null;
}

/* Ação "Editar": fecha o menu e abre o modal de edição */
function ctxEdit() { var id = ctxId; closeCtx(); openEditModal(id); }

/* Ação "Mover": fecha o menu e move na direção indicada (-1 ou +1) */
function ctxMove(dir) { var id = ctxId; closeCtx(); moveTask(id, dir); }

/* Ação "Arquivar": fecha o menu e move para o histórico */
function ctxArchive() { var id = ctxId; closeCtx(); archiveTask(id); }

/* Ação "Excluir": fecha o menu, remove a tarefa do array e re-renderiza */
function ctxDelete() {
    var id = ctxId;
    closeCtx();
    tasks = tasks.filter(function (x) { return x.id !== id; }); // remove pelo id
    render();
}

/* ─────────────────────────────────────────
   EVENTOS GLOBAIS
───────────────────────────────────────── */

/* Fecha o context menu ao clicar em qualquer área fora dele
   (exceto no próprio botão ⋯ que o abre) */
document.addEventListener('click', function (e) {
    if (!e.target.closest('.ctx-menu') && !e.target.closest('.card-menu-btn')) closeCtx();
});

/* Tecla ESC fecha qualquer modal ou menu aberto */
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeModal(); closeEditModal(); closeCtx(); }
});

/* Clique no fundo escuro (backdrop) do modal de nova tarefa fecha o modal */
document.getElementById('modal-bg').addEventListener('click', function (e) {
    if (e.target === this) closeModal(); // só fecha se o clique for no overlay, não no modal
});

/* Clique no fundo escuro do modal de edição fecha o modal */
document.getElementById('edit-modal-bg').addEventListener('click', function (e) {
    if (e.target === this) closeEditModal();
});

/* ─────────────────────────────────────────
   ESCAPE SEGURO PARA HTML (prevenção de XSS)
   Converte caracteres especiais em entidades
   HTML para evitar injeção de código ao
   renderizar conteúdo digitado pelo usuário.
───────────────────────────────────────── */
function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')   // & → &amp;
        .replace(/</g, '&lt;')    // < → &lt;
        .replace(/>/g, '&gt;')    // > → &gt;
        .replace(/"/g, '&quot;'); // " → &quot;
}

/* ─────────────────────────────────────────
   INICIALIZAÇÃO
   Renderiza o board assim que o script é
   carregado (ao final do <body>).
───────────────────────────────────────── */
render();