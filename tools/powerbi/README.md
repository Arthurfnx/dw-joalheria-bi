# Ferramentas do relatório Power BI (PBIR)

Scripts Node.js usados para construir as páginas do relatório
`powerbi/relatorio_joalheria_demo.Report` e para exportar as medidas do modelo semântico.

> **Fonte da verdade:** os arquivos PBIP/PBIR e TMDL versionados em `powerbi/`.
> Os geradores abaixo são o **registro de como as páginas foram construídas**, não um
> processo de build. O PBIR atual contém ajustes posteriores (ver "Divergências") e
> propriedades que o Power BI Desktop acrescenta ao salvar. **Não execute um gerador sobre o
> projeto oficial** sem backup e revisão do diff.

## Dependências

| Item | Versão usada | Observação |
|---|---|---|
| Node.js | 22.15 (requer ≥ 20) | Somente módulos nativos (`fs`, `path`); nenhum pacote npm |
| CLI `powerbi-report-author` (`@microsoft/powerbi-report-authoring-cli`) | 0.5.0, instalada globalmente | Opcional: validação (`validate`) e pré-visualização no Desktop (`preview`) |
| Power BI Desktop | instalado pelo usuário | Para recarregar e conferir as páginas |

## Arquivos

| Arquivo | Página (ID PBIR) | O que faz |
|---|---|---|
| `pbir_lib.js` | — | Biblioteca comum das páginas 2 a 6: cabeçalho com aviso, filtros, cartões de KPI, gráficos de barras/colunas, gravação da página |
| `gerar_visao_geral.js` | Visão Geral (`a7c3e91f5b2d48e6a0f1`) | Página 1; também grava o tema `JoalheriaGrafite-9c41d7a2.json`, registra-o em `report.json` e ajusta `pages.json`. Não usa `pbir_lib.js` |
| `gerar_paginas_2_3.js` | Estoque e Produtos (`b2d4f60a1c3e5a7b9d02`), Vendas (`c3e5a7b9d1f2a4c6e803`) | Argumento `2`, `3` ou `todas` |
| `gerar_pagina_4.js` | Compras e Custos (`d4f6a8c0e2b4d6f8a004`) | |
| `gerar_pagina_5.js` | Movimentações de Estoque (`e5a7c9e1f3b5d7f9a005`) | |
| `gerar_pagina_6.js` | Sazonalidade e Associação (`f6b8d0a2c4e6f8a0b006`) | |
| `exportar_medidas_dax.js` | — | Lê `Medidas.tmdl` (somente leitura) e gera `powerbi/measures.dax`. **Criado na consolidação de 2026-11-01** (não fazia parte da construção) |
| `ajustes/*.js` | páginas 5 e 6 | Correções pontuais aplicadas depois da geração (ver abaixo) |

Cada gerador **apaga e recria** a pasta da sua página (`definition/pages/<id>`) e atualiza a ordem
em `pages.json`. As demais páginas não são tocadas.

## Uso

Exportar as medidas (seguro; não altera o modelo):

```powershell
node tools\powerbi\exportar_medidas_dax.js powerbi\relatorio_joalheria_demo.SemanticModel\definition\tables\Medidas.tmdl powerbi\measures.dax
```

Todos os geradores e ajustes **exigem** a pasta `.Report` de destino como 1º argumento. Sem argumento,
ou com uma pasta sem `definition/report.json`, mostram a mensagem de uso e encerram com código 1, sem
escrever nenhum arquivo. Não há destino padrão.

Preparar uma cópia de trabalho fora do repositório (relatório, modelo e `.pbip`, para que a validação
encontre o modelo pelo caminho relativo):

```powershell
$copia = Join-Path $env:TEMP 'pbip_trabalho'
New-Item -ItemType Directory $copia | Out-Null
Copy-Item powerbi\relatorio_joalheria_demo.Report, powerbi\relatorio_joalheria_demo.SemanticModel, powerbi\relatorio_joalheria_demo.pbip $copia -Recurse
$rep = Join-Path $copia 'relatorio_joalheria_demo.Report'
```

Regenerar uma página na cópia e validar:

```powershell
node tools\powerbi\gerar_pagina_4.js $rep
powerbi-report-author validate $rep
```

Para aplicar no projeto oficial (somente com autorização), informar explicitamente
`powerbi\relatorio_joalheria_demo.Report` como argumento e seguir:
1. o Power BI Desktop deve estar sem alterações pendentes
   (`powerbi-report-author preview <pasta .Report> --host desktop --status` → `hasUnsavedChanges: false`);
2. gerar, validar, recarregar (`--reload`) e capturar a página;
3. salvar no Desktop (Ctrl+S): todo reload deixa o Desktop com alterações pendentes.

As medidas usadas pelas páginas precisam existir no modelo (foram criadas pelo Power BI Modeling MCP;
estão em `Medidas.tmdl`). Os geradores não criam medidas.

## Divergências entre os geradores e o PBIR atual

| Página | Situação do gerador |
|---|---|
| Visão Geral | Corresponde à versão aplicada |
| Estoque e Produtos, Vendas | Correspondem (o gerador já inclui os rótulos `OutsideEnd` da página 3) |
| Compras e Custos | Corresponde (inclui a unidade de exibição "Nenhuma" nos KPIs) |
| Movimentações de Estoque | Corresponde (inclui larguras 656/344 e o subtítulo final) |
| Sazonalidade e Associação | O gerador sozinho produz a tabela de janelas anterior (coluna Ano, fonte 8, título "Janelas comerciais por ano"). A versão aprovada é reproduzida pela sequência abaixo |

Em todas as páginas, o PBIR salvo pelo Desktop contém propriedades padrão adicionais que os
geradores não escrevem.

### Reprodução da página 6

Sequência, sobre a cópia de trabalho (`$rep`, ver "Uso"):

```powershell
node tools\powerbi\gerar_pagina_6.js $rep
node tools\powerbi\ajustes\opcao_b_janelas.js $rep
node tools\powerbi\ajustes\renomear_titulo_janelas.js $rep
```

`ajustes_finais_p6.js` já está incorporado ao gerador (subtítulo do Top 10 e fonte 8, depois
substituída pela 9) e `ocultar_subtitulo_janelas.js` é desfeito por `opcao_b_janelas.js`; incluí-los
na sequência não altera o resultado.

Conferido em 2026-11-01 numa cópia temporária, comparando o JSON arquivo a arquivo com o PBIR versionado:
- 20 arquivos nos dois lados (`page.json` + 19 visuais); `pages.json` idêntico;
- 11 arquivos com JSON idêntico, inclusive a tabela de janelas (`f6b8d0a2c4e6000b0000`): título
  "Janelas comerciais", subtítulo visível, 5 colunas (Janela comercial, Dias, Receita, Peças,
  Receita/dia), fonte 9, sem filtro de Ano;
- nos outros 9 visuais (4 segmentações e 5 gráficos), a única diferença é `"active": true` na
  primeira projeção, propriedade que o Power BI Desktop acrescenta ao salvar e que o gerador não escreve.
  Diferença aceita pelo usuário (2026-11-01) como normalização do Desktop: os geradores e o
  `pbir_lib.js` não forçam essa propriedade. Ao comparar uma página gerada com o PBIR salvo, `active`
  deve ser desconsiderado;
- `powerbi-report-author validate`: mesmo resultado do PBIR versionado (2 erros antigos de `$schema`
  no `.pbip` e no `definition.pbir`, 1 aviso de esquema inacessível).

## Ajustes pontuais (`ajustes/`) — históricos, já aplicados

Executados uma única vez, alterando apenas as propriedades indicadas. Exigem a pasta `.Report` de
destino como argumento (sem padrão) e têm guardas que interrompem a execução se o visual não estiver
no estado esperado. **Não reexecutar sobre o projeto oficial**; para testes, passar sempre o caminho
de uma cópia de trabalho.

| Script | Alteração |
|---|---|
| `ajustar_posicoes_p5.js` | Página 5: largura do gráfico de saldo 560→656 e do gráfico por material 440→344 (x 616→712) |
| `ajustar_subtitulo_p5.js` | Página 5: subtítulo de "Entradas e saídas por material" |
| `ajustes_finais_p6.js` | Página 6: subtítulo do Top 10 por lift e fonte 8 na tabela de janelas |
| `ocultar_subtitulo_janelas.js` | Página 6: ocultou o subtítulo da tabela de janelas (depois revertido por `opcao_b_janelas.js`) |
| `opcao_b_janelas.js` | Página 6: removeu a coluna Ano da tabela de janelas, restaurou o subtítulo e a fonte 9 |
| `renomear_titulo_janelas.js` | Página 6: título "Janelas comerciais por ano" → "Janelas comerciais" |

## Origem

Recuperados em 2026-11-01 da pasta temporária da sessão do Claude Code que construiu o relatório.
Os originais são mantidos em um backup local, fora do repositório.

Alterações em relação aos originais (nenhuma muda a lógica dos visuais):
- todos os geradores e ajustes exigem a pasta `.Report` de destino e mostram uma mensagem de uso
  quando ela falta ou é inválida; `gerar_paginas_2_3.js` também recusa um 2º argumento diferente de `2`,
  `3` ou `todas`;
- os ajustes deixaram de ter caminhos absolutos (`path.join` sobre o argumento).
