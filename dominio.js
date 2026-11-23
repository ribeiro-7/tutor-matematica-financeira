'use strict';

const Dominio = (() => {
  const reais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 6 });
  const moeda = (valor) => reais.format(valor);
  const numero = (valor) => decimal.format(valor);
  const percentual = (valor) => `${numero(valor)}%`;
  const normalizarTexto = (texto) => texto.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();

  // Coluna e linha posicionam os nós. Os pré-requisitos também alimentam a recomendação.
  const conceitos = [
    ['Porcentagem e razão', [], 0, 0, 0],
    ['Potenciação e decimais', [], 0, 2, 0],
    ['Acréscimo e desconto', [1], 1, 0, 1],
    ['Capital, taxa, tempo e montante', [1], 1, 1, 1],
    ['Período da taxa', [4], 2, 2, 2],
    ['Juros simples', [3, 4], 2, 0, 2],
    ['Montante em juros simples', [6], 3, 0, 3],
    ['Juros sobre juros', [6], 3, 1, 3],
    ['Montante em juros compostos', [8, 5, 2], 4, 1, 4],
    ['Simples × compostos', [7, 9], 5, 1, 5],
    ['Taxa equivalente', [9], 5, 2, 5],
    ['Parcelamento', [9, 3], 5, 0, 5],
    ['Inflação e juro real', [9], 5, 3, 5],
    ['Decisão financeira', [10, 12], 6, 1, 6],
  ].map(([nome, requisitos, nivel, coluna, linha], i) =>
    ({ id: i + 1, nome, requisitos, nivel, coluna, linha })
  );

  const diagnostico = [
    ['Quanto é 15% de 200?', ['15', '30', '35', '45'], 1],
    ['Qual é o resultado de 1,2 elevado ao cubo?', ['1,44', '1,6', '3,6', '1,728'], 3],
    ['Um produto de R$ 250 recebe 20% de desconto. Qual é o preço final?', ['R$ 200', 'R$ 230', 'R$ 50', 'R$ 300'], 0],
    ['Uma aplicação de R$ 800 terminou com R$ 920. Qual foi o montante?', ['R$ 120', 'R$ 800', 'R$ 920', 'R$ 1.720'], 2],
    ['A taxa é mensal e o prazo é de um ano e meio. Quantos períodos mensais você deve usar?', ['1,5', '18', '12', '15'], 1],
    ['R$ 500 rendem 4% ao mês em juros simples durante 3 meses. Quanto rendem só de juros?', ['R$ 20', 'R$ 40', 'R$ 560', 'R$ 60'], 3],
    ['R$ 1.000 rendem 2% ao mês em juros simples por 5 meses. Qual é o montante?', ['R$ 1.100', 'R$ 100', 'R$ 1.020', 'R$ 1.200'], 0],
    ['Em juros compostos, sobre qual valor incidem os juros do segundo mês?', ['Capital inicial', 'Somente os juros do primeiro mês', 'Saldo ao fim do primeiro mês', 'Montante ao fim de todo o prazo'], 2],
    ['R$ 200 rendem 10% ao mês em juros compostos por 2 meses. Qual é o saldo final?', ['R$ 220', 'R$ 242', 'R$ 240', 'R$ 222'], 1],
    ['Com o mesmo capital e taxa positiva, após 3 meses qual regime rende mais?', ['Juros simples', 'Rendem o mesmo', 'Depende do capital', 'Juros compostos'], 3],
    ['Qual é a taxa efetiva acumulada em dois meses a 10% ao mês em juros compostos?', ['21%', '20%', '10%', '22%'], 0],
    ['Com taxa de desconto de 10% ao mês, quanto vale hoje uma parcela de R$ 110 com vencimento em um mês?', ['R$ 99', 'R$ 110', 'R$ 100', 'R$ 121'], 2],
    ['Se uma aplicação rende 10% no ano e os preços também sobem 10%, o que acontece com o poder de compra?', ['Aumenta 10%', 'Fica igual', 'Diminui 10%', 'Aumenta 20%'], 1],
    ['À vista, um item custa R$ 190. Em um mês, custa R$ 220. Se o dinheiro rende 10% ao mês, qual opção tem o menor custo em valor de hoje?', ['Pagar em um mês', 'Custam o mesmo', 'Falta a taxa mensal', 'Pagar à vista'], 3],
  ];

  const arredondar = (valor) => Math.round((valor + Number.EPSILON) * 100) / 100;
  const montante = (capital, taxa, meses) => capital * (1 + taxa / 100) ** meses;
  const valorPresente = (parcela, taxa, meses) => parcela / (1 + taxa / 100) ** meses;
  const eventos = { diagnostico: 50, independente: 15, comDica: 7, erroInicial: 0, erroComDica: -5, revelacaoPrecoce: -3 };
  const pontuar = (nota, evento) => {
    if (nota === null && evento === 'revelacaoPrecoce') return null;
    return Math.min(100, Math.max(0, (nota ?? 0) + eventos[evento]));
  };
  const estado = (nota) => nota === null ? 'unassessed' : nota >= 70 ? 'mastered' : nota >= 30 ? 'progressing' : 'initial';
  const rotulos = { unassessed: 'Não avaliado', initial: 'Iniciante', progressing: 'Em progresso', mastered: 'Dominado' };
  const pendentes = (id, notas) => conceitos[id - 1].requisitos.filter((requisito) => (notas[requisito] ?? 0) < 50);
  const sugerir = (notas, excluir) => [...conceitos]
    .sort((a, b) => a.nivel - b.nivel || a.id - b.id)
    .find(({ id }) => id !== excluir && (notas[id] ?? 0) < 70 && pendentes(id, notas).length === 0);
  const confere = (valor, esperado) =>
    valor !== null && Math.abs(valor - esperado) <= Math.max(0.005, Math.abs(esperado) * 0.005);
  const variantesPorModelo = 4;
  const totalVariantes = (id) => (id === 9 ? 3 : 1) * variantesPorModelo;
  const modeloDaVariante = (variante) => Math.floor(variante / variantesPorModelo);

  function sortearVariante(restantes, ultima, sorteio = Math.random) {
    const candidatas = restantes.length > 1 ? restantes.filter((variante) => variante !== ultima) : restantes;
    const porModelo = new Map();
    for (const variante of candidatas) {
      const modelo = modeloDaVariante(variante);
      porModelo.set(modelo, (porModelo.get(modelo) || 0) + 1);
    }
    const maiorGrupo = Math.max(...porModelo.values());
    const equilibradas = candidatas.filter((variante) => porModelo.get(modeloDaVariante(variante)) === maiorGrupo);
    const diferentes = equilibradas.filter((variante) => modeloDaVariante(variante) !== modeloDaVariante(ultima));
    const opcoes = diferentes.length ? diferentes : equilibradas;
    return opcoes[Math.floor(sorteio() * opcoes.length)];
  }

  function identificarErro(problema, valor) {
    if (confere(valor, problema.resposta)) return null;
    const candidatos = problema.erros.filter((erro) => confere(valor, erro.valor));
    return candidatos.length === 1 ? candidatos[0] : null;
  }

  function lerNumero(texto) {
    const resultado = texto.trim().match(/^(?:R\$\s*)?([+-]?(?:\d+(?:[.,]\d+)*|[.,]\d+))\s*%?$/i);
    if (!resultado) return null;
    const original = resultado[1];
    if (!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+|\d{1,3}(?:\.\d{3})+(?:,\d+)?)$/.test(original)) return null;
    const brasileiro = original.includes(',') || /^[+-]?\d{1,3}(?:\.\d{3})+$/.test(original);
    const valor = Number(brasileiro ? original.replaceAll('.', '').replace(',', '.') : original);
    return Number.isFinite(valor) ? valor : null;
  }

  function problemaC9(capital, taxa, meses, anos = null) {
    const resposta = arredondar(montante(capital, taxa, meses));
    const periodo = anos ? `${anos} ${anos === 1 ? 'ano' : 'anos'}` : `${meses} meses`;
    const erros = [{
      valor: arredondar(capital * (1 + taxa * meses / 100)),
      dica: 'O valor está próximo ao montante em juros simples. Em juros compostos, sobre qual saldo incidem os juros de cada mês?',
      revisao: 8,
    }];
    if (anos) {
      erros.push({
        valor: arredondar(montante(capital, taxa, anos)),
        dica: 'O valor está próximo ao que resulta de usar o prazo em anos como expoente. Qual unidade o prazo precisa ter se a taxa é mensal?',
        revisao: 5,
      });
    }
    const conversao = anos ? `Converta o prazo para ${meses} meses antes de escolher o expoente. ` : '';
    return {
      enunciado: `Qual é o montante de ${moeda(capital)} a ${percentual(taxa)} ao mês por ${periodo} em juros compostos? Informe o saldo final em reais.`,
      resposta,
      dica: anos ? 'Converta o prazo para a unidade da taxa. Quantas vezes o fator mensal deve ser aplicado?'
        : 'O saldo é multiplicado pelo mesmo fator em cada mês. Quantas vezes esse fator aparece?',
      resolucao: `${conversao}Multiplique ${moeda(capital)} por (1 + ${numero(taxa / 100)}) elevado a ${meses}. O montante é ${moeda(resposta)}.`,
      erros,
    };
  }

  function comparacaoC9(capital, taxa, meses, variante) {
    const resposta = variante % 2 === 0 ? 'A' : 'B';
    const outro = resposta === 'A' ? 'B' : 'A';
    const fator = numero(1 + taxa / 100);
    const acrescimo = moeda(capital * taxa / 100);
    const contas = {
      [resposta]: `${moeda(capital)} × (${fator}) elevado a ${meses}`,
      [outro]: `${moeda(capital)} + (${acrescimo} × ${meses})`,
    };
    return {
      formato: 'comparacao',
      enunciado: `Duas pessoas calcularam o saldo de ${moeda(capital)} a ${percentual(taxa)} ao mês por ${meses} meses.\n\nConta A · ${contas.A}\nConta B · ${contas.B}\n\nQual conta usa juros compostos? Escolha A ou B e explique o que acontece com o saldo a cada mês.`,
      resposta,
      dica: 'Compare as duas contas. Em qual delas o mesmo fator multiplica o saldo que já foi atualizado no mês anterior?',
      resolucao: `A conta ${resposta} usa juros compostos. A potência repete a multiplicação por ${fator} em cada mês. Assim, os juros incidem sobre o saldo atualizado. A conta ${outro} soma um acréscimo fixo de ${acrescimo} por mês, como em juros simples.`,
    };
  }

  function lerComparacao(texto) {
    const mensagem = normalizarTexto(texto);
    const rotulo = mensagem.match(/^(?:(?:eu\s+)?(?:escolho|escolhi|acho que e|e)\s+)?(?:a\s+)?(?:conta|opcao|alternativa)\s+([ab])\b/)
      || mensagem.match(/^(?:(?:eu\s+)?(?:escolho|escolhi|acho que e|e)\s+(?:a\s+)?)?([ab])(?=\s*(?:$|[,.:;!?()\p{Pd}]|\b(?:porque|pois|ja que)\b))/u);
    const escolha = rotulo?.[1].toUpperCase();
    if (!escolha && /^(?:o que|como|qual|por que|pode me)\b/.test(mensagem)) return { escolha, motivo: null };
    const trechos = (rotulo ? mensagem.slice(rotulo[0].length) : mensagem).split(/[!?;]|[.,](?=\s)|\b(?:mas|enquanto|ao contrario|e sim)\b/);
    const motivos = new Set();
    for (const trecho of trechos) {
      const outraConta = trecho.match(/\b(?:conta|opcao|alternativa)\s+([ab])\b/)?.[1].toUpperCase();
      if (escolha && outraConta && outraConta !== escolha) continue;
      const negado = /\b(?:nao|nunca)\b/.test(trecho);
      const baseAtualizada = /(?:saldo|base|valor|montante).{0,24}(?:atualiz|acumul|anterior|passado)|base.{0,12}muda/.test(trecho);
      const fatorPorPeriodo = /(?:reaplica|repete|multiplica).{0,38}fator.{0,35}(?:cada|mensal|vezes|meses|periodos)|(?:expoente|potencia).{0,50}(?:meses|periodos|cada mes)/.test(trecho);
      const jurosAcumulados = /juros (?:sobre|dos|em cima de) juros|juros.{0,36}(?:reinvest|entram na base|entram no saldo|incorpor)/.test(trecho);
      const composto = jurosAcumulados || baseAtualizada || fatorPorPeriodo;
      const simples = /(?:acrescimo|valor|juros) fixo|(?:sempre|todo mes|a cada mes).{0,24}capital inicial|capital inicial.{0,24}(?:em todos|todo mes|a cada mes)|mesma base|(?:soma|somou).{0,32}(?:mesmo valor|mesma quantia)/.test(trecho);
      if (composto && !negado) motivos.add('composto');
      if ((composto && negado) || (simples && !negado)) motivos.add('simples');
    }
    return { escolha, motivo: motivos.size === 1 ? motivos.values().next().value : null };
  }

  function problema(id, sorteio = Math.random) {
    const quantidade = totalVariantes(id);
    const variante = Math.min(quantidade - 1, Math.floor(sorteio() * quantidade));
    const indice = variante % variantesPorModelo;
    const capital = [400, 500, 800, 1200][indice];
    const taxa = [5, 8, 10, 12][indice];
    const meses = [3, 4, 2, 5][indice];
    if (id === 9) {
      const modelo = modeloDaVariante(variante);
      if (modelo === 0) return problemaC9(capital, taxa, meses);
      if (modelo === 2) return comparacaoC9(capital, taxa, meses, indice);
      const anos = [1, 2, 1, 2][indice];
      return problemaC9(capital, [1, 1.5, 2, 2.5][indice], anos * 12, anos);
    }
    const base = moeda(capital);
    const juros = capital * taxa * meses / 100;
    const composto = arredondar(montante(capital, taxa, meses));
    const simples = capital + juros;
    const emComum = `${base} a ${taxa}% ao mês por ${meses} meses`;
    const parcela = [210, 270, 450, 660][indice];
    const hoje = arredondar(valorPresente(parcela, taxa, 1) + valorPresente(parcela, taxa, 2));
    const precoVista = hoje + [-15, 20, 25, -20][indice];
    const prazo = meses * 12;
    const inflacao = [2, 4, 5, 6][indice];
    const casas = (valor) => numero(arredondar(valor));
    const respostas = [
      [`Quanto é ${taxa}% de ${capital}?`, capital * taxa / 100, 'Divida a taxa por 100 para obter a fração do total.', `${taxa} ÷ 100 × ${capital} = ${numero(capital * taxa / 100)}.`],
      [`Calcule (1 + ${numero(taxa / 100)}) elevado a ${meses}. Use até seis casas decimais.`, (1 + taxa / 100) ** meses, 'O expoente indica quantas vezes o mesmo fator aparece na multiplicação.', `Multiplicando ${numero(1 + taxa / 100)} por si mesmo até ter ${meses} fatores, o resultado é ${numero((1 + taxa / 100) ** meses)}.`],
      [`Um produto de ${base} recebe ${taxa}% de desconto. Qual é o preço final?`, capital * (1 - taxa / 100), 'O desconto deve ser subtraído do preço original.', `O desconto é ${moeda(capital * taxa / 100)}. Subtraindo do preço inicial, obtemos ${moeda(capital * (1 - taxa / 100))}.`],
      [`Você aplicou um capital e recebeu ${moeda(juros)} em juros. O montante final foi ${moeda(simples)}. Qual era o capital inicial?`, capital, 'O montante é a soma do capital inicial e dos juros.', `${moeda(simples)} menos ${moeda(juros)} resulta em ${base}.`],
      [`Se a taxa é mensal e a aplicação dura ${meses} anos, quantos períodos você deve usar?`, prazo, 'Cada ano contém 12 períodos mensais.', `${meses} × 12 = ${prazo} meses.`, [
        { valor: meses, dica: 'Esse número coincide com o prazo em anos. Como a taxa é mensal, quantos meses há em cada ano?' },
        { valor: meses / 12, dica: 'Esse número é compatível com uma divisão por 12. De anos para meses, o número de períodos aumenta ou diminui?' },
      ]],
      [`Calcule apenas os juros simples de ${emComum}.`, juros, 'Encontre os juros de um mês sobre o capital inicial e multiplique pelo número de meses.', `${base} × ${numero(taxa / 100)} × ${meses} = ${moeda(juros)} em juros.`],
      [`Qual é o montante de ${emComum} em juros simples?`, simples, 'Some os juros de todos os meses ao capital inicial.', `Os juros são ${moeda(juros)}. Somando a ${base}, o saldo fica em ${moeda(simples)}.`],
      [`Você aplica ${base} a ${taxa}% ao mês em juros compostos. Quanto rende apenas o segundo mês?`, arredondar(montante(capital, taxa, 1) * taxa / 100), 'No segundo mês, a taxa incide sobre o saldo que já inclui os primeiros juros.', `O primeiro mês termina com ${moeda(montante(capital, taxa, 1))}. Aplicando ${taxa}% a esse saldo, o segundo mês rende ${moeda(montante(capital, taxa, 1) * taxa / 100)}.`],
      null, // C9 usa problemaC9.
      [`Compare ${emComum} nos dois regimes. Em reais, quanto a mais rende o regime composto?`, arredondar(composto - simples), 'Calcule o saldo de cada aplicação e subtraia o menor do maior.', `O saldo composto é ${moeda(composto)} e o simples é ${moeda(simples)}. A diferença é ${moeda(composto - simples)}.`],
      [`Qual é a taxa percentual equivalente a ${taxa}% ao mês por 2 meses em juros compostos?`, ((1 + taxa / 100) ** 2 - 1) * 100, 'Multiplique os dois fatores de crescimento e retire o 1 que representa o capital original.', `[(1 + ${numero(taxa / 100)})² − 1] × 100 = ${percentual(((1 + taxa / 100) ** 2 - 1) * 100)}.`],
      [`Uma compra tem duas parcelas de ${moeda(parcela)}, uma em 1 mês e outra em 2 meses. Com taxa de desconto de ${taxa}% ao mês, quanto valem as duas parcelas juntas hoje?`, hoje, 'Traga cada parcela separadamente para hoje. Use um período para a primeira e dois para a segunda.', `${moeda(parcela)} ÷ ${numero(1 + taxa / 100)} + ${moeda(parcela)} ÷ (${numero(1 + taxa / 100)})² = ${moeda(hoje)} em valor presente.`],
      [`Um investimento rende ${taxa}% no ano, com inflação de ${inflacao}%. Qual é o juro real em porcentagem? Arredonde a duas casas.`, arredondar(((1 + taxa / 100) / (1 + inflacao / 100) - 1) * 100), 'Divida o fator de crescimento do investimento pelo fator de crescimento dos preços.', `[(1 + ${numero(taxa / 100)}) ÷ (1 + ${numero(inflacao / 100)}) − 1] × 100 ≈ ${casas(((1 + taxa / 100) / (1 + inflacao / 100) - 1) * 100)}%.`],
      [`Uma compra custa ${moeda(precoVista)} à vista ou duas parcelas de ${moeda(parcela)}, em 1 e 2 meses. Com taxa de ${taxa}% ao mês, qual é o custo da opção mais barata, em valor de hoje? Se quiser, explique sua escolha.`, Math.min(precoVista, hoje), 'Traga as parcelas para o dia de hoje antes de comparar com o preço à vista.', `O preço à vista é ${moeda(precoVista)}. O valor presente das parcelas é ${moeda(hoje)}. A opção mais barata é ${precoVista < hoje ? 'à vista' : 'parcelada'}, por ${moeda(Math.min(precoVista, hoje))} em valor de hoje.`, [
        { valor: 2 * parcela, dica: 'Esse valor está próximo da soma nominal das parcelas. Quanto vale hoje cada parcela?', revisao: 12 },
        { valor: precoVista, dica: 'Esse valor coincide com o preço à vista. Antes de escolher, compare-o com o valor das duas parcelas trazidas para hoje.', revisao: 12 },
      ]],
    ];
    const [enunciado, resposta, dica, resolucao, erros = []] = respostas[id - 1];
    return { enunciado, resposta, dica, resolucao, erros };
  }

  const desafio = {
    enunciado: 'Você tem R$ 1.000 em duas aplicações fictícias. A primeira acrescenta R$ 100 todo mês. A segunda acrescenta 10% sobre o saldo do início de cada mês. As duas chegam a R$ 1.100 no primeiro mês. Ao fim de três meses, qual terá o maior saldo? Conte como você chegou à resposta.',
    consolida: 'Na primeira aplicação, entram R$ 100 todo mês: o saldo chega a R$ 1.300. Na segunda, a base muda: R$ 1.000 → R$ 1.100 → R$ 1.210 → R$ 1.331. A segunda tem o maior saldo.',
    formaliza: 'Cada mês multiplica o saldo por 1,10. Generalizando, M = C × (1 + i)ᵗ. C é o capital inicial, i é a taxa em decimal e t conta os períodos em que o fator se repete.',
  };

  const tiposComuns = Object.freeze([
    'conceito', 'procedimento', 'metodo', 'equivoco', 'tentativa', 'ajuda', 'duvida', 'ambigua', 'fora',
  ]);
  const tiposC9 = Object.freeze([
    ...tiposComuns, 'fixo', 'variavel', 'intermediario', 'palpite', 'saldo', 'taxa', 'prazo', 'compostos',
  ]);
  const tiposChat = (id) => id === 9 ? tiposC9 : tiposComuns;

  const explicacoes = [
    'Porcentagem é uma razão por cem. Primeiro identifique qual quantidade representa o total.',
    'Potenciação repete uma multiplicação. A base indica o fator e o expoente diz quantas vezes ele aparece.',
    'Acréscimos e descontos são calculados sobre um preço de referência. Identifique o preço original antes de aplicar a taxa.',
    'O capital é o valor inicial. Os juros são o que se acrescenta a ele. O montante é a soma do capital com os juros.',
    'O período da taxa indica de quanto em quanto tempo ela é aplicada. Se a taxa é mensal, conte meses no prazo. Um ano tem 12 meses.',
    'Em juros simples, cada período acrescenta a mesma fração do capital inicial.',
    'O montante em juros simples inclui o capital inicial e os juros de todos os períodos.',
    'Em juros compostos, o saldo de um período inclui os juros já ganhos. Esse saldo vira a base do período seguinte.',
    'O montante é o saldo final. Em juros compostos, cada período usa como base o saldo do início desse período.',
    'Com o mesmo capital e taxa, compare como o saldo cresce. Nos juros simples, o acréscimo fica fixo. Nos compostos, ele acompanha o saldo.',
    'Taxas equivalentes produzem o mesmo crescimento ao longo do mesmo prazo. Em juros compostos, compare os fatores de crescimento.',
    'Valor presente é quanto uma parcela futura vale hoje. Cada parcela tem seu próprio prazo até o vencimento.',
    'O juro real mede a mudança no poder de compra. Compare o crescimento do dinheiro com o crescimento dos preços.',
    'Para decidir entre pagar à vista e parcelar, compare os custos na mesma data. Traga cada parcela para o valor de hoje antes de somar.',
  ];
  const explicarConceito = (id) => explicacoes[id - 1];

  function numerosNoTexto(texto) {
    const partes = texto.match(/[+-]?\d+(?:[.,]\d+)*/g) || [];
    return partes.map(lerNumero).filter((valor) => valor !== null);
  }

  function interpretarC9Local(texto, fase) {
    const mensagem = normalizarTexto(texto);
    const valores = numerosNoTexto(mensagem);
    const pergunta = /\?|^(?:o que|qual|quanto|como|por que|pode me)\b/.test(mensagem);
    if (/\b(?:chutei|chute|palpite|so adivinhei)\b/.test(mensagem)) return 'palpite';
    if (/\b(?:nao sei por onde|travei|estou perdid[oa]|me ajuda|uma dica)\b/.test(mensagem)
      || (valores.length === 0 && /^(?:nao sei|nao entendi)\b/.test(mensagem))) return 'ajuda';
    if (pergunta) {
      if (/\b(?:o que (?:e|significa)|defina)\s+(?:o\s+)?saldo\b/.test(mensagem)) return 'saldo';
      if (/\b(?:prazo|periodo|quantos meses)\b/.test(mensagem)) return 'prazo';
      if (/\b(?:porcentagem|decimal|taxa|percentual)\b/.test(mensagem)) return 'taxa';
      if (/\b(?:compostos|juros sobre juros|capitalizacao|montante)\b/.test(mensagem)) return 'compostos';
      if (/^(?:o que|qual|quanto|como|por que|pode|e se)\b/.test(mensagem)) return 'duvida';
    }
    if (/\b(?:saldo|base)\b.{0,28}\b(?:muda|variavel|atual|atualizado|anterior)\b|juros sobre juros|sobre o que ja juntou|sobre o saldo de cada mes|sobre o saldo do mes anterior/.test(mensagem)) return 'variavel';
    if (!/\b(?:nao|nunca)\b/.test(mensagem) && /\b(?:empat\w*|iguais|mesm[oa] (?:saldo|valor)|100 (?:a cada|todo|por) mes)\b/.test(mensagem)) return 'fixo';
    if (fase === 'exploracao') {
      if (valores.includes(1210) || valores.includes(110)) return 'intermediario';
      if (valores.includes(1300) && !valores.includes(1331)) return 'fixo';
      if (valores.includes(1331) || /^(?:a (?:primeira|segunda)|opcao [ab])\b/.test(mensagem)) return 'palpite';
    }
    if (valores.length || /\b(?:somei|multipliquei|dividi|subtrai|calculei)\b/.test(mensagem)) return 'tentativa';
    return pergunta ? 'duvida' : 'ambigua';
  }

  function interpretarLocal(id, texto, fase) {
    if (id === 9) return interpretarC9Local(texto, fase);
    const mensagem = normalizarTexto(texto);
    if (/\b(?:me ajuda|uma dica|travei|nao sei por onde|estou perdid[oa])\b/.test(mensagem)) return 'ajuda';
    if (/(?:^|\b)(?:o que (?:e|significa)|qual (?:e )?a diferenca)\b/.test(mensagem)) return 'conceito';
    if (/^(?:como|por que|qual|quanto|devo|eu devo|e se)\b/.test(mensagem)
      || (/\?$/.test(mensagem) && /\b(?:multiplico|divido|som[oa]|subtraio)\b/.test(mensagem))) return 'procedimento';
    if (id === 14 && numerosNoTexto(texto).length === 0) {
      if (/valor presente|mesma data|trouxe (?:as|cada) parcela/.test(mensagem)) return 'metodo';
      if (/(?:som(?:ei|o)|juntei).{0,24}parcelas/.test(mensagem)) return 'equivoco';
    }
    if (numerosNoTexto(texto).length || /\b(?:somei|multipliquei|dividi|subtrai|calculei)\b/.test(mensagem)) return 'tentativa';
    return mensagem.endsWith('?') ? 'duvida' : 'ambigua';
  }

  return { conceitos, diagnostico, estado, rotulos, pontuar, pendentes, sugerir, confere, lerNumero, problema, totalVariantes, sortearVariante, identificarErro, desafio, tiposChat, numerosNoTexto, interpretarLocal, explicarConceito, lerComparacao };
})();

if (typeof module !== 'undefined') module.exports = Dominio;
