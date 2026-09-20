export type Market = {
  slug: string;
  category: string;
  question: string;
  short: string;
  provider: string;
  moxie: number;
  index: number;
  mark: number;
  change: number;
  volume: string;
  oi: string;
  lock: string;
  leverage: string;
};

export const markets: Market[] = [
  {
    slug: "sol-above-250-friday",
    category: "CRYPTO",
    question: "Will SOL trade above $250 by Friday?",
    short: "SOL > $250",
    provider: "Jupiter",
    moxie: 63.4,
    index: 61.8,
    mark: 62.3,
    change: 8.2,
    volume: "$842K",
    oi: "$316K",
    lock: "2d 14h",
    leverage: "5×",
  },
  {
    slug: "fed-cuts-october",
    category: "ECONOMICS",
    question: "Will the Fed cut rates at the October meeting?",
    short: "FED CUT / OCT",
    provider: "Kalshi",
    moxie: 41.2,
    index: 42.1,
    mark: 41.8,
    change: -3.4,
    volume: "$1.26M",
    oi: "$582K",
    lock: "18d 07h",
    leverage: "4×",
  },
  {
    slug: "candidate-a-wins",
    category: "POLITICS",
    question: "Will Candidate A win the general election?",
    short: "CANDIDATE A",
    provider: "Polymarket",
    moxie: 54.7,
    index: 52.9,
    mark: 53.4,
    change: 1.8,
    volume: "$3.84M",
    oi: "$1.12M",
    lock: "42d 11h",
    leverage: "3×",
  },
  {
    slug: "btc-150k-2026",
    category: "CRYPTO",
    question: "Will Bitcoin reach $150,000 before 2027?",
    short: "BTC > $150K",
    provider: "Jupiter",
    moxie: 28.6,
    index: 27.3,
    mark: 27.8,
    change: 5.6,
    volume: "$628K",
    oi: "$244K",
    lock: "98d 04h",
    leverage: "5×",
  },
];

export const defaultMarket = markets[0];

export function getMarket(slug?: string) {
  return markets.find((market) => market.slug === slug) ?? defaultMarket;
}
