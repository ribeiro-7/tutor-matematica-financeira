'use strict';

const atividade = document.querySelector('#activity');
const mapa = document.querySelector('#map');
const grafo = document.querySelector('#edges');
const notas = Array(15).fill(0);
const respostas = Array(14).fill(null);
const sessoes = new Map();
const nos = new Map();
const podeConsultarGemini = location.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(location.hostname);
let servidorSemIA = false;
let questao = 0;
let diagnosticado = false;
let ativo = null;

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

function desenharLigacoes() {
  const largura = mapa.clientWidth;
  const altura = mapa.clientHeight;
  const escala = window.devicePixelRatio || 1;
  grafo.width = largura * escala;
  grafo.height = altura * escala;
  const ctx = grafo.getContext('2d');
  ctx.scale(escala, escala);
  ctx.lineWidth = 1.25;
  for (const conceito of Dominio.conceitos) {
    const fim = nos.get(conceito.id);
    for (const requisito of conceito.requisitos) {
      const inicio = nos.get(requisito);
      const x1 = inicio.offsetLeft + inicio.offsetWidth / 2;
      const y1 = inicio.offsetTop + inicio.offsetHeight;
      const x2 = fim.offsetLeft + fim.offsetWidth / 2;
      const y2 = fim.offsetTop - 4;
      const destacado = ativo === conceito.id;
      const cor = destacado ? '#34775e' : '#aabbbc';
      ctx.strokeStyle = cor;
      ctx.fillStyle = cor;
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
      ctx.beginPath();
      ctx.moveTo(x2 - 3, y2 - 2);
      ctx.lineTo(x2 + 3, y2 - 2);
      ctx.lineTo(x2, y2 + 3);
      ctx.fill();
    }
  }
}

for (const conceito of Dominio.conceitos) {
  const no = botao('', 'node', () => selecionar(conceito.id));
  no.append(elemento('span', 'node-id', `C${conceito.id}`), elemento('span', 'node-name', conceito.nome));
  no.style.gridColumn = conceito.coluna + 1;
  no.style.gridRow = conceito.linha + 1;
  nos.set(conceito.id, no);
  mapa.append(no);
}
new ResizeObserver(desenharLigacoes).observe(mapa);

function atualizarMapa() {
  const total = notas.filter((nota) => nota >= 70).length;
  const indicador = document.querySelector('#mastered');
  indicador.hidden = !diagnosticado;
  indicador.textContent = `${total}/14 dominados`;
  document.querySelector('#map-caption').textContent = diagnosticado
    ? 'Selecione um conceito para praticar no chat.'
    : 'Faça o diagnóstico para descobrir por onde começar.';
  for (const { id, nome } of Dominio.conceitos) {
    const no = nos.get(id);
    const estado = Dominio.estado(notas[id]);
    no.dataset.estado = estado;
    no.disabled = !diagnosticado;
    no.setAttribute('aria-pressed', String(ativo === id));
    no.setAttribute('aria-label', `C${id}, ${nome}, ${Dominio.rotulos[estado]}${diagnosticado ? `, ${notas[id]} de 100` : ''}`);
  }
  desenharLigacoes();
}

function moverFoco() {
  atividade.querySelector('h2')?.focus({ preventScroll: true });
}

function exibirDiagnostico(focar = false) {
  const [enunciado, opcoes] = Dominio.diagnostico[questao];
  atividade.replaceChildren();
  const cabecalho = elemento('div', 'panel-heading');
  const titulo = elemento('h2', '', 'Diagnóstico inicial');
  titulo.tabIndex = -1;
  cabecalho.append(titulo, elemento('span', 'pill', `${questao + 1} de ${respostas.length}`));
  const formulario = elemento('form', 'quiz');
  const barra = elemento('progress', 'progress');
  barra.max = respostas.length;
  barra.value = respostas.filter((resposta) => resposta !== null).length;
  barra.setAttribute('aria-label', 'Questões respondidas');
  const grupo = elemento('fieldset', 'options');
  grupo.append(elemento('legend', 'question', enunciado));
  const controles = elemento('div', 'quiz-actions');
  const avancar = elemento('button', 'primary', questao === respostas.length - 1 ? 'Concluir diagnóstico' : 'Próxima questão');
  avancar.type = 'submit';
  avancar.disabled = respostas[questao] === null;
  opcoes.forEach((opcao, i) => {
    const label = elemento('label', 'option');
    const radio = elemento('input');
    radio.type = 'radio';
    radio.name = 'resposta';
    radio.checked = respostas[questao] === i;
    radio.addEventListener('change', () => {
      respostas[questao] = i;
      barra.value = respostas.filter((resposta) => resposta !== null).length;
      avancar.disabled = false;
    });
    label.append(radio, elemento('span', '', opcao));
    grupo.append(label);
  });
  const voltar = botao('Voltar', 'secondary', () => {
    questao -= 1;
    exibirDiagnostico(true);
  });
  voltar.disabled = questao === 0;
  controles.append(voltar, avancar);
  formulario.append(barra, elemento('p', 'eyebrow', Dominio.conceitos[questao].nome), grupo, controles);
  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    if (respostas[questao] === null) return;
    if (questao < respostas.length - 1) {
      questao += 1;
      exibirDiagnostico(true);
      return;
    }
    const acertos = respostas.reduce((total, valor, i) => {
      if (valor !== Dominio.diagnostico[i][2]) return total;
      notas[i + 1] = Dominio.pontuar(0, 'diagnostico');
      return total + 1;
    }, 0);
    diagnosticado = true;
    atualizarMapa();
    exibirResumo(acertos);
  });
  atividade.append(cabecalho, formulario);
  if (focar) moverFoco();
}

function exibirResumo(acertos) {
  const recomendado = Dominio.sugerir(notas);
  const topo = elemento('div', 'panel-heading');
  const titulo = elemento('h2', '', 'Diagnóstico concluído');
  titulo.tabIndex = -1;
  topo.append(titulo);
  const corpo = elemento('div', 'summary');
  corpo.append(
    elemento('p', 'result', `${acertos} de 14`),
    elemento('p', '', 'As questões acertadas começam com 50 pontos no mapa. A prática no chat atualiza o domínio de cada conceito.'),
    botao(`Praticar ${recomendado.nome.toLowerCase()}`, 'primary', () => selecionar(recomendado.id))
  );
  if (!Dominio.pendentes(9, notas).length) {
    corpo.append(botao('Abrir desafio de juros compostos', 'secondary', () => selecionar(9)));
  }
  atividade.replaceChildren(topo, corpo);
  moverFoco();
}

function registrar(sessao, texto, autor = 'tutor') {
  sessao.mensagens.push({ autor, texto });
}

function selecionar(id) {
  if (!diagnosticado) return;
  ativo = id;
  if (!sessoes.has(id)) sessoes.set(id, { fase: 'inicio', mensagens: [] });
  const sessao = sessoes.get(id);
  if (sessao.fase === 'inicio') {
    const pendentes = Dominio.pendentes(id, notas);
    if (pendentes.length) {
      sessao.fase = 'revisao';
      registrar(sessao, `Antes de continuar, sugiro revisar ${pendentes.map((item) => Dominio.conceitos[item - 1].nome.toLowerCase()).join(', ')}. Você também pode tentar este conceito agora.`);
    } else {
      iniciarConceito(sessao);
    }
  } else if (sessao.fase === 'revisao' && !Dominio.pendentes(id, notas).length) {
    iniciarConceito(sessao);
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
  const anterior = sessao.problema?.enunciado;
  const inicio = Math.floor(Math.random() * 4);
  for (let passo = 0; passo < 4; passo += 1) {
    const novo = Dominio.problema(ativo, () => ((inicio + passo) % 4) / 4);
    if (novo.enunciado === anterior) continue;
    sessao.problema = novo;
    break;
  }
  sessao.fase = 'pratica';
  sessao.tentativasPratica = 0;
  sessao.ajuda = false;
  const transferencia = ativo === 9 && sessao.checarTransferencia;
  if (transferencia) sessao.checarTransferencia = false;
  registrar(sessao, transferencia ? `Agora teste a ideia em outra situação. ${sessao.problema.enunciado} Se quiser, diga também sobre qual saldo incidem os juros de cada mês.` : sessao.problema.enunciado);
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
  notas[id] = Dominio.pontuar(notas[id], evento);
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
  sessao.tentativasPratica += 1;
  const { resposta, erroTipico, dica, resolucao } = sessao.problema;
  if (Dominio.confere(valor, resposta)) {
    pontuar(id, sessao.ajuda ? 'comDica' : 'independente');
    const comentario = reconheceuMetodo ? 'Correto! Seu raciocínio também está no caminho certo. '
      : revisarMetodo ? `O valor está correto. Confira o procedimento. ${Dominio.explicarConceito(id)} ` : 'Correto! ';
    registrar(sessao, comentario + resolucao);
    encerrarPratica(sessao, id);
  } else if (sessao.ajuda) {
    pontuar(id, 'erroComDica');
    registrar(sessao, `Vamos conferir a resolução. ${resolucao}`);
    encerrarPratica(sessao, id);
  } else {
    pontuar(id, 'erroInicial');
    sessao.ajuda = true;
    const retorno = Dominio.confere(valor, erroTipico)
      ? 'Esse valor corresponde aos juros simples. Nos compostos, os juros anteriores entram na base do cálculo. '
      : reconheceuMetodo ? 'O procedimento faz sentido. Vamos conferir a conta. '
        : 'Esse valor ficou diferente do gabarito. ';
    registrar(sessao, retorno + dica);
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
  const ultimaFalaTutor = sessao.mensagens.findLast(({ autor }) => autor === 'tutor')?.texto || '';
  registrar(sessao, texto, 'aluno');
  if (sessao.fase === 'pratica' && Dominio.lerNumero(texto) !== null) {
    responderPratica(sessao, texto, id);
    if (ativo === id) exibirChat(false, true);
    return;
  }
  let interpretacao;
  if (podeConsultarGemini && !servidorSemIA) {
    sessao.ocupada = true;
    exibirChat();
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
}

function exibirChat(focar = false, focarCaixa = false) {
  const conceito = Dominio.conceitos[ativo - 1];
  const sessao = sessoes.get(ativo);
  const heading = elemento('div', 'panel-heading');
  const nomes = elemento('div');
  const titulo = elemento('h2', '', 'Tutor de matemática');
  titulo.tabIndex = -1;
  nomes.append(titulo, elemento('p', '', `C${ativo} · ${conceito.nome}`));
  heading.append(nomes);
  if (ativo === 9 && sessao.fase === 'exploracao') {
    heading.append(elemento('span', 'pill', 'Desafio produtivo'));
  } else if (ativo === 9 && sessao.fase === 'consolidacao') {
    heading.append(elemento('span', 'pill', 'Consolidação'));
  }
  const faixa = elemento('div', 'score');
  const indicador = elemento('progress', 'progress');
  indicador.max = 100;
  indicador.value = notas[ativo];
  indicador.setAttribute('aria-label', 'Domínio no conceito');
  faixa.append(elemento('span', '', 'Domínio'), indicador, elemento('strong', '', `${notas[ativo]}/100`));
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
    caixa.placeholder = sessao.fase === 'exploracao' ? 'Conte como você pensou…' : 'Digite sua resposta…';
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
    const [primeiro] = Dominio.pendentes(ativo, notas);
    acoes.append(
      botao(`Revisar C${primeiro}`, 'primary', () => selecionar(primeiro)),
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
  atividade.replaceChildren(heading, faixa, historico, rodape);
  historico.scrollTop = historico.scrollHeight;
  if (focar) {
    moverFoco();
    if (window.matchMedia('(max-width: 900px)').matches) {
      atividade.scrollIntoView({ block: 'start' });
    }
  }
  if (focarCaixa) (caixa || acoes.querySelector('button'))?.focus({ preventScroll: true });
}

atualizarMapa();
exibirDiagnostico();
