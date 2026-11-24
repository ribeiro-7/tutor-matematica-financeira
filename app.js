'use strict';

const atividade = document.querySelector('#activity');
const mapa = document.querySelector('#map');
const grafo = document.querySelector('#edges');
const menuDiagnostico = document.querySelector('#diagnostic-menu');
const avisoSessao = document.querySelector('#session-status');
const chaveSessao = 'juros-em-jogo:sessao:v1';
const notas = Array(Dominio.conceitos.length + 1).fill(null);
const respostasDiagnostico = new Map();
const sessoes = new Map();
const nos = new Map();
const podeConsultarGemini = location.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(location.hostname);
const objetivos = [
  { id: 6, texto: 'Entender juros simples' },
  { id: 9, texto: 'Calcular juros compostos' },
  { id: 14, texto: 'Comparar pagamento à vista e parcelado' },
];
let servidorSemIA = false;
let avaliacao = null;
let diagnosticado = false;
let ativo = null;
let tela = { tipo: 'objetivos', retorno: null };
let efeitoXP = null;

function salvarSessao() {
  const conversas = [...sessoes].map(([id, { ocupada, modoIA, ...sessao }]) => {
    if (ocupada) {
      // Um turno interrompido volta como rascunho e pode ser enviado de novo.
      sessao.rascunho = sessao.mensagens.at(-1).texto;
      sessao.mensagens = sessao.mensagens.slice(0, -1);
    }
    return [id, sessao];
  });
  const dados = JSON.stringify({
    notas, ativo, tela, diagnosticado, conversas,
    respostas: [...respostasDiagnostico],
    avaliacao: avaliacao && { ...avaliacao, escolhas: [...avaliacao.escolhas] },
  });
  try {
    if (location.protocol === 'file:') {
      window.history.replaceState({ ...window.history.state, [chaveSessao]: dados }, '');
    } else {
      window.sessionStorage.setItem(chaveSessao, dados);
    }
    avisoSessao.hidden = true;
  } catch {
    avisoSessao.hidden = false;
  }
}

function restaurarSessao() {
  let dados;
  let conversas;
  let respostas;
  let diagnosticoEmAndamento;
  try {
    const salvo = location.protocol === 'file:' ? window.history.state?.[chaveSessao] : window.sessionStorage.getItem(chaveSessao);
    if (!salvo) return;
    dados = JSON.parse(salvo);
    if (dados?.notas?.length !== notas.length || !Array.isArray(dados.notas)
      || dados.notas.some((nota) => nota !== null && (!Number.isInteger(nota) || nota < 0 || nota > 100))
      || !Array.isArray(dados.conversas) || !Array.isArray(dados.respostas)) return;
    conversas = new Map(dados.conversas);
    respostas = new Map(dados.respostas);
    if (dados.avaliacao) {
      const { ids, atual, todos, escolhas } = dados.avaliacao;
      if (!Array.isArray(ids) || !Array.isArray(todos) || !Array.isArray(escolhas)
        || !Number.isInteger(atual) || !Dominio.conceitos[ids[atual] - 1]) return;
      diagnosticoEmAndamento = { ...dados.avaliacao, escolhas: new Map(escolhas) };
    }
  } catch {
    return;
  }
  notas.splice(0, notas.length, ...dados.notas);
  for (const [id, sessao] of conversas) {
    if (Dominio.conceitos[id - 1] && Array.isArray(sessao?.mensagens)) sessoes.set(id, sessao);
  }
  for (const [id, acertou] of respostas) respostasDiagnostico.set(id, acertou);
  diagnosticado = dados.diagnosticado === true;
  avaliacao = diagnosticoEmAndamento ?? null;
  if (dados.tela?.tipo === 'chat' && diagnosticado && sessoes.has(dados.ativo)) {
    ativo = dados.ativo;
    tela = { tipo: 'chat' };
  } else if (avaliacao) {
    tela = { tipo: 'diagnostico' };
  } else if (dados.tela?.tipo === 'resumo' && diagnosticado) {
    tela = dados.tela;
  } else if (dados.tela?.tipo === 'objetivos') {
    tela.retorno = sessoes.has(dados.tela.retorno) ? dados.tela.retorno : null;
  }
}

function mostrarTela(destino, ...conteudo) {
  tela = destino;
  atividade.replaceChildren(...conteudo);
  salvarSessao();
}

function elemento(tag, classe, texto) {
  const no = document.createElement(tag);
  if (classe) no.className = classe;
  if (texto) no.textContent = texto;
  return no;
}

function botao(texto, classe, acao) {
  const no = elemento('button', classe, texto);
  no.type = 'button';
  no.addEventListener('click', acao);
  return no;
}

function estrelas(quantidade) {
  const grupo = elemento('span', 'stars');
  grupo.setAttribute('role', 'img');
  grupo.setAttribute('aria-label', `${quantidade} de 3 estrelas`);
  for (let i = 0; i < 3; i += 1) {
    const estrela = elemento('span', i < quantidade ? 'star on' : 'star', '★');
    estrela.setAttribute('aria-hidden', 'true');
    grupo.append(estrela);
  }
  return grupo;
}

const estrelasDaNota = (nota) => nota >= 70 ? 3 : nota >= 50 ? 2 : nota >= 30 ? 1 : 0;
const rotuloFase = (id) => `Fase ${String(id).padStart(2, '0')}`;

function desenharLigacoes() {
  const largura = mapa.clientWidth;
  const altura = mapa.clientHeight;
  const escala = window.devicePixelRatio || 1;
  grafo.width = largura * escala;
  grafo.height = altura * escala;
  const ctx = grafo.getContext('2d');
  if (!ctx) return;
  const estilo = window.getComputedStyle(mapa);
  const corBase = estilo.getPropertyValue('--edge').trim();
  const corAtiva = estilo.getPropertyValue('--edge-active').trim();
  ctx.scale(escala, escala);
  ctx.lineCap = 'round';
  for (const conceito of Dominio.conceitos) {
    const fim = nos.get(conceito.id);
    for (const requisito of conceito.requisitos) {
      const inicio = nos.get(requisito);
      const x1 = inicio.offsetLeft + inicio.offsetWidth / 2;
      const y1 = inicio.offsetTop + inicio.offsetHeight;
      const x2 = fim.offsetLeft + fim.offsetWidth / 2;
      const y2 = fim.offsetTop - 5;
      const conquistado = notas[requisito] >= 70;
      const cor = conquistado || ativo === conceito.id ? corAtiva : corBase;
      ctx.strokeStyle = cor;
      ctx.fillStyle = cor;
      ctx.lineWidth = conquistado ? 2.25 : 1.5;
      ctx.setLineDash(conquistado ? [] : [3, 5]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      const linhas = conceito.linha - Dominio.conceitos[requisito - 1].linha;
      if (linhas > 1) {
        const direita = requisito === 2;
        const corredor = direita ? inicio.offsetLeft + inicio.offsetWidth + 8 : inicio.offsetLeft - 8;
        ctx.lineTo(x1, y1 + 7);
        ctx.lineTo(corredor, y1 + 7);
        ctx.lineTo(corredor, y2 - 7);
        ctx.lineTo(x2, y2 - 7);
        ctx.lineTo(x2, y2);
      } else {
        const meio = (y1 + y2) / 2;
        ctx.bezierCurveTo(x1, meio, x2, meio, x2, y2);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(x2, y2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

for (const conceito of Dominio.conceitos) {
  const no = botao('', 'node', () => selecionar(conceito.id));
  no.style.gridColumn = conceito.coluna + 1;
  no.style.gridRow = conceito.linha + 1;
  nos.set(conceito.id, no);
  mapa.append(no);
}
new ResizeObserver(desenharLigacoes).observe(mapa);

function atualizarMapa() {
  const total = notas.filter((nota) => nota >= 70).length;
  const quantidade = Dominio.conceitos.length;
  const xp = notas.reduce((soma, nota) => soma + (nota ?? 0), 0);
  const proxima = diagnosticado && !avaliacao ? Dominio.sugerir(notas)?.id : null;
  const indicador = document.querySelector('#mastered');
  indicador.hidden = !diagnosticado;
  indicador.textContent = `Nível ${total} · ${xp} XP`;
  document.querySelector('#trail-progress').hidden = !diagnosticado;
  document.querySelector('#trail-track').setAttribute('aria-valuenow', String(total));
  document.querySelector('#trail-track').setAttribute('aria-valuemax', String(quantidade));
  document.querySelector('#trail-fill').style.width = `${total / quantidade * 100}%`;
  document.querySelector('#trail-count').textContent = `${total}/${quantidade}`;
  menuDiagnostico.hidden = !diagnosticado;
  menuDiagnostico.disabled = Boolean(avaliacao);
  document.querySelector('#map-caption').textContent = avaliacao ? 'Conclua o diagnóstico para liberar a trilha.'
    : diagnosticado ? 'Escolha uma fase para praticar no chat.' : 'Escolha um objetivo para começar a trilha.';
  for (const { id, nome } of Dominio.conceitos) {
    const no = nos.get(id);
    const nota = notas[id];
    const estado = Dominio.estado(nota);
    const recomendada = proxima === id;
    const revisar = diagnosticado && nota === null && Dominio.pendentes(id, notas).length > 0;
    no.dataset.estado = estado;
    no.dataset.proxima = String(recomendada);
    no.disabled = !diagnosticado || Boolean(avaliacao);
    no.setAttribute('aria-pressed', String(ativo === id));
    no.setAttribute('aria-label', `${rotuloFase(id)}, ${nome}, ${Dominio.rotulos[estado]}${nota === null ? '' : `, ${nota} de 100`}${recomendada ? ', próxima sugerida' : ''}${revisar ? ', pré-requisitos a avaliar ou revisar' : ''}`);
    const topo = elemento('span', 'node-top');
    topo.append(elemento('span', 'node-id', rotuloFase(id)));
    if (nota !== null) topo.append(estrelas(estrelasDaNota(nota)));
    no.replaceChildren(topo, elemento('span', 'node-name', nome));
    if (estado === 'mastered' || revisar) {
      const marca = estado === 'mastered' ? elemento('span', 'node-badge medal', '🏆') : elemento('span', 'node-badge lock', '🔒');
      marca.setAttribute('aria-hidden', 'true');
      no.append(marca);
    }
    if (recomendada) no.append(elemento('span', 'next-tag', 'Próxima'));
  }
  desenharLigacoes();
}

function moverFoco() {
  atividade.querySelector('h2')?.focus({ preventScroll: true });
  if (window.matchMedia('(max-width: 900px)').matches) atividade.scrollIntoView({ block: 'start' });
}

menuDiagnostico.addEventListener('click', () => exibirObjetivos(ativo, true));

function exibirObjetivos(retorno = null, focar = false) {
  ativo = null;
  avaliacao = null;
  atualizarMapa();
  const cabecalho = elemento('div', 'panel-heading');
  const titulo = elemento('h2', '', 'O que você quer estudar?');
  titulo.tabIndex = -1;
  cabecalho.append(titulo);
  const corpo = elemento('div', 'quiz goals');
  corpo.append(elemento('p', '', 'Escolha um objetivo para avaliar os pré-requisitos antes de praticar.'));
  for (const { id, texto } of objetivos) {
    const restantes = Dominio.conceitos[id - 1].requisitos.filter((item) => !respostasDiagnostico.has(item)).length;
    const opcao = botao('', 'secondary goal', () => iniciarDiagnostico(id, retorno));
    opcao.append(elemento('span', '', texto), elemento('span', 'goal-count', restantes
      ? `${restantes} ${restantes === 1 ? 'questão' : 'questões'}` : 'Ir para o chat'));
    corpo.append(opcao);
  }
  const total = Dominio.conceitos.length;
  const restantes = total - respostasDiagnostico.size;
  let rotulo = `Diagnóstico completo · ${total} questões`;
  if (restantes === 0) rotulo = 'Ver resultado do diagnóstico completo';
  else if (restantes < total) rotulo = `Completar diagnóstico · ${restantes} ${restantes === 1 ? 'questão restante' : 'questões restantes'}`;
  corpo.append(botao(rotulo, 'secondary', () => iniciarDiagnostico(null, retorno)));
  if (retorno !== null) corpo.append(botao('Voltar ao chat', 'text-button', () => selecionar(retorno)));
  mostrarTela({ tipo: 'objetivos', retorno }, cabecalho, corpo);
  if (focar) moverFoco();
}

function iniciarDiagnostico(objetivo, retorno = null) {
  const todos = objetivo === null ? Dominio.conceitos.map(({ id }) => id) : Dominio.conceitos[objetivo - 1].requisitos.toSorted((a, b) => a - b);
  const ids = todos.filter((id) => !respostasDiagnostico.has(id));
  if (objetivo !== null && !ids.length) {
    selecionar(objetivo);
    return;
  }
  ativo = null;
  avaliacao = { objetivo, retorno, todos, ids, atual: 0, escolhas: new Map() };
  atualizarMapa();
  if (ids.length) exibirDiagnostico(true);
  else concluirDiagnostico();
}

function exibirDiagnostico(focar = false) {
  const { objetivo, retorno, ids, atual, escolhas } = avaliacao;
  const id = ids[atual];
  const [enunciado, opcoes] = Dominio.diagnostico[id - 1];
  const cabecalho = elemento('div', 'panel-heading');
  const titulo = elemento('h2', '', objetivo === null ? 'Diagnóstico completo' : 'Diagnóstico por objetivo');
  titulo.tabIndex = -1;
  cabecalho.append(titulo, elemento('span', 'pill', `${atual + 1} de ${ids.length}`));
  const formulario = elemento('form', 'quiz');
  const barra = elemento('progress', 'progress');
  barra.max = ids.length;
  barra.value = escolhas.size;
  barra.setAttribute('aria-label', 'Questões respondidas');
  const grupo = elemento('fieldset', 'options');
  grupo.append(elemento('legend', 'question', enunciado));
  const controles = elemento('div', 'quiz-actions');
  const avancar = elemento('button', 'primary', atual === ids.length - 1 ? 'Concluir diagnóstico' : 'Próxima questão');
  avancar.type = 'submit';
  avancar.disabled = !escolhas.has(id);
  opcoes.forEach((opcao, i) => {
    const label = elemento('label', 'option');
    const radio = elemento('input');
    radio.type = 'radio';
    radio.name = 'resposta';
    radio.checked = escolhas.get(id) === i;
    radio.addEventListener('change', () => {
      escolhas.set(id, i);
      barra.value = escolhas.size;
      avancar.disabled = false;
      salvarSessao();
    });
    label.append(radio, elemento('span', '', opcao));
    grupo.append(label);
  });
  const voltar = atual === 0
    ? botao('Voltar aos objetivos', 'secondary', () => exibirObjetivos(retorno, true))
    : botao('Voltar', 'secondary', () => {
      avaliacao.atual -= 1;
      exibirDiagnostico(true);
    });
  controles.append(voltar, avancar);
  formulario.append(barra, elemento('p', 'eyebrow', Dominio.conceitos[id - 1].nome), grupo, controles);
  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    if (!escolhas.has(id)) return;
    if (atual < ids.length - 1) {
      avaliacao.atual += 1;
      exibirDiagnostico(true);
      return;
    }
    concluirDiagnostico();
  });
  mostrarTela({ tipo: 'diagnostico' }, cabecalho, formulario);
  if (focar) moverFoco();
}

function concluirDiagnostico() {
  const { objetivo, todos, escolhas, retorno } = avaliacao;
  for (const [id, escolha] of escolhas) {
    const acertou = escolha === Dominio.diagnostico[id - 1][2];
    respostasDiagnostico.set(id, acertou);
    const resultado = acertou ? Dominio.pontuar(0, 'diagnostico') : 0;
    notas[id] = Math.max(notas[id] ?? 0, resultado);
  }
  const acertos = todos.filter((id) => respostasDiagnostico.get(id)).length;
  avaliacao = null;
  diagnosticado = true;
  atualizarMapa();
  exibirResumo(objetivo, acertos, todos.length, retorno);
}

function exibirResumo(objetivo, acertos, total, retorno) {
  const recomendado = objetivo === null ? Dominio.sugerir(notas) : Dominio.conceitos[objetivo - 1];
  const topo = elemento('div', 'panel-heading');
  const titulo = elemento('h2', '', 'Diagnóstico concluído');
  titulo.tabIndex = -1;
  topo.append(titulo);
  const corpo = elemento('div', 'summary');
  corpo.append(
    elemento('p', 'eyebrow', 'Resultado do diagnóstico'),
    elemento('p', 'result', `${acertos} de ${total}`),
    estrelas(total ? Math.round(acertos / total * 3) : 0),
    elemento('p', '', 'Cada acerto no diagnóstico deixa o conceito com pelo menos 50 pontos. O mapa mostra quais conceitos já foram avaliados.')
  );
  if (recomendado) corpo.append(botao(`Praticar ${recomendado.nome.toLowerCase()}`, 'primary', () => selecionar(recomendado.id)));
  if (objetivo === null && !Dominio.pendentes(9, notas).length) {
    corpo.append(botao('Abrir desafio de juros compostos', 'secondary', () => selecionar(9)));
  }
  if (retorno !== null && retorno !== recomendado?.id) {
    corpo.append(botao('Voltar ao chat', 'text-button', () => selecionar(retorno)));
  }
  mostrarTela({ tipo: 'resumo', objetivo, acertos, total, retorno }, topo, corpo);
  moverFoco();
}

function registrar(sessao, texto, autor = 'tutor') {
  sessao.mensagens.push({ autor, texto });
}

function selecionar(id) {
  if (!diagnosticado || avaliacao) return;
  ativo = id;
  if (!sessoes.has(id)) sessoes.set(id, { fase: 'inicio', mensagens: [] });
  const sessao = sessoes.get(id);
  if (sessao.fase === 'inicio' || sessao.fase === 'revisao') {
    const pendentes = Dominio.pendentes(id, notas);
    sessao.mensagens.length = 0;
    if (pendentes.length) {
      sessao.fase = 'revisao';
      const listar = (ids) => ids.map((item) => Dominio.conceitos[item - 1].nome.toLowerCase()).join(', ');
      const desconhecidos = pendentes.filter((item) => notas[item] === null);
      const revisar = pendentes.filter((item) => notas[item] !== null);
      if (desconhecidos.length) registrar(sessao, `Você ainda pode avaliar ${listar(desconhecidos)}.`);
      if (revisar.length) registrar(sessao, `Antes de continuar, sugiro revisar ${listar(revisar)}.`);
      registrar(sessao, 'Você também pode tentar este conceito agora.');
    } else {
      iniciarConceito(sessao);
    }
  }
  atualizarMapa();
  exibirChat(true);
}

function iniciarConceito(sessao) {
  if (ativo === 9 && !sessao.desafioFeito) {
    sessao.fase = 'exploracao';
    sessao.tentativas = [];
    sessao.dicaDesafio = false;
    registrar(sessao, Dominio.desafio.enunciado);
    return;
  }
  iniciarPratica(sessao);
}

function iniciarPratica(sessao) {
  const quantidade = Dominio.totalVariantes(ativo);
  if (!sessao.variantesRestantes?.length) {
    sessao.variantesRestantes = Array.from({ length: quantidade }, (_, variante) => variante);
  }
  const sorteada = Dominio.sortearVariante(sessao.variantesRestantes, sessao.ultimaVariante);
  sessao.variantesRestantes = sessao.variantesRestantes.filter((variante) => variante !== sorteada);
  sessao.ultimaVariante = sorteada;
  sessao.problema = Dominio.problema(ativo, () => sorteada / quantidade);
  sessao.fase = 'pratica';
  sessao.tentativasPratica = 0;
  sessao.ajuda = false;
  sessao.revisaoSugerida = null;
  sessao.escolhaComparacao = null;
  const transferencia = ativo === 9 && sessao.checarTransferencia;
  if (transferencia) sessao.checarTransferencia = false;
  const convite = transferencia ? 'Agora teste a ideia em outra situação. ' : '';
  const complemento = transferencia && sessao.problema.formato !== 'comparacao'
    ? ' Se quiser, diga também sobre qual saldo incidem os juros de cada mês.' : '';
  registrar(sessao, convite + sessao.problema.enunciado + complemento);
}

function consolidar(sessao) {
  sessao.fase = 'consolidacao';
  sessao.desafioFeito = true;
  sessao.checarTransferencia = true;
  const tipos = sessao.tentativas.map(({ tipo }) => tipo);
  let conexao = 'Uma forma de começar é anotar o saldo ao fim de cada mês e usá-lo como base para o próximo.';
  if (tipos.includes('fixo')) {
    conexao = 'Na sua tentativa, tratar o acréscimo como fixo funciona para a primeira aplicação e explica o empate no primeiro mês. Na segunda, precisamos aplicar a taxa ao saldo atualizado a cada mês.';
    if (tipos.includes('intermediario') || tipos.includes('variavel')) {
      conexao += ' Na tentativa seguinte, você já considerou o efeito dessa mudança.';
    }
  } else if (tipos.includes('variavel')) {
    conexao = 'Sua tentativa apontou para o saldo maior da segunda aplicação ou para a mudança de base. Vamos conferir os saldos e transformar esse raciocínio em uma regra geral.';
  } else if (tipos.includes('intermediario')) {
    conexao = 'O valor que você encontrou para o segundo mês já mostra como o saldo atualizado altera os juros. Podemos repetir esse passo.';
  } else if (sessao.tentativas.length) {
    const tentativa = sessao.tentativas.at(-1).texto;
    const trecho = tentativa.length > 160 ? `${tentativa.slice(0, 157)}…` : tentativa;
    conexao = `Você tentou “${trecho}”. Vamos conferir sua ideia acompanhando quanto se acrescenta ao saldo em cada aplicação, mês a mês.`;
  }
  registrar(sessao, `${conexao}\n\n${Dominio.desafio.consolida}\n\n${Dominio.desafio.formaliza}`);
}

const orientacoesC9 = {
  fixo: 'O acréscimo de R$ 100 explica o empate no primeiro mês. No segundo mês, a segunda aplicação começa com R$ 1.100. Quanto é 10% desse saldo?',
  variavel: 'Você percebeu que a base muda. Que saldo a segunda aplicação teria no fim de cada mês?',
  intermediario: 'Você avançou em uma parte da conta. Que saldo começa o mês seguinte e qual seria o acréscimo?',
  palpite: 'Vamos conferir sua previsão. Como você calculou o saldo da aplicação que rende uma porcentagem todo mês?',
  tentativa: 'Vamos olhar só para o segundo mês. As duas aplicações começam com R$ 1.100. Que acréscimo cada uma recebe?',
  saldo: 'Saldo é o dinheiro que há na aplicação em determinado momento. Ele inclui o valor inicial e os juros acumulados até ali. Em qual mês você quer começar a conta?',
  taxa: 'A taxa indica a porcentagem aplicada em cada período. Por exemplo, 10% representa 10 de cada 100, ou 0,10. Sobre qual valor você aplicaria a taxa?',
  prazo: 'O prazo diz por quanto tempo o dinheiro fica aplicado. Com taxa ao mês, cada mês é um período. Quantas vezes a taxa deve ser aplicada neste problema?',
  compostos: 'Em juros compostos, os juros de um período entram no saldo usado no período seguinte. Que valor seria a base do segundo mês?',
  duvida: 'Qual parte da conta você quer conferir primeiro: o saldo inicial, a taxa ou o número de meses?',
  ambigua: 'Pode me contar um pouco mais? Diga qual saldo você está calculando e como começaria.',
  fora: 'Vamos voltar ao exercício de juros compostos. Em qual parte dele você quer ajuda?',
};
const tiposTentativa = new Set(['tentativa', 'metodo', 'equivoco', 'fixo', 'variavel', 'intermediario', 'palpite']);

function orientar(sessao, id, tipo) {
  if (tipo === 'ajuda') {
    pedirDica(sessao);
    return;
  }
  if (tipo === 'conceito' || tipo === 'procedimento') {
    if (tipo === 'procedimento' && sessao.fase === 'pratica') {
      pedirDica(sessao);
    } else {
      registrar(sessao, Dominio.explicarConceito(id));
      if (sessao.fase === 'pratica') sessao.ajuda = true;
    }
    return;
  }
  if (id === 9 && orientacoesC9[tipo]) {
    registrar(sessao, orientacoesC9[tipo]);
    if (sessao.fase === 'pratica' && ['saldo', 'taxa', 'prazo', 'compostos'].includes(tipo)) sessao.ajuda = true;
    return;
  }
  const texto = tipo === 'fora' ? 'Vamos voltar ao exercício. Qual parte dele você quer conferir?'
    : 'Pode dizer qual parte do exercício você quer entender ou como começaria a conta?';
  registrar(sessao, texto);
}

function pedirDica(sessao) {
  if (sessao.fase === 'exploracao') {
    sessao.dicaDesafio = true;
    registrar(sessao, 'Comece pelo segundo mês. Anote os dois saldos iniciais e aplique a regra de acréscimo de cada aplicação.');
  } else {
    sessao.ajuda = true;
    registrar(sessao, sessao.problema.dica);
  }
}

function explorar(sessao, texto, tipo) {
  if (!tiposTentativa.has(tipo)) {
    orientar(sessao, 9, tipo);
    return;
  }
  sessao.tentativas.push({ texto, tipo });
  const respostaJustificada = tipo === 'variavel' && Dominio.numerosNoTexto(texto).includes(1331);
  if (respostaJustificada || sessao.tentativas.length >= 2) {
    consolidar(sessao);
    return;
  }
  registrar(sessao, orientacoesC9[tipo] || orientacoesC9.tentativa);
  sessao.dicaDesafio = true;
}

function encerrarPratica(sessao, id) {
  sessao.fase = 'finalizada';
  if (notas[id] >= 70) {
    const recomendado = Dominio.sugerir(notas, id);
    registrar(sessao, recomendado
      ? `Você atingiu o domínio deste conceito. Sugestão para continuar: ${recomendado.nome}.`
      : 'Você atingiu o domínio deste conceito. Confira o mapa para escolher o que revisar.');
  }
}

function pontuar(id, evento) {
  const anterior = notas[id] ?? 0;
  notas[id] = Dominio.pontuar(notas[id], evento);
  const variacao = (notas[id] ?? 0) - anterior;
  if (ativo === id && variacao) {
    efeitoXP = { id, variacao, dominou: anterior < 70 && notas[id] >= 70 };
  }
  atualizarMapa();
}

function lerResposta(texto) {
  const direto = Dominio.lerNumero(texto);
  if (direto !== null) return direto;
  const frase = texto.match(/(?:^|\s)(?:R\$\s*)?([+-]?\d+(?:[.,]\d+)*)\s*(%|reais)?(?=$|[\s.!?,;])/gi) || [];
  if (frase.length === 1) return Dominio.lerNumero(frase[0].replace(/\s+reais$/i, ''));
  const finais = [...texto.matchAll(/\b(?:custo final|saldo final|resultado final|valor final|resposta final|montante)\s*(?:é|foi|deu|fica em|ficou em|[:=])\s*((?:R\$\s*)?[+-]?\d+(?:[.,]\d+)*\s*%?)/gi)];
  return finais.length === 1 ? Dominio.lerNumero(finais[0][1]) : null;
}

function responderPratica(sessao, texto, id, tipo) {
  if (sessao.problema.formato === 'comparacao') {
    responderComparacao(sessao, texto, id, tipo);
    return;
  }
  if (tipo && !tiposTentativa.has(tipo)) {
    orientar(sessao, id, tipo);
    return;
  }
  const valor = lerResposta(texto);
  const reconheceuMetodo = tipo === 'variavel' || tipo === 'metodo';
  const revisarMetodo = tipo === 'fixo' || tipo === 'equivoco';
  if (valor === null) {
    let comentario = reconheceuMetodo ? 'Seu raciocínio está no caminho certo. ' : '';
    if (revisarMetodo) {
      sessao.ajuda = true;
      comentario = `${Dominio.explicarConceito(id)} `;
    }
    registrar(sessao, comentario + 'Para eu conferir, envie um único valor como resposta. Você pode acompanhá-lo de uma explicação sem outros números.');
    return;
  }
  const correto = Dominio.confere(valor, sessao.problema.resposta);
  const erro = correto ? null : Dominio.identificarErro(sessao.problema, valor);
  corrigirPratica(sessao, id, { correto, erro, reconheceuMetodo, revisarMetodo });
}

function responderComparacao(sessao, texto, id, tipo) {
  const { escolha, motivo } = Dominio.lerComparacao(texto);
  if (escolha) sessao.escolhaComparacao = escolha;
  if (!escolha && !motivo && tipo && !tiposTentativa.has(tipo) && tipo !== 'ambigua') {
    orientar(sessao, id, tipo);
    return;
  }
  if (!sessao.escolhaComparacao || !motivo) {
    const retorno = sessao.escolhaComparacao
      ? `Você indicou a conta ${sessao.escolhaComparacao}. Para conferir, explique o que acontece com o saldo ou com o fator de um mês para o outro.`
      : 'Indique a conta A ou B e explique o que acontece de um mês para o outro.';
    registrar(sessao, retorno);
    return;
  }
  const correto = sessao.escolhaComparacao === sessao.problema.resposta && motivo === 'composto';
  sessao.escolhaComparacao = null;
  corrigirPratica(sessao, id, {
    correto,
    erro: correto ? null : { dica: sessao.problema.dica },
    reconheceuMetodo: correto,
  });
}

function corrigirPratica(sessao, id, { correto, erro, reconheceuMetodo, revisarMetodo }) {
  sessao.tentativasPratica += 1;
  const { dica, resolucao } = sessao.problema;
  if (correto) {
    sessao.revisaoSugerida = null;
    pontuar(id, sessao.ajuda ? 'comDica' : 'independente');
    const comentario = reconheceuMetodo ? 'Correto! Seu raciocínio também está no caminho certo. '
      : revisarMetodo ? `O valor está correto. Confira o procedimento. ${Dominio.explicarConceito(id)} ` : 'Correto! ';
    registrar(sessao, comentario + resolucao);
    encerrarPratica(sessao, id);
    return;
  }

  if (erro?.revisao) sessao.revisaoSugerida = erro.revisao;
  if (sessao.ajuda) {
    pontuar(id, 'erroComDica');
    const retorno = erro ? `${erro.dica}\n\n` : '';
    registrar(sessao, `${retorno}Vamos conferir a resolução. ${resolucao}`);
    encerrarPratica(sessao, id);
  } else {
    pontuar(id, 'erroInicial');
    sessao.ajuda = true;
    const retorno = reconheceuMetodo ? 'O procedimento faz sentido. Vamos conferir a conta. '
        : 'Esse valor ficou diferente do gabarito. ';
    registrar(sessao, erro?.dica || retorno + dica);
  }
}

async function interpretarMensagem(sessao, id, mensagem, ultimaFalaTutor) {
  const fase = sessao.fase;
  const local = { tipo: Dominio.interpretarLocal(id, mensagem, fase) };
  try {
    const resposta = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(7500),
      body: JSON.stringify({
        id, fase, mensagem, ultimaFalaTutor,
        enunciado: fase === 'exploracao' ? Dominio.desafio.enunciado : sessao.problema.enunciado,
      }),
    });
    if (resposta.status === 204 || resposta.status === 404 || resposta.status === 405) servidorSemIA = true;
    if (resposta.status !== 200) {
      sessao.modoIA = servidorSemIA ? 'local' : 'indisponivel';
      return local;
    }
    const { tipo, retomada } = await resposta.json();
    if (Dominio.tiposChat(id).includes(tipo)) {
      sessao.modoIA = 'modelo';
      return { tipo, retomada: typeof retomada === 'string' ? retomada : null };
    }
  } catch {
    // Uma falha de rede não interrompe o exercício.
  }
  sessao.modoIA = 'indisponivel';
  return local;
}

async function enviarMensagem(sessao, texto, id) {
  if (sessao.ocupada || !['exploracao', 'pratica'].includes(sessao.fase)) return;
  sessao.rascunho = '';
  const ultimaFalaTutor = sessao.mensagens.findLast(({ autor }) => autor === 'tutor')?.texto || '';
  registrar(sessao, texto, 'aluno');
  if (sessao.fase === 'pratica' && (Dominio.lerNumero(texto) !== null
    || (sessao.problema.formato === 'comparacao' && /^[ab]$/i.test(texto)))) {
    responderPratica(sessao, texto, id);
    if (ativo === id) exibirChat(false, true);
    else salvarSessao();
    return;
  }
  let interpretacao;
  if (podeConsultarGemini && !servidorSemIA) {
    sessao.ocupada = true;
    if (ativo === id) exibirChat();
    else salvarSessao();
    interpretacao = await interpretarMensagem(sessao, id, texto, ultimaFalaTutor.slice(0, 650));
    sessao.ocupada = false;
  } else {
    interpretacao = { tipo: Dominio.interpretarLocal(id, texto, sessao.fase) };
  }
  const { tipo, retomada } = interpretacao;
  const indiceDevolutiva = sessao.mensagens.length;
  if (sessao.fase === 'exploracao') explorar(sessao, texto, tipo);
  else responderPratica(sessao, texto, id, tipo);
  const devolutiva = sessao.mensagens[indiceDevolutiva];
  if (retomada && devolutiva?.autor === 'tutor') {
    devolutiva.texto = `${retomada}\n\n${devolutiva.texto}`;
  }
  if (ativo === id) exibirChat(false, true);
  else salvarSessao();
}

function exibirChat(focar = false, focarCaixa = false) {
  const conceito = Dominio.conceitos[ativo - 1];
  const sessao = sessoes.get(ativo);
  const heading = elemento('div', 'panel-heading');
  const nomes = elemento('div');
  const titulo = elemento('h2', '', 'Tutor de matemática');
  titulo.tabIndex = -1;
  nomes.append(titulo, elemento('p', '', `${rotuloFase(ativo)} · ${conceito.nome}`));
  heading.append(nomes);
  if (ativo === 9 && sessao.fase === 'exploracao') {
    heading.append(elemento('span', 'pill', 'Desafio produtivo'));
  } else if (ativo === 9 && sessao.fase === 'consolidacao') {
    heading.append(elemento('span', 'pill', 'Consolidação'));
  }
  const faixa = elemento('div', 'score');
  faixa.append(elemento('span', '', 'XP da fase'));
  if (notas[ativo] === null) {
    faixa.append(elemento('strong', '', 'Não avaliado'));
  } else {
    const indicador = elemento('progress', 'progress');
    indicador.max = 100;
    indicador.value = notas[ativo];
    indicador.setAttribute('aria-label', 'Domínio no conceito');
    faixa.append(indicador, elemento('strong', '', `${notas[ativo]}/100`), estrelas(estrelasDaNota(notas[ativo])));
  }
  const conteudo = [heading, faixa];
  if (efeitoXP?.id === ativo) {
    const { variacao, dominou } = efeitoXP;
    const ganho = elemento('span', variacao > 0 ? 'xp-gain' : 'xp-gain loss', `${variacao > 0 ? '+' : ''}${variacao} XP`);
    ganho.setAttribute('aria-hidden', 'true');
    faixa.append(ganho);
    if (dominou) {
      const festa = elemento('div', 'level-up');
      const medalha = elemento('span', 'level-medal', '🏆');
      const particulas = elemento('span', 'burst');
      festa.setAttribute('role', 'status');
      medalha.setAttribute('aria-hidden', 'true');
      particulas.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 8; i += 1) {
        const particula = elemento('i');
        particula.style.setProperty('--i', i);
        particulas.append(particula);
      }
      festa.append(medalha, elemento('span', '', 'Fase concluída! Você ganhou 3 estrelas.'), particulas);
      conteudo.push(festa);
    }
  }
  efeitoXP = null;
  const historico = elemento('div', 'history');
  historico.tabIndex = 0;
  historico.setAttribute('role', 'log');
  historico.setAttribute('aria-label', 'Conversa com o tutor');
  for (const { autor, texto } of sessao.mensagens) {
    const mensagem = elemento('div', `message ${autor}`);
    mensagem.append(elemento('span', 'message-author', autor === 'tutor' ? 'Tutor' : 'Você'), elemento('p', '', texto));
    historico.append(mensagem);
  }
  const rodape = elemento('div', 'chat-footer');
  const acoes = elemento('div', 'chat-actions');
  const refresh = (acao) => () => {
    acao();
    exibirChat(false, true);
  };
  let caixa;
  if (sessao.fase === 'exploracao' || sessao.fase === 'pratica') {
    const formulario = elemento('form', 'composer');
    caixa = elemento('textarea', 'composer-input');
    caixa.rows = 2;
    caixa.maxLength = 600;
    caixa.required = true;
    caixa.value = sessao.rascunho || '';
    caixa.addEventListener('input', () => { sessao.rascunho = caixa.value; });
    caixa.placeholder = sessao.fase === 'exploracao' ? 'Conte como você pensou…'
      : sessao.problema.formato === 'comparacao' ? 'Escolha A ou B e explique…' : 'Digite sua resposta…';
    caixa.setAttribute('aria-label', caixa.placeholder);
    const enviar = elemento('button', 'primary', 'Enviar');
    enviar.type = 'submit';
    formulario.append(caixa, enviar);
    formulario.addEventListener('submit', (evento) => {
      evento.preventDefault();
      const texto = caixa.value.trim();
      if (!texto) return;
      void enviarMensagem(sessao, texto, conceito.id);
    });
    caixa.addEventListener('keydown', (evento) => {
      if (evento.key === 'Enter' && !evento.shiftKey && !evento.isComposing) {
        evento.preventDefault();
        formulario.requestSubmit();
      }
    });
    caixa.disabled = enviar.disabled = Boolean(sessao.ocupada);
    const ajuda = botao('Pedir ajuda', 'secondary small', refresh(() => pedirDica(sessao)));
    ajuda.disabled = sessao.ocupada || (sessao.fase === 'exploracao' ? sessao.dicaDesafio : sessao.ajuda);
    const emDesafio = sessao.fase === 'exploracao';
    const resolver = botao(emDesafio ? 'Ver explicação' : 'Ver resolução', 'text-button', refresh(() => {
      if (emDesafio) consolidar(sessao);
      else {
        if (!sessao.tentativasPratica) pontuar(conceito.id, 'revelacaoPrecoce');
        registrar(sessao, sessao.problema.resolucao);
        encerrarPratica(sessao, conceito.id);
      }
    }));
    resolver.disabled = Boolean(sessao.ocupada);
    acoes.append(ajuda, resolver);
    rodape.append(formulario, acoes);
  } else if (sessao.fase === 'revisao') {
    const pendentes = Dominio.pendentes(conceito.id, notas);
    const primeiroAvaliado = pendentes.find((id) => notas[id] !== null);
    if (pendentes.some((id) => notas[id] === null)) {
      acoes.append(botao('Avaliar pré-requisitos', 'primary', () => iniciarDiagnostico(conceito.id, conceito.id)));
    }
    if (primeiroAvaliado) {
      acoes.append(botao(`Revisar C${primeiroAvaliado}`, acoes.hasChildNodes() ? 'secondary' : 'primary', () => selecionar(primeiroAvaliado)));
    }
    acoes.append(
      botao('Tentar mesmo assim', 'secondary', refresh(() => iniciarConceito(sessao)))
    );
  } else {
    const consolidado = sessao.fase === 'consolidacao';
    const recomendado = Dominio.sugerir(notas, ativo);
    acoes.append(botao(consolidado ? 'Praticar com outro exemplo' : 'Novo exercício', 'primary', refresh(() => iniciarPratica(sessao))));
    if (!consolidado && notas[ativo] >= 70 && recomendado) {
      acoes.append(botao(`Próximo: ${recomendado.nome}`, 'secondary', () => selecionar(recomendado.id)));
    }
  }
  if (sessao.revisaoSugerida && !sessao.ocupada) {
    const { id, nome } = Dominio.conceitos[sessao.revisaoSugerida - 1];
    acoes.append(botao(`Revisar C${id} · ${nome}`, 'secondary', () => selecionar(id)));
  }
  if (!rodape.hasChildNodes()) rodape.append(acoes);
  if (podeConsultarGemini) {
    const status = sessao.ocupada ? 'Interpretando sua mensagem…'
      : sessao.modoIA === 'modelo' ? 'Última interpretação feita com Gemini.'
        : sessao.modoIA === 'indisponivel' ? 'Gemini indisponível. O tutor usou a interpretação local.'
          : servidorSemIA ? 'Interpretação local.'
            : 'Se a IA estiver configurada, as mensagens em texto livre são enviadas ao Gemini.';
    const aviso = elemento('p', 'chat-status', status);
    aviso.setAttribute('role', 'status');
    rodape.append(aviso);
  }
  mostrarTela({ tipo: 'chat' }, ...conteudo, historico, rodape);
  historico.scrollTop = historico.scrollHeight;
  if (focar) moverFoco();
  if (focarCaixa) (caixa || acoes.querySelector('button'))?.focus({ preventScroll: true });
}

restaurarSessao();
window.addEventListener('pagehide', salvarSessao);
if (tela.tipo === 'objetivos') {
  exibirObjetivos(tela.retorno);
} else {
  atualizarMapa();
  if (tela.tipo === 'chat') exibirChat();
  else if (tela.tipo === 'diagnostico') exibirDiagnostico();
  else exibirResumo(tela.objetivo, tela.acertos, tela.total, tela.retorno);
}
