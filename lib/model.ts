// Launch Radar's model (radar-3): one sealed snapshot in, one ranked board out.
//
// The board ranks every protocol that records no token and is farmable as a launch candidate:
// the snapshot's 40-slug watchlist (the floor, never the ceiling) plus every other pre-token
// protocol the field guide's own tests leave standing. Set aside as not-a-launch, and never
// ranked: exchanges (CEX), official chain bridges (Canonical Bridge), products that carry an
// exchange's name (Binance, Coinbase, Bybit, Kraken, Bitget, OKX, Bitfinex, Gemini) and versioned
// pools of another protocol. Protocols whose token already trades are never ranked either: they
// are set aside as the live set, shown at the market's own values, and — this is the model's
// engine — they are the evidence the implied values are priced from.
//
// Implied value follows only from the snapshot's own figures, and radar-3 prices it from TWO
// independent anchors measured on the same launched peers, so a reader can see where they agree:
//
//   anchor A (the median multiple)  the median of mcap_usd / tvl_usd over the category's
//                                   launched peers: what the market pays per dollar of TVL for
//                                   a launched token of that kind, at the middle of the market.
//   anchor B (the size fit)         a power law log(mcap) = a + b x log(TVL) fitted by least
//                                   squares over the same peers: what a token of THIS protocol's
//                                   size cleared at, since small and large protocols do not
//                                   clear at the same multiple. Needs 8+ peers, slope clamped.
//   base multiple                   the median anchor adjusted by the size fit: the fit may move
//                                   it by at most x1.41 either way (the blend factor is the square
//                                   root of the fit-to-median ratio, that ratio clamped to
//                                   [0.5, 2]), and the fit only speaks inside the size range its
//                                   peers actually span, widened fourfold; outside it the median
//                                   prices the row alone. The blend is clamped to [0.03, 2.5].
//
//   implied = tvl_usd x baseMultiple x agreementMult x growthMult x maturityMult x breadthMult
//             x productMult
//
//   agreementMult     1 / (1 + log10(anchor spread)) when the two anchors diverge by more than
//                     the agreement threshold (x2): where the median and the size fit cannot
//                     agree on a price, the row is discounted for the disagreement itself —
//                     at a x6.5 spread the factor is about x0.55 — and the detail view shows
//                     it as its own line. At or below the threshold the anchors agree closely
//                     enough that the factor is 1 and no discount is taken.
//
//   growthMult        1 + 0.6 x clamp(change_7d, -50, 100) / 100, floored at 0.55: a hot week
//                     lifts the price, a bad week cannot zero it
//   maturityMult      0.75 + 0.45 x (1 - exp(-ageYears / 1.8)): a protocol that has run for years
//                     with no token has proved the TVL is real; the curve saturates near 1.20
//   breadthMult       1 + 0.03 x min(chains - 1, 8): distribution across chains is worth a little
//   productMult       0.01 when the record marks the protocol as a wrapped, staked or bridged
//                     product of another protocol: a wrapped or bridged product's own launch is
//                     a relisting of a token that already trades, priced at 1% of its peer value
//                     and flagged on the board, never allowed to pose as a fresh launch or to
//                     sit in the pre-token top ranks on the parent asset's size
//
// Around the point value the model also carries the peer band: the same price recomputed at the
// category's 25th and 75th percentile multiples. The snapshot's launched peers disperse widely
// (the global interquartile range runs from 0.05x to 1.06x), so an honest radar shows the band,
// not just the point. And beside value it scores a signal, 0-100, that is independent of size:
// where the protocol stands among the board's own rows on years without a token (40%), seven-day
// momentum (30%), chain breadth (15%) and TVL standing inside its own category (15%).
//
// No protocol name is ever special-cased: the same functions score every row, and every constant
// above is a model constant, printed in the dashboard next to the board it produced.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants: stated in the dashboard, used by every row alike. */
export interface ModelConstants {
  multiple_min: number;
  multiple_max: number;
  peer_min: number;
  fit_min_peers: number;
  fit_slope_min: number;
  fit_slope_max: number;
  fit_blend_floor: number;
  fit_blend_cap: number;
  fit_range_widen: number;
  growth_weight: number;
  growth_floor_pct: number;
  growth_cap_pct: number;
  growth_mult_floor: number;
  maturity_base: number;
  maturity_range: number;
  maturity_tau_years: number;
  unknown_age_years: number;
  breadth_per_chain: number;
  breadth_max_extra_chains: number;
  product_multiple: number;
  agreement_spread_threshold: number;
  signal_maturity_weight: number;
  signal_momentum_weight: number;
  signal_breadth_weight: number;
  signal_standing_weight: number;
}

export const MODEL: ModelConstants = {
  multiple_min: 0.03,
  multiple_max: 2.5,
  peer_min: 3,
  fit_min_peers: 8,
  fit_slope_min: 0.4,
  fit_slope_max: 1.6,
  fit_blend_floor: 0.5,
  fit_blend_cap: 2,
  fit_range_widen: 4,
  growth_weight: 0.6,
  growth_floor_pct: -50,
  growth_cap_pct: 100,
  growth_mult_floor: 0.55,
  maturity_base: 0.75,
  maturity_range: 0.45,
  maturity_tau_years: 1.8,
  unknown_age_years: 1,
  breadth_per_chain: 0.03,
  breadth_max_extra_chains: 8,
  product_multiple: 0.01,
  agreement_spread_threshold: 2,
  signal_maturity_weight: 0.4,
  signal_momentum_weight: 0.3,
  signal_breadth_weight: 0.15,
  signal_standing_weight: 0.15,
};

/** The model's version label: the dashboard names it and the board's rows carry it. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the dashboard's Already trading view carries, by market cap. */
export const LIVE_ROWS = 30;

/** A board row's tier: on the house watchlist, an early find below it, or a product of another protocol. */
export type Tier = 'watchlist' | 'early' | 'product';

/** What a row's farm plan costs, rolled up from the same figures its steps quote. */
export interface PlanSummary {
  upfront_usd: number;
  weekly_usd: number;
  minutes_per_week: number;
  hold_days: number;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  tier: Tier;
  age_days: number | null;
  implied_value_usd: number;
  implied_low_usd: number;
  implied_high_usd: number;
  signal_score: number;
  plan: PlanSummary;
  model: {
    anchor_multiple: number;
    median_multiple: number;
    fit_multiple: number | null;
    peer_p25: number;
    peer_p75: number;
    anchor_spread: number;
    peer_count: number;
    peer_scope: 'category' | 'global';
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    product_multiplier: number;
    anchor_agreement_multiplier: number;
  };
  farm_steps: string[];
}

/** The dashboard's view of one board row: the row itself, nothing re-derived. */
export type RadarRow = BoardRow;

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  symbol: string | null;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  mcap_tvl: number | null;
  change_7d: number | null;
}

/** One category's pricing evidence, for the dashboard's evidence strip. */
export interface CategoryEvidence {
  category: string;
  peers: number;
  median: number;
  p25: number;
  p75: number;
}

/** Everything the dashboard needs: the board, the live set, the evidence, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  protocol_size: number;
  pretoken_size: number;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  product_size: number;
  excluded_size: number;
  live_size: number;
  global_multiple: number;
  global_p25: number;
  global_p75: number;
  categories: CategoryEvidence[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A whole day count from `listedAt` to `asOf`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories whose members are products of another protocol rather than launches of their own. */
const PRODUCT_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);

/** A name carrying a whole word wrapped, staked or staking marks a product of an underlying asset. */
const PRODUCT_NAME = /\b(wrapped|staked|staking)\b/i;

/** Whether the record marks this protocol as a wrapped, staked or bridged product of another. */
export function isProduct(p: SnapshotProtocol): boolean {
  return (p.category !== null && PRODUCT_CATEGORIES.has(p.category)) || PRODUCT_NAME.test(p.name);
}

/** The exchanges the field guide names: a product carrying one's name is the exchange's, not a launch. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/**
 * Whether a protocol may be ranked at all: pre-token, and not set aside by the field guide's own
 * tests — not an exchange, not an official chain bridge, not an exchange's named product, and not
 * a versioned pool of another protocol.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && p.category !== 'Canonical Bridge' && !EXCHANGE_PREFIX.test(p.name) && !VERSIONED.test(p.name);
}

/** The median of a non-empty list of numbers. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** The q-quantile of a non-empty list, by linear interpolation between the closest ranks. */
function quantile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0]!;
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

const clampMultiple = (n: number, model: ModelConstants): number =>
  Math.min(model.multiple_max, Math.max(model.multiple_min, n));

/** One peer set's pricing evidence: its multiples' median and quartiles, and its size fit. */
export interface PeerStats {
  peers: number;
  median: number;
  p25: number;
  p75: number;
  /** The power law's slope and intercept (log mcap on log TVL), or null when the set is too small. */
  slope: number | null;
  intercept: number | null;
  /** The smallest and largest TVL among the peers: the size range the fit was measured on. */
  min_tvl: number;
  max_tvl: number;
}

/** The evidence one set of launched peers carries, from its (TVL, market cap) pairs alone. */
function peerStats(pairs: { tvl: number; mcap: number }[], model: ModelConstants): PeerStats {
  const ratios = pairs.map((x) => x.mcap / x.tvl);
  let slope: number | null = null;
  let intercept: number | null = null;
  if (pairs.length >= model.fit_min_peers) {
    const xs = pairs.map((x) => Math.log(x.tvl));
    const ys = pairs.map((x) => Math.log(x.mcap));
    const mx = xs.reduce((a, v) => a + v, 0) / xs.length;
    const my = ys.reduce((a, v) => a + v, 0) / ys.length;
    let cov = 0;
    let varx = 0;
    for (let i = 0; i < xs.length; i++) {
      cov += (xs[i]! - mx) * (ys[i]! - my);
      varx += (xs[i]! - mx) * (xs[i]! - mx);
    }
    if (varx > 0) {
      const b = Math.min(model.fit_slope_max, Math.max(model.fit_slope_min, cov / varx));
      slope = b;
      intercept = my - b * mx;
    }
  }
  return {
    peers: pairs.length,
    median: ratios.length > 0 ? median(ratios) : model.multiple_min,
    p25: ratios.length > 0 ? quantile(ratios, 0.25) : model.multiple_min,
    p75: ratios.length > 0 ? quantile(ratios, 0.75) : model.multiple_min,
    slope,
    intercept,
    min_tvl: pairs.length > 0 ? Math.min(...pairs.map((x) => x.tvl)) : 0,
    max_tvl: pairs.length > 0 ? Math.max(...pairs.map((x) => x.tvl)) : 0,
  };
}

/**
 * The size fit's multiple at one TVL: the fitted market cap there, per dollar of TVL, clamped.
 * Null when there is no fit, or when the TVL sits outside the size range the peers span
 * (widened by the model's range factor): out there the fit would be extrapolation, not evidence.
 */
function fitMultipleAt(stats: PeerStats, tvl: number, model: ModelConstants): number | null {
  if (stats.slope === null || stats.intercept === null || tvl <= 0) return null;
  if (tvl < stats.min_tvl / model.fit_range_widen || tvl > stats.max_tvl * model.fit_range_widen) return null;
  const fitted = Math.exp(stats.intercept + stats.slope * Math.log(tvl));
  if (!Number.isFinite(fitted) || fitted <= 0) return null;
  return clampMultiple(fitted / tvl, model);
}

/**
 * The pricing tables the snapshot itself supplies: for each category, the evidence of its
 * launched (token-bearing) peers, plus the global evidence every thin category falls back to.
 * Computed from the snapshot at run time; nothing here is a hand-kept list.
 */
export function peerTables(snapshot: Snapshot, model: ModelConstants = MODEL): { byCategory: Map<string, PeerStats>; global: PeerStats } {
  const byCat = new Map<string, { tvl: number; mcap: number }[]>();
  const all: { tvl: number; mcap: number }[] = [];
  for (const p of snapshot.protocols) {
    if (isPreToken(p) || p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const pair = { tvl: p.tvl_usd, mcap: p.mcap_usd };
    all.push(pair);
    if (p.category !== null) {
      const list = byCat.get(p.category) ?? [];
      list.push(pair);
      byCat.set(p.category, list);
    }
  }
  const byCategory = new Map<string, PeerStats>();
  for (const [category, list] of byCat) {
    if (list.length >= model.peer_min) byCategory.set(category, peerStats(list, model));
  }
  return { byCategory, global: peerStats(all, model) };
}

/** One protocol's multipliers, anchors, band and implied value under the model. */
export function impliedValue(
  p: SnapshotProtocol,
  asOf: string,
  table: { byCategory: Map<string, PeerStats>; global: PeerStats },
  model: ModelConstants = MODEL,
): {
  implied: number; low: number; high: number;
  anchorMultiple: number; medianMultiple: number; fitMultiple: number | null;
  p25: number; p75: number; spread: number;
  peers: number; peerScope: 'category' | 'global';
  growthMult: number; maturityMult: number; breadthMult: number; productMult: number; agreementMult: number; age: number | null;
} {
  const own = p.category !== null ? table.byCategory.get(p.category) : undefined;
  const stats = own ?? table.global;
  const medianMultiple = clampMultiple(stats.median, model);
  const fit = fitMultipleAt(stats, p.tvl_usd, model);
  // The blend: the median is the robust anchor; the fit adjusts it by the square root of their
  // ratio, that ratio first clamped to [fit_blend_floor, fit_blend_cap] — so the fit can move a
  // price by at most about x1.41 either way, however far the two anchors part.
  const anchorMultiple = fit !== null
    ? clampMultiple(medianMultiple * Math.sqrt(Math.min(model.fit_blend_cap, Math.max(model.fit_blend_floor, fit / medianMultiple))), model)
    : medianMultiple;
  const spread = fit !== null ? Math.max(medianMultiple, fit) / Math.min(medianMultiple, fit) : 1;
  // The agreement discount: past the threshold, the wider the two anchors part, the less of the
  // blended price the row keeps — log-scaled, so a x10 disagreement costs about half, not all.
  const agreementMult = spread > model.agreement_spread_threshold ? 1 / (1 + Math.log10(spread)) : 1;
  const growthPct = Math.min(model.growth_cap_pct, Math.max(model.growth_floor_pct, finite(p.change_7d, 0)));
  const growthMult = Math.max(model.growth_mult_floor, 1 + (growthPct / 100) * model.growth_weight);
  const age = ageDays(asOf, p.listed_at);
  const years = age === null ? model.unknown_age_years : age / 365;
  const maturityMult = model.maturity_base + model.maturity_range * (1 - Math.exp(-years / model.maturity_tau_years));
  const breadthMult = 1 + model.breadth_per_chain * Math.min(Math.max(p.chains.length - 1, 0), model.breadth_max_extra_chains);
  const productMult = isProduct(p) ? model.product_multiple : 1;
  const rest = growthMult * maturityMult * breadthMult * productMult * agreementMult;
  const implied = Math.max(1, Math.round(p.tvl_usd * anchorMultiple * rest));
  const low = Math.min(implied, Math.max(1, Math.round(p.tvl_usd * clampMultiple(stats.p25, model) * rest)));
  const high = Math.max(implied, Math.max(1, Math.round(p.tvl_usd * clampMultiple(stats.p75, model) * rest)));
  return {
    implied, low, high,
    anchorMultiple, medianMultiple, fitMultiple: fit,
    p25: stats.p25, p75: stats.p75, spread,
    peers: stats.peers, peerScope: own !== undefined ? 'category' : 'global',
    growthMult, maturityMult, breadthMult, productMult, agreementMult, age,
  };
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** A value's percentile among a set, 0..1: the share below it, ties counting half. */
function percentileRank(values: number[], v: number): number {
  if (values.length === 0) return 0;
  let less = 0;
  let equal = 0;
  for (const x of values) {
    if (x < v) less++;
    else if (x === v) equal++;
  }
  return (less + 0.5 * equal) / values.length;
}

/**
 * The signal score, 0-100: where a row stands among the board's own rows on the four things that
 * argue a launch is worth farming — years run with no token, the week's momentum, the chain
 * footprint, and its TVL standing inside its own category. Independent of the implied value:
 * a small, old, growing protocol can out-signal a giant that merely sits there.
 */
function signalScores(rows: { p: SnapshotProtocol; age: number | null }[], model: ModelConstants): number[] {
  const ages = rows.map((r) => r.age ?? model.unknown_age_years * 365);
  const momenta = rows.map((r) => finite(r.p.change_7d, 0));
  const breadths = rows.map((r) => r.p.chains.length);
  const byCategory = new Map<string, number[]>();
  for (const r of rows) {
    const key = r.p.category ?? '';
    const list = byCategory.get(key) ?? [];
    list.push(r.p.tvl_usd);
    byCategory.set(key, list);
  }
  const allTvl = rows.map((r) => r.p.tvl_usd);
  return rows.map((r, i) => {
    const peers = byCategory.get(r.p.category ?? '') ?? [];
    const standing = peers.length >= 4 ? percentileRank(peers, r.p.tvl_usd) : percentileRank(allTvl, r.p.tvl_usd);
    const score =
      model.signal_maturity_weight * percentileRank(ages, ages[i]!) +
      model.signal_momentum_weight * percentileRank(momenta, momenta[i]!) +
      model.signal_breadth_weight * percentileRank(breadths, breadths[i]!) +
      model.signal_standing_weight * standing;
    return Math.round(100 * score);
  });
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const watch = new Set(snapshot.watchlist);
  const table = peerTables(snapshot, model);
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }
  const scored = [...chosen.values()].map((p) => ({ p, ...impliedValue(p, snapshot.as_of, table, model) }));
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  const signals = signalScores(scored, model);
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token' as const,
    tier: watch.has(s.p.slug) ? ('watchlist' as Tier) : isProduct(s.p) ? ('product' as Tier) : ('early' as Tier),
    age_days: s.age,
    implied_value_usd: s.implied,
    implied_low_usd: s.low,
    implied_high_usd: s.high,
    signal_score: signals[i]!,
    plan: planSummary(s.p, s.age),
    model: {
      anchor_multiple: round4(s.anchorMultiple),
      median_multiple: round4(s.medianMultiple),
      fit_multiple: s.fitMultiple === null ? null : round4(s.fitMultiple),
      peer_p25: round4(s.p25),
      peer_p75: round4(s.p75),
      anchor_spread: round4(s.spread),
      peer_count: s.peers,
      peer_scope: s.peerScope,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      breadth_multiplier: round4(s.breadthMult),
      product_multiplier: s.productMult,
      anchor_agreement_multiplier: round4(s.agreementMult),
    },
    farm_steps: farmSteps(s.p, s.age, watch.has(s.p.slug), s.implied),
  }));
}

/* ------------------------------------------------------------------ */
/* Farm plans: category- and chain-aware templates, per-protocol facts */
/* ------------------------------------------------------------------ */

/** Gas money for one transaction on a chain, from the chain the snapshot names. */
function gasProfile(chain: string): { label: string; fund: string; perTx: string } {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return { label: 'Ethereum mainnet', fund: '$25 of ETH', perTx: '$6-15' };
  if (c === 'solana') return { label: 'Solana', fund: '$5 of SOL', perTx: 'under $0.10' };
  if (['arbitrum', 'base', 'optimism', 'zksync era', 'linea', 'scroll', 'mantle', 'mode', 'blast', 'taiko'].includes(c))
    return { label: `${chain} (an Ethereum L2)`, fund: '$8 of ETH bridged over', perTx: '$0.20-1' };
  if (['bsc', 'binance', 'bnb chain'].includes(c)) return { label: 'BNB Chain', fund: '$8 of BNB', perTx: '$0.10-0.50' };
  if (['polygon', 'polygon zkevm'].includes(c)) return { label: 'Polygon', fund: '$5 of POL', perTx: 'under $0.10' };
  if (['avalanche', 'avax'].includes(c)) return { label: 'Avalanche', fund: '$10 of AVAX', perTx: '$0.30-1' };
  if (['sui', 'aptos'].includes(c)) return { label: chain, fund: `$10 of ${c === 'sui' ? 'SUI' : 'APT'}`, perTx: 'under $0.10' };
  if (['near', 'tron', 'celo', 'fantom', 'sonic', 'gnosis', 'moonbeam', 'cronos', 'kava', 'sei', 'berachain', 'monad', 'hyperliquid l1', 'plasma', 'stable'].includes(c))
    return { label: chain, fund: '$10 of its gas token', perTx: '$0.10-1' };
  return { label: chain, fund: '$10 of its gas token', perTx: '$1-3' };
}

/** The chain a farm is actually worked from: the first programmable chain the record names. */
function gasChainOf(p: SnapshotProtocol): string {
  const first = p.chains.length > 0 ? p.chains[0]! : 'its main chain';
  return p.chains.find((c) => !['bitcoin', 'zcash', 'dogecoin', 'litecoin'].includes(c.toLowerCase())) ?? first;
}

/** The first dollar figure in a gas string ('$25 of ETH' -> 25). */
function firstUsd(text: string): number {
  const m = /\$\s*([0-9]+(?:\.[0-9]+)?)/.exec(text);
  return m ? Number(m[1]) : 0;
}

/** The top of a per-transaction gas range ('$6-15' -> 15, '$0.20-1' -> 1, 'under $0.10' -> 0.1). */
function perTxHigh(text: string): number {
  const nums = [...text.matchAll(/([0-9]+(?:\.[0-9]+)?)/g)].map((m) => Number(m[1]));
  return nums.length > 0 ? Math.max(...nums) : 0;
}

/** Position capital for a farm, scaled to the protocol's own TVL: bigger protocols, bigger tickets. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 500;
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 250_000_000) return 150;
  if (p.tvl_usd >= 50_000_000) return 100;
  return 50;
}

/** How long a position should stay open, from the protocol's age: young protocols need longer proof. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 60;
  if (age < 365) return 45;
  if (age < 1095) return 30;
  return 21;
}

/**
 * A plan's cost rollup, from the same figures its steps quote: the capital plus the gas float up
 * front, about two transactions a week of gas, a quarter hour of work a week, and the hold.
 */
export function planSummary(p: SnapshotProtocol, age: number | null): PlanSummary {
  const gas = gasProfile(gasChainOf(p));
  return {
    upfront_usd: capitalFor(p) + firstUsd(gas.fund),
    weekly_usd: Math.round(perTxHigh(gas.perTx) * 2 * 100) / 100,
    minutes_per_week: 15,
    hold_days: holdDaysFor(age),
  };
}

interface ActionPair {
  open: string;
  weekly: string;
  /** One extra step only this category's farmers need, when the category has one. */
  extra?: string;
}

/** The category's core farm actions, written for the protocol and chain they name. */
function actionsFor(p: SnapshotProtocol, capital: number, chain: string): ActionPair {
  const c = (p.category ?? '').toLowerCase();
  const n = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral'))
    return {
      open: `Supply $${capital} of USDC to ${n}'s main lending market on ${chain}, then borrow about 30% of it back and re-supply once, so the wallet shows both sides of the market.`,
      weekly: `Repay and re-borrow a small slice on ${n} each week to keep the position active without changing its size.`,
      extra: `Work the supply/borrow loop on ${n} deliberately: once a month, repay the borrowed slice in full and borrow it again at the same size, and check the position's health factor stays above 1.6, so the wallet's history shows the borrow market used repeatedly and a volatile week cannot liquidate the farm. Cost: gas only, about one weekly action. Time: 15 minutes a month.`,
    };
  if (c.includes('dex') || c.includes('aggregator'))
    return {
      open: `Add $${capital} of liquidity to ${n}'s busiest stable or ETH pool on ${chain}, then route two small swaps a week through ${n}'s own interface rather than an aggregator.`,
      weekly: `Make two swaps of $25-50 through ${n} each week and claim any pool fees back into the position.`,
      extra: c.includes('yield')
        ? `Rotate once a quarter on ${n}: move a quarter of the position into ${n}'s next-best vault on ${chain} for a week, then move it back, so the wallet has history in more than one vault without ever leaving the protocol. Cost: gas on two moves a quarter. Time: 20 minutes a quarter.`
        : `Choose the LP pair and range on ${n} by its own numbers: add the position to the fee tier that holds most of ${n}'s volume on ${chain}, set a range around the current price rather than full range, and write the range in the farm log so an out-of-range week is caught at the weekly check, not discovered months later. Cost: included in the $${capital} position. Time: 15 minutes.`,
    };
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options'))
    return {
      open: `Deposit $${capital} of USDC as margin on ${n} (${chain}) and open one small hedged position, half long and half short across two markets, so the account books real volume at low risk.`,
      weekly: `Trade about $${Math.max(50, capital)} of hedged volume a week on ${n} and keep the margin topped up above its liquidation line.`,
    };
  if (c.includes('bridge'))
    return {
      open: `Bridge $${capital} of USDC from Ethereum to ${chain} through ${n}, then use the bridged funds in one app on the far side instead of bridging straight back.`,
      weekly: `Make one return bridge of $25-50 through ${n} each fortnight so the wallet's history spans several weeks.`,
      extra: `Build volume in both directions on ${n}: after the first crossing, send a smaller amount back over ${n} the following week and forward again later in the month, varying the size each time, so the route reads as genuine two-way use of ${chain} rather than a single round trip. Cost: bridge fees on $25-50 a crossing. Time: 10 minutes a crossing.`,
    };
  if (c.includes('staking') || c.includes('restak'))
    return {
      open: `Stake $${capital} of the underlying asset through ${n} on ${chain} and keep the liquid receipt token in the same wallet, unstaked and visible.`,
      weekly: `Restake or compound the rewards on ${n} once a week; never move the receipt token to a fresh wallet.`,
      extra: `Join ${n}'s points programme from inside its own app and link this wallet before the first stake settles, then claim or confirm points on the programme's own schedule; for a staking launch the points record, not the stake alone, is what a snapshot usually reads. Cost: $0 to join. Time: 10 minutes, then 5 minutes a claim.`,
    };
  if (c.includes('curator') || c.includes('allocator') || c.includes('indexes'))
    return {
      open: `Deposit $${capital} into the largest ${n} vault on ${chain} and keep the vault shares untouched; a curator vault counts deposits that stay, not deposits that churn.`,
      weekly: `Check the vault's allocation page on ${n} once a week and top up $25 if its TVL share of the board is rising.`,
    };
  if (c.includes('yield'))
    return {
      open: `Deposit $${capital} into ${n}'s main yield vault on ${chain} and leave auto-compounding on, so the share balance grows in place.`,
      weekly: `Harvest or re-stake the yield on ${n} once a week so the wallet books a claim transaction, not just a deposit.`,
      extra: `Rotate once a quarter on ${n}: move a quarter of the position into ${n}'s next-best vault on ${chain} for a week, then move it back, so the wallet has history in more than one vault without ever leaving the protocol. Cost: gas on two moves a quarter. Time: 20 minutes a quarter.`,
    };
  if (c.includes('rwa') || c.includes('real world'))
    return {
      open: `Mint $${capital} of ${n}'s yield-bearing asset on ${chain} through its own onboarding and hold the asset; complete its KYC only if the app asks, with your own details.`,
      weekly: `Hold the position and record the yield ${n} credits each week; add $25 a month while its TVL trend is positive.`,
    };
  if (c.includes('stable'))
    return {
      open: `Mint or deposit $${capital} of the stable asset through ${n} on ${chain} and park it in ${n}'s own savings or staking module if it offers one.`,
      weekly: `Move a small part of the position between ${n}'s modules once a week so the wallet shows ongoing use, not a single mint.`,
    };
  if (c.includes('basis') || c.includes('delta'))
    return {
      open: `Deposit $${capital} of USDC into ${n}'s basis strategy on ${chain}; the strategy hedges itself, so the wallet's job is to fund it and stay.`,
      weekly: `Check ${n}'s funding-rate page weekly and add $25 only in weeks the strategy's yield stays positive.`,
    };
  if (c.includes('privacy'))
    return {
      open: `Deposit $${capital} into ${n}'s shielded pool on ${chain} in two tranches a week apart, and keep the deposit notes backed up offline.`,
      weekly: `Make one small shielded transfer inside ${n} each week; privacy pools count sustained, ordinary use.`,
    };
  if (c.includes('prediction'))
    return {
      open: `Fund $${capital} on ${n} (${chain}) and take small positions in three liquid markets, sized $10-25 each, on outcomes you can actually judge.`,
      weekly: `Settle finished markets and place two new positions a week on ${n}; volume spread over time is the signal.`,
    };
  if (c.includes('chain') || c.includes('layer'))
    return {
      open: `Bridge $${capital} to ${n}'s chain and use three of its native apps in the first week: a swap, a lend and a mint, so the wallet reads as a resident, not a tourist.`,
      weekly: `Transact on ${n} twice a week in its native apps and keep a small gas-token balance there at all times.`,
    };
  if (c.includes('insurance'))
    return {
      open: `Buy $${capital} of cover from ${n} on ${chain} against a position you really hold, and keep the policy to its term.`,
      weekly: `Renew or extend one cover line on ${n} monthly; insurers count wallets that come back after the first policy.`,
    };
  if (c.includes('gaming') || c.includes('nft') || c.includes('marketplace'))
    return {
      open: `Fund $${capital} on ${n} (${chain}) and complete its core loop once: one purchase, one listing or one game action, whichever its app is built around.`,
      weekly: `Use ${n} once a week for its core action; consumer apps count returning wallets far above one-time visitors.`,
    };
  return {
    open: `Deposit $${capital} of USDC into ${n} on ${chain} through its own app and keep the position open; use the app's main product, not a test page.`,
    weekly: `Make one qualifying action on ${n} each week, a deposit, a claim or a vote, so the wallet's history is continuous.`,
  };
}

/** A whole-dollar figure the way the steps quote it. */
function usd(n: number): string {
  return `$${n.toLocaleString('en-US')}`;
}

/**
 * A protocol's farm plan, generated from its own record: category actions, the primary chain's
 * gas prices, capital scaled to its TVL, a hold window from its age, and its own seven-day trend
 * and implied value woven into the review steps. Watchlist rows get the full eight steps;
 * product-flagged rows open with the caution their status deserves.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, onWatchlist: boolean, implied: number): string[] {
  const chain = p.chains.length > 0 ? p.chains[0]! : 'its main chain';
  const gas = gasProfile(gasChainOf(p));
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const acts = actionsFor(p, capital, chain);
  const multi = p.chains.length > 1 ? ` It runs on ${p.chains.length} chains; after two weeks, repeat the position on ${p.chains[1]} with half the capital.` : '';
  const trend =
    p.change_7d === null
      ? `The snapshot records no seven-day TVL change for ${p.name}, so judge its trend from the position's own weekly balance instead.`
      : `Its TVL moved ${p.change_7d >= 0 ? '+' : ''}${p.change_7d.toFixed(1)}% in the snapshot's seven days: ${p.change_7d >= 0 ? 'momentum is on the farm\u2019s side, but do not chase it with a bigger ticket' : 'treat a second negative week as a warning to pause new deposits, not as an exit by itself'}.`;
  const steps: string[] = [];
  if (isProduct(p)) {
    steps.push(
      `Caution first: ${p.name} is a ${p.category ?? 'derivative'} product tied to an underlying protocol or asset, so any launch value may belong to the parent. Farm the parent's own program first if it has one; treat this as the secondary position. Cost: $0. Time: 10 minutes to check.`,
    );
  }
  steps.push(
    `Set up one fresh wallet for ${p.name} and fund it on ${gas.label} with ${gas.fund} for gas, keeping the seed phrase offline and never reusing this wallet for unrelated apps. Cost: ${gas.fund} plus a ${gas.perTx} first transaction. Time: 10 minutes.`,
    `${acts.open} Cost: $${capital} of capital, gas about ${gas.perTx} a transaction. Time: 15 minutes to set up.`,
    `${acts.weekly} Cost: about ${gas.perTx} a week in gas. Time: 10 minutes a week.${multi}`,
    ...(acts.extra !== undefined ? [acts.extra] : []),
    `Hold the ${p.name} position for at least ${hold} days so the activity spans more than one snapshot of the protocol's records. ${trend} Cost: the $${capital} stays deployed; withdraw early only if the app changes its terms. Time: ${hold} days.`,
    `Open ${p.name}'s own points, rewards or governance page inside its app and link this wallet there; claim only from links the app itself publishes, and never pay a fee to claim. Cost: $0 to check. Time: 10 minutes.`,
    `Keep a farm log for ${p.name}: wallet address, deposit dates, weekly actions and the position's size, so you can prove the history or unwind it cleanly. Cost: $0. Time: 5 minutes a week.`,
  );
  if (onWatchlist) {
    steps.push(
      `Review ${p.name} monthly against this board: it stands at an implied ${usd(implied)} here; re-check its TVL trend and implied value, and add capital only while both are rising; a falling board rank is the exit signal, not a discount. Cost: $0. Time: 15 minutes a month.`,
      `Before any ${p.name} token announcement, re-read its official terms for snapshot dates and eligibility; if a snapshot is announced, stop new deposits and let the held position speak for itself. Cost: $0. Time: 20 minutes, once.`,
    );
  }
  return steps.slice(0, 12);
}

/** The live-token protocols, by market cap, for the dashboard's Already trading view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      symbol: p.symbol,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      mcap_tvl: p.mcap_usd !== null && p.tvl_usd > 0 ? round4(p.mcap_usd / p.tvl_usd) : null,
      change_7d: p.change_7d,
    }));
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const table = peerTables(snapshot, model);
  const live = liveRows(snapshot);
  const categories: CategoryEvidence[] = [...table.byCategory.entries()]
    .map(([category, s]) => ({ category, peers: s.peers, median: round4(clampMultiple(s.median, model)), p25: round4(s.p25), p75: round4(s.p75) }))
    .sort((a, b) => b.peers - a.peers || (a.category < b.category ? -1 : 1));
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    protocol_size: snapshot.protocols.length,
    pretoken_size: snapshot.protocols.filter(isPreToken).length,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: board.filter((r) => r.tier === 'early').length,
    product_size: board.filter((r) => r.tier === 'product').length,
    excluded_size: snapshot.protocols.filter((p) => isPreToken(p) && !isRankable(p)).length,
    live_size: live.length,
    global_multiple: round4(clampMultiple(table.global.median, model)),
    global_p25: round4(table.global.p25),
    global_p75: round4(table.global.p75),
    categories,
    rows: board,
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) return `the board holds ${board.length} rows, outside 100..4000`;
  const slugs = new Set(board.map((r) => r.slug));
  if (slugs.size !== board.length) return 'a slug appears on the board twice';
  const known = new Set(snapshot.protocols.map((p) => p.slug));
  for (const r of board) if (!known.has(r.slug)) return `${r.slug} is not one of the snapshot's protocols`;
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) return `${r.slug} has a farm step of ${t.length} trimmed characters`;
    }
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 100_000_000_000_000) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (!(r.implied_low_usd >= 1 && r.implied_low_usd <= r.implied_value_usd && r.implied_high_usd >= r.implied_value_usd)) return `${r.slug} has a broken peer band`;
    if (!Number.isInteger(r.signal_score) || r.signal_score < 0 || r.signal_score > 100) return `${r.slug} has signal score ${r.signal_score}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
