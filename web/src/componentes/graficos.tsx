"use client";

// Gráficos em SVG próprio, sem biblioteca: nada de eval (política de conteúdo
// de produção) e nenhuma dependência nova. Cada gráfico mede a largura do
// contêiner e desenha nela, para caber a 360 px sem rolagem horizontal (RN-115).
// Uma série por gráfico, numa única unidade (RN-114).

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { formatarPercentual, marcasDoEixo, rotuloEixo, type PontoGrafico, type SerieGrafico } from "@/web/indicadores";

const COR_SERIE = "var(--color-primaria)";
// Paleta categórica de ordem fixa (validada para daltonismo); a 8ª fatia é sempre "Outros", em cinza.
const PALETA = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6"];
const COR_OUTROS = "#a8a29e";
const FONTE = 12;

function useLargura<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setLargura(Math.floor(el.getBoundingClientRect().width));
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, []);
  return [ref, largura];
}

interface PropsGrafico {
  titulo: string;
  descricao: string;
}

/** Moldura acessível: o SVG é uma imagem com título e descrição (RN-115). */
function SvgAcessivel({
  titulo,
  descricao,
  largura,
  altura,
  interativo = false,
  children,
}: PropsGrafico & { largura: number; altura: number; interativo?: boolean; children: ReactNode }) {
  const id = useId();
  return (
    <svg
      // Com links dentro, "img" esconderia os links dos leitores de tela; vira um grupo.
      role={interativo ? "group" : "img"}
      aria-labelledby={`${id}-t ${id}-d`}
      width={largura}
      height={altura}
      viewBox={`0 0 ${largura} ${altura}`}
      className="block max-w-full overflow-visible"
    >
      <title id={`${id}-t`}>{titulo}</title>
      <desc id={`${id}-d`}>{descricao}</desc>
      {children}
    </svg>
  );
}

function Dica({ ponto, x, larguraTotal }: { ponto: PontoGrafico; x: number; larguraTotal: number }) {
  // Mantém a dica dentro do gráfico nas pontas.
  const esquerda = Math.min(Math.max(x - 70, 0), Math.max(larguraTotal - 140, 0));
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-0 w-[140px] rounded-md border border-borda bg-superficie px-2 py-1 text-xs shadow-sm"
      style={{ left: esquerda }}
    >
      <p className="text-texto-suave">{ponto.rotuloLongo}</p>
      <p className="font-semibold text-texto">{ponto.texto}</p>
    </div>
  );
}

/**
 * Série no tempo: linha ou colunas. Eixo vertical a partir de zero, rótulos
 * de mês espaçados conforme a largura e dica ao passar o dedo ou o mouse.
 */
export function GraficoTempo({ serie, tipo, ...props }: PropsGrafico & { serie: SerieGrafico; tipo: "linha" | "colunas" }) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const [ativo, setAtivo] = useState<number | null>(null);
  const altura = 240;
  const pontos = serie.pontos;
  const marcas = marcasDoEixo(Math.max(0, ...pontos.map((p) => p.valor)));
  const topo = marcas[marcas.length - 1];
  const rotulosY = marcas.map((m) => rotuloEixo(m, serie.unidade));
  const margem = { esquerda: Math.max(...rotulosY.map((r) => r.length)) * 7 + 8, direita: 8, topo: 44, base: 24 };
  const larguraPlot = Math.max(largura - margem.esquerda - margem.direita, 10);
  const alturaPlot = altura - margem.topo - margem.base;
  const passoX = larguraPlot / Math.max(pontos.length, 1);
  const xDe = (i: number) => margem.esquerda + passoX * i + passoX / 2;
  const yDe = (v: number) => margem.topo + alturaPlot - (v / topo) * alturaPlot;
  // Um rótulo de mês a cada ~48 px, sempre incluindo o último (mês corrente).
  const cadaQuantos = Math.max(1, Math.ceil(48 / passoX));
  const mostrarRotulo = (i: number) => (pontos.length - 1 - i) % cadaQuantos === 0;

  function aoMover(evento: React.PointerEvent<SVGRectElement>) {
    const caixa = evento.currentTarget.getBoundingClientRect();
    const i = Math.floor((evento.clientX - caixa.left) / passoX);
    setAtivo(i >= 0 && i < pontos.length ? i : null);
  }

  return (
    <div ref={ref} className="relative w-full min-w-0">
      {largura > 0 ? (
        <>
          <SvgAcessivel {...props} largura={largura} altura={altura}>
            {marcas.map((m, i) => (
              <g key={m}>
                <line
                  x1={margem.esquerda}
                  x2={largura - margem.direita}
                  y1={yDe(m)}
                  y2={yDe(m)}
                  stroke="var(--color-borda)"
                  strokeWidth={1}
                />
                <text x={margem.esquerda - 6} y={yDe(m)} dy="0.32em" textAnchor="end" fontSize={FONTE} fill="var(--color-texto-suave)">
                  {rotulosY[i]}
                </text>
              </g>
            ))}
            {pontos.map((p, i) =>
              mostrarRotulo(i) ? (
                <text key={p.rotulo} x={xDe(i)} y={altura - 6} textAnchor="middle" fontSize={FONTE} fill="var(--color-texto-suave)">
                  {p.rotulo}
                </text>
              ) : null,
            )}
            {tipo === "colunas"
              ? pontos.map((p, i) => {
                  const larguraBarra = Math.max(Math.min(passoX - 2, 28), 2);
                  const h = Math.max(yDe(0) - yDe(p.valor), p.valor > 0 ? 1 : 0);
                  return (
                    <rect
                      key={p.rotulo}
                      x={xDe(i) - larguraBarra / 2}
                      y={yDe(0) - h}
                      width={larguraBarra}
                      height={h}
                      rx={Math.min(3, larguraBarra / 2)}
                      fill={COR_SERIE}
                      opacity={ativo === null || ativo === i ? 1 : 0.55}
                    />
                  );
                })
              : (
                <>
                  <polyline
                    points={pontos.map((p, i) => `${xDe(i)},${yDe(p.valor)}`).join(" ")}
                    fill="none"
                    stroke={COR_SERIE}
                    strokeWidth={2}
                    strokeLinejoin="round"
                  />
                  {ativo !== null ? (
                    <>
                      <line x1={xDe(ativo)} x2={xDe(ativo)} y1={margem.topo} y2={yDe(0)} stroke="var(--color-texto-suave)" strokeDasharray="3 3" />
                      <circle cx={xDe(ativo)} cy={yDe(pontos[ativo].valor)} r={4} fill={COR_SERIE} stroke="var(--color-superficie)" strokeWidth={2} />
                    </>
                  ) : null}
                </>
              )}
            <rect
              x={margem.esquerda}
              y={margem.topo}
              width={larguraPlot}
              height={alturaPlot}
              fill="transparent"
              onPointerMove={aoMover}
              onPointerDown={aoMover}
              onPointerLeave={() => setAtivo(null)}
            />
          </SvgAcessivel>
          {ativo !== null ? <Dica ponto={pontos[ativo]} x={xDe(ativo)} larguraTotal={largura} /> : null}
        </>
      ) : (
        <div style={{ height: altura }} />
      )}
    </div>
  );
}

/**
 * Comparação entre itens: barras horizontais, do maior para o menor, com o
 * valor escrito ao fim de cada barra. O nome fica acima da barra, para caber no celular.
 */
export function GraficoBarras({
  serie,
  ordenar = true,
  ...props
}: PropsGrafico & { serie: SerieGrafico; /** `false` mantém a ordem recebida (ex.: anos). */ ordenar?: boolean }) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const pontos = ordenar ? [...serie.pontos].sort((a, b) => b.valor - a.valor) : serie.pontos;
  const interativo = pontos.some((p) => p.href);
  const maior = Math.max(1, ...pontos.map((p) => p.valor));
  const linha = 40;
  const altura = pontos.length * linha;
  const espacoValor = 92;
  const larguraBarraMax = Math.max(largura - espacoValor, 10);
  // Nomes são cadastrados pelo administrador e podem crescer: corta o que não cabe
  // na largura (cerca de 7 px por caractere) para não vazar a 360 px; o nome inteiro fica na dica.
  const maxCaracteres = Math.max(Math.floor(largura / 7), 8);
  const cortar = (t: string) => (t.length > maxCaracteres ? `${t.slice(0, maxCaracteres - 1)}…` : t);
  return (
    <div ref={ref} className="w-full min-w-0">
      {largura > 0 ? (
        <SvgAcessivel {...props} largura={largura} altura={altura} interativo={interativo}>
          {pontos.map((p, i) => {
            const y = i * linha;
            const w = Math.max((p.valor / maior) * larguraBarraMax, p.valor > 0 ? 2 : 0);
            const conteudo = (
              <>
                <text x={0} y={y + 12} fontSize={FONTE} fill="var(--color-texto)">
                  <title>{p.rotuloLongo}</title>
                  {cortar(p.rotulo)}
                </text>
                <rect x={0} y={y + 18} width={w} height={14} rx={3} fill={COR_SERIE} />
                <text x={w + 6} y={y + 25} dy="0.32em" fontSize={FONTE} fill="var(--color-texto-suave)">
                  {p.texto}
                </text>
              </>
            );
            if (!p.href) return <g key={p.rotulo}>{conteudo}</g>;
            // A linha inteira (40 px de altura) é a área clicável, para funcionar no celular.
            return (
              <a
                key={p.rotulo}
                href={p.href}
                aria-label={`${p.rotuloLink ?? `Ver ${p.rotuloLongo}`}: ${p.texto}`}
                className="group cursor-pointer outline-none"
              >
                <rect
                  x={0}
                  y={y + 1}
                  width={largura}
                  height={linha - 2}
                  rx={4}
                  fill="transparent"
                  className="group-hover:fill-fundo group-focus-visible:stroke-primaria group-focus-visible:stroke-2"
                />
                {conteudo}
              </a>
            );
          })}
        </SvgAcessivel>
      ) : (
        <div style={{ height: altura }} />
      )}
    </div>
  );
}

const MAX_FATIAS = 7;

/** Agrupa a partir da 8ª parte em "Outros": cor nunca se repete nem é gerada. */
function fatias(serie: SerieGrafico): Array<PontoGrafico & { cor: string }> {
  const ordenados = [...serie.pontos].filter((p) => p.valor > 0).sort((a, b) => b.valor - a.valor);
  if (ordenados.length <= MAX_FATIAS + 1) return ordenados.map((p, i) => ({ ...p, cor: PALETA[i] ?? COR_OUTROS }));
  const principais = ordenados.slice(0, MAX_FATIAS).map((p, i) => ({ ...p, cor: PALETA[i] }));
  const resto = ordenados.slice(MAX_FATIAS);
  const soma = resto.reduce((s, p) => s + p.valor, 0);
  return [
    ...principais,
    {
      rotulo: `Outros (${resto.length})`,
      rotuloLongo: `Outros (${resto.length})`,
      valor: soma,
      texto: `${new Intl.NumberFormat("pt-BR").format(soma)} ${soma === 1 ? "peça" : "peças"}`,
      cor: COR_OUTROS,
    },
  ];
}

/** Composição: rosca com o total no centro e legenda com valor e participação. */
export function GraficoRosca({ serie, rotuloTotal, ...props }: PropsGrafico & { serie: SerieGrafico; rotuloTotal: string }) {
  const partes = fatias(serie);
  const total = partes.reduce((s, p) => s + p.valor, 0);
  const tamanho = 200;
  const raio = 90;
  const espessura = 30;
  const c = tamanho / 2;
  const arcos = partes.map((p, i) => {
    const fracao = total > 0 ? p.valor / total : 0;
    const anterior = partes.slice(0, i).reduce((s, q) => s + q.valor, 0);
    const inicio = -Math.PI / 2 + (total > 0 ? anterior / total : 0) * Math.PI * 2;
    const fim = inicio + fracao * Math.PI * 2;
    return { ...p, inicio, fim, fracao };
  });
  const r = raio - espessura / 2;
  const ponto = (a: number) => `${c + r * Math.cos(a)},${c + r * Math.sin(a)}`;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <div className="w-[200px] max-w-full shrink-0">
        <SvgAcessivel {...props} largura={tamanho} altura={tamanho}>
          {arcos.map((a) =>
            a.fracao >= 0.9999 ? (
              <circle key={a.rotulo} cx={c} cy={c} r={r} fill="none" stroke={a.cor} strokeWidth={espessura} />
            ) : (
              <path
                key={a.rotulo}
                d={`M ${ponto(a.inicio)} A ${r} ${r} 0 ${a.fim - a.inicio > Math.PI ? 1 : 0} 1 ${ponto(a.fim)}`}
                fill="none"
                stroke={a.cor}
                strokeWidth={espessura}
              />
            ),
          )}
          {/* Separação de 2 px entre fatias, na cor da superfície. */}
          {arcos.length > 1
            ? arcos.map((a) => (
                <line
                  key={`s-${a.rotulo}`}
                  x1={c + (raio - espessura) * Math.cos(a.inicio)}
                  y1={c + (raio - espessura) * Math.sin(a.inicio)}
                  x2={c + raio * Math.cos(a.inicio)}
                  y2={c + raio * Math.sin(a.inicio)}
                  stroke="var(--color-superficie)"
                  strokeWidth={2}
                />
              ))
            : null}
          <text x={c} y={c - 6} textAnchor="middle" fontSize={20} fontWeight={600} fill="var(--color-texto)">
            {new Intl.NumberFormat("pt-BR").format(total)}
          </text>
          <text x={c} y={c + 14} textAnchor="middle" fontSize={FONTE} fill="var(--color-texto-suave)">
            {rotuloTotal}
          </text>
        </SvgAcessivel>
      </div>
      <ul className="w-full min-w-0 space-y-1.5 text-sm" aria-label="Legenda">
        {arcos.map((a) => (
          <li key={a.rotulo} className="flex items-center gap-2">
            <span aria-hidden="true" className="inline-block size-3 shrink-0 rounded-sm" style={{ background: a.cor }} />
            <span className="min-w-0 flex-1 truncate">{a.rotulo}</span>
            <span className="shrink-0 text-texto-suave">
              {a.texto} · {formatarPercentual(a.valor, total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
