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

Abra [http://127.0.0.1:3000](http://127.0.0.1:3000). Nos 14 chats, o Gemini classifica mensagens em texto livre e pode selecionar um trecho do que o estudante escreveu para retomar a dúvida ou a tentativa. O JavaScript valida o trecho, escolhe as dicas, confere o gabarito e atualiza a pontuação. Se faltar a chave, a consulta falhar ou o trecho for inválido, o tutor continua com a orientação local.

**Progresso da sessão.** O navegador guarda o diagnóstico, as notas, as conversas, o exercício atual e o sorteio. Ao apertar F5 na mesma aba, você volta ao ponto em que parou. Se uma consulta ao Gemini estiver em andamento, a mensagem volta como rascunho para você reenviar. Para iniciar outra sessão, abra o tutor em uma aba nova.

## Como funciona

1. **Diagnóstico inicial.** O estudante escolhe um objetivo e responde a duas ou três questões sobre seus pré-requisitos diretos. Pode optar pelas 14 questões ou completar as restantes depois pelo botão **Diagnóstico** no mapa. Cada acerto garante pelo menos 50 pontos no conceito. Um erro inicia em 0 se o conceito ainda estiver sem nota.
2. **Trilha de fases.** As ligações mostram os pré-requisitos e o destaque **Próxima** indica uma sugestão de estudo. Os nós tracejados estão **Não avaliados**. A avaliação distingue iniciante (0–29), em progresso (30–69) e dominado (70–100). A trilha exibe a nota como XP e atribui uma, duas ou três estrelas ao atingir 30, 50 e 70 pontos. Ao abrir um tópico com pré-requisitos ainda não avaliados, o estudante pode avaliá-los naquele momento.
3. **Prática no chat.** Ao selecionar um conceito, o estudante recebe um exercício. Se um pré-requisito direto estiver abaixo de 50 pontos, o tutor sugere revisá-lo e oferece a opção de continuar. O sorteio guarda as variações já vistas por conceito durante a sessão. Quando todas aparecem, inicia uma nova rodada. Os demais conceitos têm quatro variações cada. O C9 tem 12, distribuídas entre cálculo direto, conversão de prazo e comparação de contas.

Na prática, um acerto sem dica soma 15 pontos e um acerto com dica soma 7. O primeiro erro sem dica aciona uma pergunta-guia sem alterar a nota. Um erro com dica desconta 5 pontos, e abrir a resolução antes de enviar uma resposta numérica desconta 3. A nota fica entre 0 e 100.

O JavaScript compara respostas incorretas com valores de erros previstos em C5, C9 e C14. Se houver uma coincidência clara, o tutor dá uma dica específica. Quando o erro sugere uma dificuldade com um pré-requisito, o chat oferece um atalho para revisá-lo. Por exemplo, usar o número de anos como expoente com uma taxa mensal no C9 sugere revisão do C5.

**Tirar dúvidas.** O botão **Tirar uma dúvida** abre uma conversa sobre os temas da trilha. Com o Gemini, uma pergunta de estudo recebe uma explicação em linguagem natural. Durante um exercício, o modelo recebe apenas o conceito e uma definição de referência. As respostas ficam no nível conceitual, sem calcular o exercício. Na exploração do C9, a explicação sobre juros compostos preserva a fórmula para a consolidação. Sem chave ou em caso de falha, o tutor usa o conteúdo local. A conversa fica na mesma sessão e não altera a pontuação.

## Estratégia Desafios Produtivos

A estratégia **Desafios Produtivos** (*Productive Failure*) aparece na primeira prática de **C9 — Montante em juros compostos**. O estudante compara duas aplicações fictícias que chegam ao mesmo saldo no primeiro mês, mas seguem regras diferentes de acréscimo.

1. **Exploração.** O tutor apresenta o problema e adapta a pergunta-guia ao raciocínio do aluno. Dúvidas de vocabulário e pedidos de ajuda recebem orientação sem contar como tentativas.
2. **Consolidação.** O tutor retoma a tentativa, compara o acréscimo fixo com o acréscimo sobre o saldo atualizado e só então apresenta a fórmula `M = C × (1 + i)ᵗ`.
3. **Prática.** O estudante aplica a ideia em exercícios com formatos diferentes. Na comparação, escolhe a conta A ou B e explica por que ela usa juros compostos. O JavaScript só corrige e pontua a comparação depois que há uma escolha e uma justificativa reconhecível.

## Como testar

Selecione **Calcular juros compostos** e responda às três questões sobre potenciação, período da taxa e juros sobre juros. Confira se o restante do mapa aparece como **Não avaliado** e se o botão **Diagnóstico** permite completar as 11 questões restantes. Se aparecer uma sugestão de revisão ao abrir um conceito, clique em **Tentar mesmo assim**. No modo com Gemini, confira se o tutor retoma um trecho do que você escreveu antes de dar a orientação.

Para testar a recuperação da sessão, aperte F5 no meio do diagnóstico ou depois de pedir uma dica no chat. Confira se a pergunta ou o exercício, a nota e o histórico são restaurados.

- **C5.** Pergunte “Multiplico ou divido por 12?”. Confira se a dica orienta a converter o prazo para a unidade da taxa e se a nota só muda depois da resposta.
- **C9.** Pergunte “O que significa saldo?” e depois tente “As duas terminam com R$ 1.300 porque entram R$ 100 todo mês”. Confira se a fórmula aparece na consolidação. Na prática, experimente os três formatos. Na comparação de contas, envie primeiro só A ou B e confira se o tutor pede a justificativa antes de alterar a nota.
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
