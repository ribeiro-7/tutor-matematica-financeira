# Juros em Jogo

Juros em Jogo é um protótipo de **Sistema de Tutoria Inteligente (ITS)** para o ensino de matemática financeira básica. O projeto foi desenvolvido para a disciplina **IA Aplicada à Educação (IMD0511)** por Gabriel do Nascimento Vieira e Arthur Ribeiro Pires.

O tutor ajuda o estudante a entender a diferença entre juros simples e compostos, calcular montantes e comparar opções como pagamento à vista e parcelado. A prática parte de conhecimentos prévios e usa o mapa de conceitos para indicar o que revisar.

## Como rodar

1. Clone ou baixe este repositório.
2. Abra o arquivo [`index.html`](index.html) em um navegador.

O protótipo usa HTML, CSS e JavaScript. Ele roda no próprio navegador, sem instalação, servidor ou chave de API. O chat responde com regras e mensagens predefinidas. As notas e o histórico ficam em memória durante a sessão e são reiniciados ao recarregar ou fechar a página.

## Como funciona

1. **Diagnóstico inicial.** O estudante responde a 14 questões, uma por conceito. Cada acerto inicia o conceito com 50 pontos. Os demais começam com 0.
2. **Mapa de conceitos.** As setas ligam cada pré-requisito ao conceito que depende dele. Os nós indicam o progresso em três níveis: iniciante (0–29), em progresso (30–69) e dominado (70–100).
3. **Prática no chat.** Ao selecionar um conceito, o estudante recebe um exercício. Se um pré-requisito direto estiver abaixo de 50 pontos, o tutor sugere revisá-lo e oferece a opção de continuar. Os valores dos exercícios variam a partir de modelos do projeto, e o código calcula e confere o gabarito.

Na prática, um acerto sem dica soma 15 pontos e um acerto com dica soma 7. O primeiro erro sem dica aciona uma pergunta-guia sem alterar a nota. Um erro com dica desconta 5 pontos, e abrir a resolução antes de enviar uma resposta numérica desconta 3. A nota fica entre 0 e 100.

## Estratégia Desafios Produtivos

A estratégia **Desafios Produtivos** (*Productive Failure*) aparece na primeira prática de **C9 — Montante em juros compostos**. O estudante compara duas aplicações fictícias que chegam ao mesmo saldo no primeiro mês, mas seguem regras diferentes de acréscimo.

1. **Exploração.** O tutor apresenta o problema e pede uma previsão ou uma explicação. Se necessário, oferece uma pergunta-guia sobre o saldo do segundo mês.
2. **Consolidação.** O tutor retoma a tentativa, compara o acréscimo fixo com o acréscimo sobre o saldo atualizado e só então apresenta a fórmula `M = C × (1 + i)ᵗ`.
3. **Prática.** Um problema com outros valores permite aplicar a ideia em uma nova situação. A exploração e a consolidação não alteram a nota do C9. A pontuação volta a ser aplicada nesse novo exercício.

### Como testar o C9

Conclua o diagnóstico e selecione **C9 — Montante em juros compostos** no mapa. Se aparecer uma sugestão de revisão, clique em **Tentar mesmo assim**. Envie uma hipótese como **“Acho que as duas terminam com R$ 1.300”** e responda à pergunta-guia. Confira se o tutor relaciona a hipótese à solução antes de apresentar a fórmula. Em seguida, clique em **Praticar com outro exemplo** e confira se o exercício atualiza a nota no mapa.

## Estrutura do código

| Arquivo | Responsabilidade |
| --- | --- |
| [`index.html`](index.html) | Estrutura da página e carregamento dos arquivos. |
| [`styles.css`](styles.css) | Layout responsivo, aparência do grafo e interface do chat. |
| [`dominio.js`](dominio.js) | Conceitos, pré-requisitos, questões, exercícios, gabaritos e regras de pontuação. |
| [`app.js`](app.js) | Fluxo do diagnóstico, renderização do grafo e interação com o tutor. |

## Como manter este README atualizado

Atualize este arquivo no mesmo commit ou pull request que alterar o comportamento documentado. Revise **Como rodar** se mudarem as dependências ou a configuração. Atualize **Como funciona**, **Estratégia 13** e o roteiro de teste quando mudarem o diagnóstico, o grafo, o chat ou a pontuação. Se a estrutura do código mudar, confira os caminhos e as responsabilidades na tabela.
