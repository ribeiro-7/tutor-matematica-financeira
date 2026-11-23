'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { Readable } = require('node:stream');
const test = require('node:test');
const { createContext, runInContext } = require('node:vm');
const Dominio = require('../dominio.js');
const { criarServidor } = require('../servidor.js');

class Elemento {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.eventos = {};
    this.dataset = {};
    this.style = {};
  }

  append(...filhos) { this.children.push(...filhos); }
  replaceChildren(...filhos) { this.children = filhos; }
  hasChildNodes() { return this.children.length > 0; }
  addEventListener(evento, acao) { this.eventos[evento] = acao; }
  setAttribute() {}
  querySelector(tag) { return this.localizar((elemento) => elemento.tag === tag); }
  focus() {}
  getContext() { return new Proxy({}, { get: () => () => {} }); }
  encontrar(texto) {
    return this.localizar((elemento) => elemento.textContent === texto);
  }
  localizar(teste) {
    if (teste(this)) return this;
    for (const filho of this.children) {
      const encontrado = filho.localizar(teste);
      if (encontrado) return encontrado;
    }
  }
}

function requisitar(servidor, url, { method, headers, body }) {
  const req = Object.assign(Readable.from([Buffer.from(body)]), {
    url, method, headers: { host: '127.0.0.1:3000', ...Object.fromEntries(new Headers(headers)) },
  });
  return new Promise((resolve) => {
    servidor.emit('request', req, {
      setHeader() {},
      writeHead(status) { this.status = status; return this; },
      end(texto) { resolve(new Response(texto, { status: this.status })); },
    });
  });
}

function respostaGemini(tipo, forma = 'nenhuma', trecho = '') {
  return Response.json({
    candidates: [{
      finishReason: 'STOP',
      content: { parts: [{ thought: true, text: 'ignorar' }, { text: JSON.stringify({ tipo, forma, trecho }) }] },
    }],
  });
}

function montarTutor(consultar, chave = 'chave-ficticia', diagnosticoConcluido = true, {
  protocolo = 'http:', armazenamento = new Map(), historico = { state: null, replaceState(estado) { this.state = estado; } },
} = {}) {
  const servidor = criarServidor(chave, consultar);
  const elementos = {};
  const eventosJanela = {};
  const contexto = createContext({
    document: {
      querySelector: (chave) => elementos[chave] ??= new Elemento(),
      createElement: (tag) => new Elemento(tag),
    },
    location: { protocol: protocolo, hostname: '127.0.0.1' },
    window: {
      matchMedia: () => ({ matches: false }),
      addEventListener: (evento, acao) => { eventosJanela[evento] = acao; },
      history: historico,
      sessionStorage: {
        getItem: (id) => armazenamento.get(id),
        setItem: (id, valor) => armazenamento.set(id, valor),
      },
    },
    ResizeObserver: class { observe() {} },
    AbortSignal,
    fetch: (url, opcoes) => requisitar(servidor, url, opcoes),
  });
  const executar = (codigo) => runInContext(codigo, contexto);
  for (const arquivo of ['dominio.js', 'app.js']) {
    executar(readFileSync(join(__dirname, '..', arquivo), 'utf8'));
  }
  executar('Math.random = () => 0');
  if (diagnosticoConcluido) executar('diagnosticado = true; notas.fill(50)');
  const atividade = elementos['#activity'];
  return {
    selecionar: (id) => executar(`selecionar(${id})`),
    enviar: (texto) => executar(`enviarMensagem(sessoes.get(ativo), ${JSON.stringify(texto)}, ativo)`),
    fase: () => executar('sessoes.get(ativo).fase'),
    fala: () => executar('sessoes.get(ativo).mensagens.at(-1).texto'),
    nota: (id) => executar(`notas[${id}]`),
    tentativas: () => executar('sessoes.get(ativo).tentativas.length'),
    praticar: () => executar('iniciarPratica(sessoes.get(ativo))'),
    sortear: (valor) => executar(`Math.random = () => ${valor}`),
    variante: () => executar('sessoes.get(ativo).ultimaVariante'),
    ativo: () => executar('ativo'),
    acao: (texto) => atividade.encontrar(texto),
    escolherObjetivo: (texto) => atividade.localizar((el) => el.tag === 'button' && el.encontrar(texto)).eventos.click(),
    menuDiagnostico: () => elementos['#diagnostic-menu'].eventos.click(),
    estado: (id) => executar(`nos.get(${id}).dataset.estado`),
    questaoAtual: () => executar('avaliacao?.ids[avaliacao.atual]'),
    recarregar: () => {
      eventosJanela.pagehide();
      return montarTutor(consultar, chave, false, { protocolo, armazenamento, historico });
    },
    rascunho: () => atividade.querySelector('textarea').value,
    digitar: (texto) => {
      const caixa = atividade.querySelector('textarea');
      caixa.value = texto;
      caixa.eventos.input();
    },
    opcaoMarcada: (opcao) => atividade.querySelector('fieldset').children[opcao + 1].querySelector('input').checked,
    marcar: (opcao) => atividade.querySelector('fieldset').children[opcao + 1].querySelector('input').eventos.change(),
    responder: (opcao) => {
      const formulario = atividade.querySelector('form');
      formulario.querySelector('fieldset').children[opcao + 1].querySelector('input').eventos.change();
      formulario.eventos.submit({ preventDefault() {} });
    },
  };
}

function geminiSimulado(classificar) {
  return async (url, { headers, body }) => {
    assert.match(url, /gemini-3\.1-flash-lite:generateContent$/);
    assert.equal(headers['x-goog-api-key'], 'chave-ficticia');
    const requisicao = JSON.parse(body);
    const dados = JSON.parse(requisicao.contents[0].parts[0].text);
    const { responseJsonSchema, responseMimeType } = requisicao.generationConfig;
    assert.equal(responseMimeType, 'application/json');
    assert.deepEqual(responseJsonSchema.properties.tipo.enum, Dominio.tiposChat(dados.conceito.id));
    assert.deepEqual(responseJsonSchema.required, ['tipo', 'forma', 'trecho']);
    assert.deepEqual(Object.keys(dados), ['conceito', 'fase', 'mensagem', 'enunciado', 'ultimaFalaTutor']);
    return classificar(dados);
  };
}

test('C5 orienta a conversão de prazo e confere o resultado no JavaScript', async () => {
  let chamadas = 0;
  const tutor = montarTutor(geminiSimulado((dados) => {
    chamadas += 1;
    assert.equal(dados.conceito.id, 5);
    assert.equal(dados.fase, 'pratica');
    assert.match(dados.enunciado, /taxa é mensal/);
    return respostaGemini('procedimento', 'duvida', 'Multiplico ou divido');
  }));
  tutor.selecionar(5);
  await tutor.enviar('Multiplico ou divido por 12?');
  assert.equal(tutor.fala(), 'Você trouxe a dúvida “Multiplico ou divido”.\n\nCada ano contém 12 períodos mensais.');
  assert.equal(tutor.nota(5), 50);
  await tutor.enviar('36');
  assert.equal(tutor.nota(5), 57);
  assert.equal(chamadas, 1);
});

test('diagnóstico por objetivo avalia três pré-requisitos de C9 e mantém os demais nós como não avaliados', () => {
  const tutor = montarTutor(undefined, '', false);
  assert.equal(tutor.estado(1), 'unassessed');
  tutor.escolherObjetivo('Calcular juros compostos');
  for (const id of [2, 5, 8]) {
    assert.equal(tutor.questaoAtual(), id);
    tutor.responder(Dominio.diagnostico[id - 1][2]);
  }
  assert.ok(tutor.acao('3 de 3'));
  assert.equal(tutor.estado(2), 'progressing');
  assert.equal(tutor.estado(9), 'unassessed');
  tutor.acao('Praticar montante em juros compostos').eventos.click();
  assert.equal(tutor.fase(), 'exploracao');
});

test('o diagnóstico completo reaproveita as questões e preserva a nota do chat', async () => {
  const tutor = montarTutor(undefined, '', false);
  tutor.escolherObjetivo('Entender juros simples');
  for (const id of [3, 4]) {
    assert.equal(tutor.questaoAtual(), id);
    tutor.responder(Dominio.diagnostico[id - 1][2]);
  }
  tutor.acao('Praticar juros simples').eventos.click();
  await tutor.enviar('60');
  assert.equal(tutor.nota(6), 15);
  tutor.menuDiagnostico();
  tutor.acao('Completar diagnóstico · 12 questões restantes').eventos.click();
  for (const { id } of Dominio.conceitos.filter(({ id }) => id !== 3 && id !== 4)) {
    assert.equal(tutor.questaoAtual(), id);
    const correta = Dominio.diagnostico[id - 1][2];
    tutor.responder(id === 6 ? (correta + 1) % 4 : correta);
  }
  assert.ok(tutor.acao('13 de 14'));
  assert.equal(tutor.nota(6), 15);
  assert.equal(tutor.estado(6), 'initial');
  assert.equal(tutor.nota(3), 50);
  assert.ok(Dominio.conceitos.every(({ id }) => tutor.estado(id) !== 'unassessed'));
});

test('o diagnóstico completo pode ser escolhido no início e um erro marca o nó como iniciante', () => {
  const tutor = montarTutor(undefined, '', false);
  tutor.acao('Diagnóstico completo · 14 questões').eventos.click();
  for (const { id } of Dominio.conceitos) {
    assert.equal(tutor.questaoAtual(), id);
    const correta = Dominio.diagnostico[id - 1][2];
    tutor.responder((correta + 1) % 4);
  }
  assert.ok(tutor.acao('0 de 14'));
  assert.equal(tutor.nota(1), 0);
  assert.equal(tutor.estado(1), 'initial');
});

test('ao abrir outro conceito, o aluno pode avaliar os pré-requisitos e voltar ao tema', () => {
  const tutor = montarTutor(undefined, '', false);
  tutor.escolherObjetivo('Entender juros simples');
  for (const id of [3, 4]) tutor.responder(Dominio.diagnostico[id - 1][2]);
  tutor.selecionar(14);
  tutor.acao('Avaliar pré-requisitos').eventos.click();
  for (const id of [10, 12]) {
    assert.equal(tutor.questaoAtual(), id);
    tutor.responder(Dominio.diagnostico[id - 1][2]);
  }
  tutor.acao('Praticar decisão financeira').eventos.click();
  assert.equal(tutor.fase(), 'pratica');
  assert.equal(tutor.nota(14), null);
  assert.ok(tutor.acao('Não avaliado'));
});

test('C9 esclarece dúvidas antes da fórmula e pontua na prática', async () => {
  const turnos = [
    ['saldo', 'duvida', 'O que significa saldo?'],
    ['fixo', 'raciocinio', 'Somei o mesmo acréscimo todo mês'],
    ['intermediario', 'conta', 'No segundo mês fica R$ 1.210.'],
  ];
  const tutor = montarTutor(geminiSimulado((dados) => {
    assert.equal(dados.conceito.id, 9);
    assert.equal(dados.fase, 'exploracao');
    return respostaGemini(...turnos.shift());
  }));
  tutor.selecionar(9);
  await tutor.enviar('O que significa saldo?');
  assert.match(tutor.fala(), /^Você trouxe a dúvida “O que significa saldo\?”\s+Saldo é/);
  assert.equal(tutor.tentativas(), 0);
  await tutor.enviar('Somei o mesmo acréscimo todo mês. As duas chegam a R$ 1.300.');
  assert.match(tutor.fala(), /^Você explicou sua ideia ao escrever “Somei o mesmo acréscimo todo mês”/);
  assert.doesNotMatch(tutor.fala(), /M =|1\.331/);
  await tutor.enviar('No segundo mês fica R$ 1.210.');
  assert.equal(tutor.fase(), 'consolidacao');
  assert.match(tutor.fala(), /M =/);
  assert.equal(tutor.nota(9), 50);
  tutor.praticar();
  await tutor.enviar('463,05');
  assert.equal(tutor.nota(9), 65);
});

test('C14 distingue o raciocínio e mantém a correção numérica após trocar de conceito', async () => {
  let concluir;
  const aguardando = new Promise((resolve) => { concluir = resolve; });
  let receberMensagem;
  const recebeu = new Promise((resolve) => { receberMensagem = resolve; });
  const tutor = montarTutor(geminiSimulado(async (dados) => {
    assert.equal(dados.conceito.id, 14);
    assert.equal(dados.fase, 'pratica');
    if (dados.mensagem.startsWith('Somei')) return respostaGemini('equivoco', 'raciocinio', dados.mensagem);
    receberMensagem();
    await aguardando;
    return respostaGemini('metodo', 'conta', 'Trouxe cada parcela a valor presente');
  }));
  tutor.selecionar(14);
  await tutor.enviar('Somei as parcelas sem trazer os valores para hoje.');
  assert.match(tutor.fala(), /^Você explicou sua ideia ao escrever “Somei as parcelas sem trazer os valores para hoje\.”/);
  assert.match(tutor.fala(), /compare os custos na mesma data/);
  assert.equal(tutor.nota(14), 50);
  const valor = Dominio.problema(14, () => 0).resposta.toFixed(2).replace('.', ',');
  const pendente = tutor.enviar(`Trouxe cada parcela a valor presente. São 2 parcelas. O custo final é R$ ${valor}.`);
  await Promise.race([recebeu, pendente.then(() => assert.fail('O turno deve aguardar o Gemini'))]);
  tutor.selecionar(5);
  concluir();
  await pendente;
  assert.equal(tutor.nota(14), 57);
  assert.equal(tutor.nota(5), 50);
  tutor.selecionar(14);
  assert.match(tutor.fala(), /^Na sua conta, você escreveu “Trouxe cada parcela a valor presente”/);
  assert.match(tutor.fala(), /Correto!/);
});

test('todos os conceitos consultam a mesma integração para texto livre', async () => {
  const ids = [];
  const tutor = montarTutor(geminiSimulado((dados) => {
    ids.push(dados.conceito.id);
    return respostaGemini('conceito', 'duvida', 'O que significa o conceito em estudo');
  }));
  for (const { id } of Dominio.conceitos) {
    tutor.selecionar(id);
    await tutor.enviar('O que significa o conceito em estudo?');
    assert.match(tutor.fala(), /^Você trouxe a dúvida “O que significa o conceito em estudo”/);
    assert.equal(tutor.nota(id), 50);
    assert.equal(tutor.fase(), id === 9 ? 'exploracao' : 'pratica');
  }
  assert.deepEqual(ids, Dominio.conceitos.map(({ id }) => id));
});

test('descarta gabarito, fórmulas, texto inventado e formatos desconhecidos na retomada', async () => {
  const retomadas = [
    ['conta', 'A resposta é 36'],
    ['conta', 'Resposta = 3 × 12'],
    ['raciocinio', 'O resultado é trinta e seis'],
    ['resolucao', 'Multiplico ou divido'],
    ['duvida', 'plico ou divido'],
    ['nenhuma', ''],
  ];
  const tutor = montarTutor(geminiSimulado(() => respostaGemini('procedimento', ...retomadas.shift())));
  tutor.selecionar(5);
  while (retomadas.length) {
    await tutor.enviar('Multiplico ou divido por 12?');
    assert.equal(tutor.fala(), 'Cada ano contém 12 períodos mensais.');
    assert.equal(tutor.nota(5), 50);
  }
  await tutor.enviar('36');
  assert.equal(tutor.nota(5), 57);
});

test('cota, resposta inválida e ausência de chave preservam o modo local', async () => {
  const cenarios = [
    [() => new Response(null, { status: 429 }), 'chave-ficticia'],
    [() => respostaGemini('saldo'), 'chave-ficticia'],
    [() => assert.fail('Sem chave, não consulta o Gemini'), ''],
  ];
  for (const [consultar, chave] of cenarios) {
    const tutor = montarTutor(geminiSimulado(consultar), chave);
    tutor.selecionar(5);
    await tutor.enviar('Multiplico ou divido por 12?');
    assert.match(tutor.fala(), /12 períodos mensais/);
    assert.equal(tutor.nota(5), 50);
  }
});

test('C5 dá uma dica específica quando o estudante usa anos como períodos mensais', async () => {
  const tutor = montarTutor(undefined, '');
  tutor.selecionar(5);
  await tutor.enviar('3');
  assert.match(tutor.fala(), /coincide com o prazo em anos/);
  assert.equal(tutor.nota(5), 50);
  await tutor.enviar('36');
  assert.equal(tutor.nota(5), 57);
});

test('C9 reconhece o expoente em anos e permite revisar C5 sem abandonar a tentativa', async () => {
  const tutor = montarTutor(undefined, '');
  tutor.selecionar(9);
  tutor.sortear(1 / 3);
  tutor.praticar();
  assert.match(tutor.fala(), /1% ao mês por 1 ano/);
  await tutor.enviar('404');
  assert.match(tutor.fala(), /prazo em anos como expoente/);
  assert.doesNotMatch(tutor.fala(), /450,73/);
  assert.equal(tutor.nota(9), 50);
  tutor.acao('Revisar C5 · Período da taxa').eventos.click();
  assert.equal(tutor.ativo(), 5);
  tutor.selecionar(9);
  assert.match(tutor.fala(), /prazo em anos como expoente/);
  await tutor.enviar('450,73');
  assert.equal(tutor.nota(9), 57);
  assert.equal(tutor.acao('Revisar C5 · Período da taxa'), undefined);
});

test('C9 sugere C8 para montante simples e C14 sugere C12 para o total nominal', async () => {
  const tutor = montarTutor(undefined, '');
  tutor.selecionar(9);
  tutor.praticar();
  await tutor.enviar('460');
  assert.match(tutor.fala(), /montante em juros simples/);
  assert.ok(tutor.acao('Revisar C8 · Juros sobre juros'));
  tutor.selecionar(14);
  await tutor.enviar('420');
  assert.match(tutor.fala(), /soma nominal das parcelas/);
  assert.ok(tutor.acao('Revisar C12 · Parcelamento'));
  assert.equal(tutor.nota(14), 50);
});

test('o sorteio completa cada rodada por conceito e alterna os três modelos do C9', () => {
  const tutor = montarTutor(undefined, '');
  tutor.selecionar(9);
  const variantes = [];
  for (let i = 0; i < 12; i += 1) {
    tutor.praticar();
    variantes.push(tutor.variante());
    if (i === 4) {
      tutor.selecionar(5);
      assert.equal(tutor.variante(), 0);
      tutor.selecionar(9);
      assert.equal(tutor.variante(), variantes.at(-1));
    }
  }
  assert.equal(new Set(variantes).size, 12);
  for (let i = 0; i < variantes.length; i += 3) {
    assert.equal(new Set(variantes.slice(i, i + 3).map((id) => Math.floor(id / 4))).size, 3);
  }
  tutor.praticar();
  assert.notEqual(tutor.variante(), variantes.at(-1));
  tutor.selecionar(5);
  const c5 = [tutor.variante()];
  for (let i = 0; i < 3; i += 1) {
    tutor.praticar();
    c5.push(tutor.variante());
  }
  assert.equal(new Set(c5).size, 4);
  tutor.praticar();
  assert.notEqual(tutor.variante(), c5.at(-1));
});

test('a comparação do C9 pede justificativa e mantém os pontos do acerto sem dica', async () => {
  const tutor = montarTutor(geminiSimulado(() => respostaGemini('duvida')));
  tutor.selecionar(9);
  tutor.sortear(2 / 3);
  tutor.praticar();
  assert.match(tutor.fala(), /Conta A[\s\S]+Conta B/);
  await tutor.enviar('A');
  assert.match(tutor.fala(), /explique o que acontece/);
  assert.equal(tutor.nota(9), 50);
  await tutor.enviar('Porque os juros incidem sobre o saldo do mês anterior.');
  assert.match(tutor.fala(), /A conta A usa juros compostos/);
  assert.equal(tutor.nota(9), 65);
  assert.equal(tutor.fase(), 'finalizada');
});

test('na comparação do C9, uma justificativa incorreta gera dica e o acerto seguinte vale sete', async () => {
  const tutor = montarTutor(undefined, '');
  tutor.selecionar(9);
  tutor.sortear(0.75);
  tutor.praticar();
  await tutor.enviar('B, pois usa sempre o capital inicial como base.');
  assert.match(tutor.fala(), /Compare as duas contas/);
  assert.equal(tutor.nota(9), 50);
  await tutor.enviar('Conta B, porque não soma um valor fixo, multiplica pelo mesmo fator a cada mês.');
  assert.match(tutor.fala(), /A conta B usa juros compostos/);
  assert.equal(tutor.nota(9), 57);
});

test('recarregar na mesma aba restaura a pergunta e as opções marcadas no diagnóstico', () => {
  const tutor = montarTutor(undefined, '', false);
  tutor.escolherObjetivo('Calcular juros compostos');
  tutor.responder(Dominio.diagnostico[1][2]);
  const correta = Dominio.diagnostico[4][2];
  tutor.marcar(correta);
  const recarregado = tutor.recarregar();
  assert.equal(recarregado.questaoAtual(), 5);
  assert.equal(recarregado.opcaoMarcada(correta), true);
  recarregado.responder(correta);
  recarregado.responder(Dominio.diagnostico[7][2]);
  const resumo = recarregado.recarregar();
  assert.ok(resumo.acao('3 de 3'));
  assert.equal(resumo.nota(5), 50);
  assert.equal(resumo.estado(9), 'unassessed');
});

test('recarregar o chat preserva a dica, a nota, o exercício, o rascunho e o sorteio', async () => {
  const tutor = montarTutor(undefined, '');
  tutor.selecionar(5);
  await tutor.enviar('36');
  tutor.acao('Novo exercício').eventos.click();
  tutor.acao('Pedir ajuda').eventos.click();
  const variante = tutor.variante();
  const dica = tutor.fala();
  tutor.digitar('48');
  const recarregado = tutor.recarregar();
  assert.equal(recarregado.ativo(), 5);
  assert.equal(recarregado.fase(), 'pratica');
  assert.equal(recarregado.nota(5), 65);
  assert.equal(recarregado.variante(), variante);
  assert.equal(recarregado.fala(), dica);
  assert.equal(recarregado.rascunho(), '48');
  await recarregado.enviar('48');
  assert.equal(recarregado.nota(5), 72);
  recarregado.acao('Novo exercício').eventos.click();
  assert.notEqual(recarregado.variante(), 0);
  assert.notEqual(recarregado.variante(), variante);
});

test('o progresso também é recuperado com o index.html aberto como arquivo', () => {
  const tutor = montarTutor(undefined, '', false, { protocolo: 'file:' });
  tutor.escolherObjetivo('Entender juros simples');
  tutor.responder(Dominio.diagnostico[2][2]);
  const recarregado = tutor.recarregar();
  assert.equal(recarregado.questaoAtual(), 4);
});

test('uma mensagem interrompida pelo recarregamento volta como rascunho', async () => {
  let recebeu;
  const consulta = new Promise((resolve) => { recebeu = resolve; });
  let chamadas = 0;
  const tutor = montarTutor(geminiSimulado(() => {
    chamadas += 1;
    if (chamadas === 1) {
      recebeu();
      return new Promise(() => {});
    }
    return respostaGemini('tentativa');
  }));
  tutor.selecionar(5);
  const resposta = 'São 36 meses.';
  void tutor.enviar(resposta);
  await consulta;
  const recarregado = tutor.recarregar();
  assert.equal(chamadas, 1);
  assert.equal(recarregado.nota(5), 50);
  assert.equal(recarregado.rascunho(), resposta);
  await recarregado.enviar(resposta);
  assert.equal(chamadas, 2);
  assert.equal(recarregado.nota(5), 65);
});
