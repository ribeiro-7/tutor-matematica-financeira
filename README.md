# Juros em Jogo

Juros em Jogo é um protótipo de **Sistema de Tutoria Inteligente (ITS)** para o ensino de matemática financeira básica. O projeto foi desenvolvido para a disciplina **IA Aplicada à Educação (IMD0511)** por Gabriel do Nascimento Vieira e Arthur Ribeiro Pires.

O tutor ajuda o estudante a entender a diferença entre juros simples e compostos, calcular montantes e comparar opções como pagamento à vista e parcelado. A prática parte de conhecimentos prévios e usa o mapa de conceitos para indicar o que revisar.

## Como rodar

**Modo local.** Abra o arquivo [`index.html`](index.html) no navegador. O tutor usa regras do JavaScript para interpretar as mensagens. O mesmo modo funciona ao rodar o servidor com a chave em branco.

**Modo com Gemini.** Faça uma cópia de [`.env.example`](.env.example) chamada `.env` na pasta do projeto. Preencha `GEMINI_API_KEY=` com sua chave do Google AI Studio. O Git ignora o `.env`, e cada integrante mantém a própria chave. [Criar uma chave no Google AI Studio](https://aistudio.google.com/apikey)

Com Node.js 22 ou superior, execute na pasta do projeto:

```sh
node servidor.js
```

Abra [http://127.0.0.1:3000](http://127.0.0.1:3000). Nos 14 chats, o Gemini classifica mensagens em texto livre e pode selecionar um trecho do que o estudante escreveu para retomar a dúvida ou a tentativa. O JavaScript valida o trecho, escolhe as dicas, confere o gabarito e atualiza a pontuação. Se faltar a chave, a consulta falhar ou o trecho for inválido, o tutor continua com a orientação local. As notas e o histórico são reiniciados ao recarregar ou fechar a página.

## Como funciona

1. **Diagnóstico inicial.** O estudante responde a 14 questões, uma por conceito. Cada acerto inicia o conceito com 50 pontos. Os demais começam com 0.
2. **Mapa de conceitos.** As setas ligam cada pré-requisito ao conceito que depende dele. Os nós indicam o progresso em três níveis: iniciante (0–29), em progresso (30–69) e dominado (70–100).
3. **Prática no chat.** Ao selecionar um conceito, o estudante recebe um exercício. Se um pré-requisito direto estiver abaixo de 50 pontos, o tutor sugere revisá-lo e oferece a opção de continuar. Os valores dos exercícios variam a partir de modelos do projeto, e o código calcula e confere o gabarito.

Na prática, um acerto sem dica soma 15 pontos e um acerto com dica soma 7. O primeiro erro sem dica aciona uma pergunta-guia sem alterar a nota. Um erro com dica desconta 5 pontos, e abrir a resolução antes de enviar uma resposta numérica desconta 3. A nota fica entre 0 e 100.

## Estratégia Desafios Produtivos

A estratégia **Desafios Produtivos** (*Productive Failure*) aparece na primeira prática de **C9 — Montante em juros compostos**. O estudante compara duas aplicações fictícias que chegam ao mesmo saldo no primeiro mês, mas seguem regras diferentes de acréscimo.

1. **Exploração.** O tutor apresenta o problema e adapta a pergunta-guia ao raciocínio do aluno. Dúvidas de vocabulário e pedidos de ajuda recebem orientação sem contar como tentativas.
2. **Consolidação.** O tutor retoma a tentativa, compara o acréscimo fixo com o acréscimo sobre o saldo atualizado e só então apresenta a fórmula `M = C × (1 + i)ᵗ`.
3. **Prática.** Um problema com outros valores permite aplicar a ideia em uma nova situação. A pontuação passa a ser avaliada nesse exercício.

## Como testar

Conclua o diagnóstico. Se aparecer uma sugestão de revisão ao abrir um conceito, clique em **Tentar mesmo assim**. No modo com Gemini, confira se o tutor retoma um trecho do que você escreveu antes de dar a orientação.

- **C5.** Pergunte “Multiplico ou divido por 12?”. Confira se a dica orienta a converter o prazo para a unidade da taxa e se a nota só muda depois da resposta.
- **C9.** Pergunte “O que significa saldo?” e depois tente “As duas terminam com R$ 1.300 porque entram R$ 100 todo mês”. Confira se o tutor responde à dúvida, faz uma pergunta-guia e apresenta a fórmula na consolidação. A nota volta a ser avaliada em **Praticar com outro exemplo**.
- **C14.** Diga “Somei as parcelas sem trazer os valores para hoje”. Confira se o tutor orienta a comparar na mesma data. Envie o custo calculado para testar a correção.

Execute `node --test` para rodar os testes automatizados com respostas simuladas do Gemini, sem chave.

## Estrutura do código

| Arquivo | Responsabilidade |
| --- | --- |
| [`index.html`](index.html) | Estrutura da página e carregamento dos arquivos. |
| [`styles.css`](styles.css) | Layout responsivo, aparência do grafo e interface do chat. |
| [`dominio.js`](dominio.js) | Conceitos, pré-requisitos, questões, exercícios, gabaritos e regras de pontuação. |
| [`app.js`](app.js) | Fluxo do diagnóstico, renderização do grafo e interação com o tutor. |
| [`servidor.js`](servidor.js) | Servidor local e integração dos chats com o Gemini. |

## Como manter este README atualizado

Atualize este arquivo no mesmo commit ou pull request que alterar o comportamento documentado. Revise **Como rodar** se mudarem as dependências ou a configuração. Atualize a descrição do fluxo e o roteiro de teste quando mudarem o diagnóstico, o grafo, o chat ou a pontuação. Se a estrutura do código mudar, confira os caminhos e as responsabilidades na tabela.
