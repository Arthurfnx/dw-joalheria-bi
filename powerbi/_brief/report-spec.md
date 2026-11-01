# Report Spec — relatorio_joalheria_demo (página 1: Visão Geral)

> Especificação fechada fornecida e aprovada pelo usuário em 2026-11-01
> (atalho "sufficient-input locked-spec" da skill `powerbi-report-cli`).
> Esta etapa cobre **somente a página 1 — Visão Geral**. As páginas 2 a 6 dependem de nova aprovação.

## Report identity
- Report name: relatorio_joalheria_demo
- Semantic model: relatorio_joalheria_demo.SemanticModel (Import, PostgreSQL `dw_joalheria`, esquema `bi_demo`)
- Audience: gestão da joalheria / banca acadêmica — leitura executiva rápida
- Primary purpose: visão consolidada de receita, vendas, peças e estoque no ambiente demonstrativo
- Delivery target: PBIP local apenas (sem publicação)

## Semantic model binding
- Entry mode: Local Model
- Model name: relatorio_joalheria_demo
- connectionString: byPath `../relatorio_joalheria_demo.SemanticModel` (mantido)

## User decisions and constraints
- Scope: uma página nova ("Visão Geral"); a página de testes existente ("Página 1") é preservada sem alteração de conteúdo.
- Interactivity: filtros na própria página — Ano (dropdown), Período (intervalo de datas), Material (dropdown); filtragem cruzada padrão entre visuais.
- Design direction: claro, moderno, elegante, corporativo; grafite + dourado discreto + branco.
- Publishing: proibido nesta etapa. Tooling: Power BI Modeling MCP + `powerbi-report-author` 0.5.0.
- Model edit permissions: somente medidas novas na tabela `Medidas`; relacionamentos e as 8 medidas existentes intocados.
- Accessibility: contraste AA, texto alternativo nos gráficos, fonte mínima 10 pt.
- Data caveats: dados 100% sintéticos (`SINTETICO_DEMO`); estoque em snapshots mensais (fim de mês); identificador de venda artificial; sem margem/CMV/giro.

## Narrative
- Core story: quanto a joalheria (demo) faturou, como a receita evoluiu mês a mês, quais materiais concentram receita e qual o estoque atual por material.
- Key questions: receita total? nº de vendas e peças? ticket médio? tendência mensal? receita e estoque por material?

## Design identity
- Tone: "Joalheria corporativa" — superfície creme clara, cartões brancos, grafite para dados de receita, dourado discreto como acento.
- Signature: faixa grafite de aviso no topo com texto dourado + cartões brancos com cantos de 8 px e borda areia.

## Design system summary
- Theme: `JoalheriaGrafite` (custom, derivado de `base.json` da skill). Página `#F6F4EF`; cartões `#FFFFFF`; borda `#E5DFD3`.
- Color semantics: Receita Realizada → grafite `#2B2D31`; Estoque Atual (Peças) → dourado `#A8874E`.
- Typography: Segoe UI (corpo) / Segoe UI Semibold (títulos).
- Layout: FHD 1920×1080, margem 32, gutter 24, snap 8.

## Model requirements
- Existing measures: Receita Realizada, Quantidade Vendida, Número de Vendas, Ticket Médio e as 4 "(Exibição)".
- New measures (já criadas e salvas): Estoque Atual (Peças) [03 - Estoque], Data da Posição de Estoque [03 - Estoque], Período Selecionado (Exibição) [05 - Análises temporais].
- Relationship/sort requirements: nenhuma alteração.

## Canonical design contract

```yaml
Design Brief:
  generated_by: powerbi-report-cli
  contract_version: 1
  mode: brownfield
  design_identity:
    tone: "Joalheria corporativa: creme claro, cartões brancos, grafite e dourado discreto"
    signature: "Faixa grafite de aviso com texto dourado + cartões brancos com cantos de 8 px"
    current_tone: indistinct
    current_signature: none
  archetype: Executive
  navigation_model: page_navigator
  color_map:
    - measure: Medidas[Receita Realizada]
      color: "#2B2D31"
      tint: "#E7E5E1"
    - measure: Medidas[Estoque Atual (Peças)]
      color: "#A8874E"
      tint: "#EFE6D2"
  pages:
    - name: "Visão Geral — receita, vendas e estoque"
      role: landing
      archetype: Executive
      layout_variant: A
      variant_rationale: "Quatro KPIs de soma simples + uma série mensal de 24 pontos + dois cortes por material de 3 categorias: faixa de KPIs seguida de grade 2×2 equilibrada."
      navigation: []
      page_background: "#F6F4EF"
      layout_summary: "Faixa de aviso; cabeçalho com título à esquerda e 3 filtros à direita; faixa de KPIs; linha 2 com tendência mensal (larga) e receita por material; linha 3 com bloco informativo (largo) e estoque por material, alinhando os dois cortes por material na coluna direita."
      layout_contract:
        canvas: { width: 1920, height: 1080, margin: 32, gutter: 24, snap: 8 }
        grid:
          columns: 12
          rows: 12
          regions:
            banner:   [1, 1, 13, 2]
            header:   [1, 2, 8, 3]
            filters:  [8, 2, 13, 3]
            kpis:     [1, 3, 13, 4]
            trend:    [1, 4, 8, 8]
            material: [8, 4, 13, 8]
            info:     [1, 8, 8, 13]
            stock:    [8, 8, 13, 13]
        placements:
          - id: demo_banner
            region: banner
            kind: textbox
            text: "AMBIENTE DEMONSTRATIVO — DADOS SINTÉTICOS, NÃO REPRESENTAM RESULTADOS REAIS DA EMPRESA."
            purpose: "Identificação obrigatória do ambiente demonstrativo."
          - id: page_title
            region: header
            kind: textbox
            text: "Visão Geral — receita, vendas e estoque"
            purpose: "Anunciar o escopo da página antes dos números."
          - id: page_subtitle
            region: header
            kind: textbox
            text: "Joalheria demonstrativa · use os filtros de Ano, Período e Material"
          - id: year_slicer
            region: filters
            kind: slicer
            field_bindings: bi_demo vw_dim_data[ano]
            slicer_type: dropdown
            slot: 1
            of: 3
          - id: period_slicer
            region: filters
            kind: slicer
            field_bindings: bi_demo vw_dim_data[data]
            slicer_type: between
            insight_basis: "O usuário pediu explicitamente filtro de Período além do Ano."
            slot: 2
            of: 3
          - id: material_slicer
            region: filters
            kind: slicer
            field_bindings: bi_demo vw_dim_produto[material]
            slicer_type: dropdown
            slot: 3
            of: 3
          - id: kpi_strip
            region: kpis
            kind: cardVisual
            purpose: "Quanto foi faturado, quantas vendas, quantas peças e qual o ticket médio?"
            field_bindings: [Medidas[Receita Realizada (Exibição)], Medidas[Número de Vendas (Exibição)], Medidas[Quantidade Vendida (Exibição)], Medidas[Ticket Médio (Exibição)]]
            color_strategy: none
          - id: revenue_trend
            region: trend
            kind: lineChart
            purpose: "Como a receita realizada evoluiu mês a mês entre jan/2024 e dez/2025?"
            field_bindings: { Category: bi_demo vw_dim_data[ano_mes], Y: Medidas[Receita Realizada] }
            sort_policy: natural_order
            color_strategy: measure_match
          - id: revenue_by_material
            region: material
            kind: barChart
            purpose: "Quais materiais (Ouro, Prata, Folheado) concentram a receita?"
            field_bindings: { Category: bi_demo vw_dim_produto[material], Y: Medidas[Receita Realizada] }
            sort_policy: value_desc
            color_strategy: measure_match
          - id: info_container
            region: info
            kind: shape
            purpose: "Fundo do bloco informativo (sem dados)."
          - id: info_heading
            region: info
            kind: textbox
            text: "Sobre os dados desta demonstração"
          - id: info_context
            region: info
            kind: cardVisual
            purpose: "Qual período está filtrado e qual posição de estoque está sendo exibida?"
            field_bindings: [Medidas[Período Selecionado (Exibição)], Medidas[Data da Posição de Estoque]]
            insight_basis: "Contexto dinâmico do filtro e da data do snapshot; não repete nenhuma medida dos gráficos."
            color_strategy: none
          - id: info_note
            region: info
            kind: textbox
            text: "Caráter sintético, período coberto, granularidade mensal do estoque e limitações (ID de venda artificial, sem margem/CMV/giro)."
          - id: stock_by_material
            region: stock
            kind: barChart
            purpose: "Qual o estoque em peças por material na posição mais recente disponível?"
            field_bindings: { Category: bi_demo vw_dim_produto[material], Y: "Medidas[Estoque Atual (Peças)]", Tooltips: Medidas[Data da Posição de Estoque] }
            sort_policy: value_desc
            color_strategy: measure_match
        space_audit:
          content_cell_count: 120
          placed_cell_count: 120
          empty_cell_pct: 0
          unplaced_regions: []
          largest_region: { name: trend, pct_of_content: 23 }
          balance_rationale: "Faixa de KPIs + grade 2×2; a tendência mensal (24 pontos) recebe a maior área; os dois cortes por material ficam alinhados na coluna direita para comparação; o bloco informativo ocupa a área restante com contexto dinâmico e ressalvas obrigatórias."
  interaction_pattern:
    drill_targets: []
    cross_filter_rules: "Filter (padrão) entre todos os visuais; slicers filtram a página."
  accessibility:
    alt_text_strategy: chart+structure
    contrast_notes: "Texto dourado #E3C98F sobre grafite #2B2D31 na faixa; textos secundários #5F6368 sobre branco."
  theme:
    base: "references/design/assets/base.json adaptado (JoalheriaGrafite)"
    user_overrides: "Nenhum tema anterior além do base Fluent2; preservado como baseTheme."
```

## Implementation notes
- Model changes: nenhuma nesta etapa além das 3 medidas já criadas e salvas.
- PBIR: página nova + tema custom registrado em `report.json`; `pages.json` com a Visão Geral em primeiro.
- Validation: `powerbi-report-author validate`, DAX das medidas, reload no Desktop e captura de tela.
- Publishing boundary: nenhuma publicação.
- Risks: o tema é global e também altera a aparência da "Página 1" de testes.
