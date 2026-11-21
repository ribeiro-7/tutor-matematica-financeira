'use strict';

const Dominio = (() => {
  const reais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 6 });
  const moeda = (valor) => reais.format(valor);
  const numero = (valor) => decimal.format(valor);
  const percentual = (valor) => `${numero(valor)}%`;

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
  const pontuar = (nota, evento) => Math.min(100, Math.max(0, nota + eventos[evento]));
  const estado = (nota) => nota >= 70 ? 'mastered' : nota >= 30 ? 'progressing' : 'initial';
  const rotulos = { initial: 'Iniciante', progressing: 'Em progresso', mastered: 'Dominado' };
  const pendentes = (id, notas) => conceitos[id - 1].requisitos.filter((requisito) => notas[requisito] < 50);
  const sugerir = (notas, excluir) => [...conceitos]
    .sort((a, b) => a.nivel - b.nivel || a.id - b.id)
    .find(({ id }) => id !== excluir && notas[id] < 70 && pendentes(id, notas).length === 0);
  const confere = (valor, esperado) =>
    valor !== null && Math.abs(valor - esperado) <= Math.max(0.005, Math.abs(esperado) * 0.005);

  function lerNumero(texto) {
    const resultado = texto.trim().match(/^(?:R\$\s*)?([+-]?(?:\d+(?:[.,]\d+)*|[.,]\d+))\s*%?$/i);
    if (!resultado) return null;
    const original = resultado[1];
    if (!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+|\d{1,3}(?:\.\d{3})+(?:,\d+)?)$/.test(original)) return null;
    const brasileiro = original.includes(',') || /^[+-]?\d{1,3}(?:\.\d{3})+$/.test(original);
    const valor = Number(brasileiro ? original.replaceAll('.', '').replace(',', '.') : original);
    return Number.isFinite(valor) ? valor : null;
  }

  function problema(id, sorteio = Math.random) {
    const indice = Math.min(3, Math.floor(sorteio() * 4));
    const capital = [400, 500, 800, 1200][indice];
    const taxa = [5, 8, 10, 12][indice];
    const meses = [3, 4, 2, 5][indice];
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
      [`Se a taxa é mensal e a aplicação dura ${meses} anos, quantos períodos você deve usar?`, prazo, 'Cada ano contém 12 períodos mensais.', `${meses} × 12 = ${prazo} meses.`],
      [`Calcule apenas os juros simples de ${emComum}.`, juros, 'Encontre os juros de um mês sobre o capital inicial e multiplique pelo número de meses.', `${base} × ${numero(taxa / 100)} × ${meses} = ${moeda(juros)} em juros.`],
      [`Qual é o montante de ${emComum} em juros simples?`, simples, 'Some os juros de todos os meses ao capital inicial.', `Os juros são ${moeda(juros)}. Somando a ${base}, o saldo fica em ${moeda(simples)}.`],
      [`Você aplica ${base} a ${taxa}% ao mês em juros compostos. Quanto rende apenas o segundo mês?`, arredondar(montante(capital, taxa, 1) * taxa / 100), 'No segundo mês, a taxa incide sobre o saldo que já inclui os primeiros juros.', `O primeiro mês termina com ${moeda(montante(capital, taxa, 1))}. Aplicando ${taxa}% a esse saldo, o segundo mês rende ${moeda(montante(capital, taxa, 1) * taxa / 100)}.`],
      [`Qual é o montante de ${emComum} em juros compostos? Informe o saldo final em reais.`, composto, 'O saldo é multiplicado pelo mesmo fator em cada mês. Quantas vezes esse fator aparece?', `Multiplique ${base} por (1 + ${numero(taxa / 100)}) elevado a ${meses}. O montante é ${moeda(composto)}.`, simples],
      [`Compare ${emComum} nos dois regimes. Em reais, quanto a mais rende o regime composto?`, arredondar(composto - simples), 'Calcule o saldo de cada aplicação e subtraia o menor do maior.', `O saldo composto é ${moeda(composto)} e o simples é ${moeda(simples)}. A diferença é ${moeda(composto - simples)}.`],
      [`Qual é a taxa percentual equivalente a ${taxa}% ao mês por 2 meses em juros compostos?`, ((1 + taxa / 100) ** 2 - 1) * 100, 'Multiplique os dois fatores de crescimento e retire o 1 que representa o capital original.', `[(1 + ${numero(taxa / 100)})² − 1] × 100 = ${percentual(((1 + taxa / 100) ** 2 - 1) * 100)}.`],
      [`Uma compra tem duas parcelas de ${moeda(parcela)}, uma em 1 mês e outra em 2 meses. Com taxa de desconto de ${taxa}% ao mês, quanto valem as duas parcelas juntas hoje?`, hoje, 'Traga cada parcela separadamente para hoje. Use um período para a primeira e dois para a segunda.', `${moeda(parcela)} ÷ ${numero(1 + taxa / 100)} + ${moeda(parcela)} ÷ (${numero(1 + taxa / 100)})² = ${moeda(hoje)} em valor presente.`],
      [`Um investimento rende ${taxa}% no ano, com inflação de ${inflacao}%. Qual é o juro real em porcentagem? Arredonde a duas casas.`, arredondar(((1 + taxa / 100) / (1 + inflacao / 100) - 1) * 100), 'Divida o fator de crescimento do investimento pelo fator de crescimento dos preços.', `[(1 + ${numero(taxa / 100)}) ÷ (1 + ${numero(inflacao / 100)}) − 1] × 100 ≈ ${casas(((1 + taxa / 100) / (1 + inflacao / 100) - 1) * 100)}%.`],
      [`Uma compra custa ${moeda(precoVista)} à vista ou duas parcelas de ${moeda(parcela)}, em 1 e 2 meses. Com taxa de ${taxa}% ao mês, qual é o custo da opção mais barata, em valor de hoje?`, Math.min(precoVista, hoje), 'Traga as parcelas para o dia de hoje antes de comparar com o preço à vista.', `O preço à vista é ${moeda(precoVista)}. O valor presente das parcelas é ${moeda(hoje)}. A opção mais barata é ${precoVista < hoje ? 'à vista' : 'parcelada'}, por ${moeda(Math.min(precoVista, hoje))} em valor de hoje.`],
    ];
    const [enunciado, resposta, dica, resolucao, erroTipico] = respostas[id - 1];
    return { enunciado, resposta, dica, resolucao, erroTipico };
  }

  const desafio = {
    enunciado: 'Você tem R$ 1.000 em duas aplicações fictícias. A primeira acrescenta R$ 100 todo mês. A segunda acrescenta 10% sobre o saldo do início de cada mês. As duas chegam a R$ 1.100 no primeiro mês. Ao fim de três meses, qual terá o maior saldo? Conte como você chegou à resposta.',
    consolida: 'Na primeira aplicação, entram R$ 100 todo mês: o saldo chega a R$ 1.300. Na segunda, a base muda: R$ 1.000 → R$ 1.100 → R$ 1.210 → R$ 1.331. A segunda tem o maior saldo.',
    formaliza: 'Cada mês multiplica o saldo por 1,10. Generalizando, M = C × (1 + i)ᵗ. C é o capital inicial, i é a taxa em decimal e t conta os períodos em que o fator se repete.',
  };

  function interpretarTentativa(texto) {
    const tentativa = texto.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const valores = (tentativa.match(/\d+(?:[.,]\d+)*/g) || []).map(lerNumero);
    const saldoVariavel = /(?:saldo|base).{0,22}(?:muda|vari|atual|anterior)|juros sobre juros|capitaliz|multiplic.{0,24}1[,.]10/.test(tentativa);
    const fixo = /empat|iguais|mesm[oa] (?:saldo|valor)|100 (?:a cada|todo|por) mes/.test(tentativa);
    if (saldoVariavel || valores.includes(1331)) return 'variavel';
    if (fixo || (valores.includes(1300) && !valores.includes(1210))) return 'fixo';
    if (valores.includes(1210) || valores.includes(110)) return 'intermediario';
    return 'outra';
  }

  return { conceitos, diagnostico, estado, rotulos, pontuar, pendentes, sugerir, confere, lerNumero, problema, desafio, interpretarTentativa };
})();

if (typeof module !== 'undefined') module.exports = Dominio;
