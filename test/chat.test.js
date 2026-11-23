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
  constructor() {
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
  querySelector() { return undefined; }
  focus() {}
  getContext() { return new Proxy({}, { get: () => () => {} }); }
  encontrar(texto) {
    if (this.textContent === texto) return this;
    for (const filho of this.children) {
      const encontrado = filho.encontrar(texto);
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

function montarTutor(consultar, chave = 'chave-ficticia') {
  const servidor = criarServidor(chave, consultar);
  const elementos = {};
  const contexto = createContext({
    document: {
      querySelector: (chave) => elementos[chave] ??= new Elemento(),
      createElement: () => new Elemento(),
    },
    location: { protocol: 'http:', hostname: '127.0.0.1' },
    window: { matchMedia: () => ({ matches: false }) },
    ResizeObserver: class { observe() {} },
    AbortSignal,
    fetch: (url, opcoes) => requisitar(servidor, url, opcoes),
  });
  const executar = (codigo) => runInContext(codigo, contexto);
  for (const arquivo of ['dominio.js', 'app.js']) {
    executar(readFileSync(join(__dirname, '..', arquivo), 'utf8'));
  }
  executar('Math.random = () => 0; diagnosticado = true; notas.fill(50)');
  return {
    selecionar: (id) => executar(`selecionar(${id})`),
    enviar: (texto) => executar(`enviarMensagem(sessoes.get(ativo), ${JSON.stringify(texto)}, ativo)`),
    fase: () => executar('sessoes.get(ativo).fase'),
    fala: () => executar('sessoes.get(ativo).mensagens.at(-1).texto'),
    nota: (id) => executar(`notas[${id}]`),
    tentativas: () => executar('sessoes.get(ativo).tentativas.length'),
    praticar: () => executar('iniciarPratica(sessoes.get(ativo))'),
    sortear: (valor) => executar(`Math.random = () => ${valor}`),
    ativo: () => executar('ativo'),
    acao: (texto) => elementos['#activity'].encontrar(texto),
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
  tutor.sortear(0.5);
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
