# Brand — Moxie

Moxie is a Solana-native exchange for leveraged prediction markets.

## Direction

**Probability Chamber** — immersive and cinematic in discovery, precise and restrained during trading. The visual system turns probability, pressure, divergence, and time-to-lock into spatial material rather than using generic crypto imagery.

## Palette

| Token | Hex | Use |
| --- | --- | --- |
| Void | `#080A0C` | Page background |
| Carbon | `#101417` | Primary surface |
| Graphite | `#1A2024` | Elevated surface and borders |
| Bone | `#EBE8DF` | Primary text |
| Fog | `#929A99` | Secondary text |
| Signal Lime | `#C7FF4A` | Brand action and live signal |
| Positive Mint | `#5AE6A8` | Positive values and long direction |
| Negative Coral | `#FF6B62` | Negative values and short direction |
| Warning Amber | `#F4B860` | Lock and oracle warnings |

Signal Lime is sparse and high-value. Mint, coral, and amber are semantic only.

## Typography

- **Geist** for display and interface text. Headings use semibold with tight tracking (`tracking-tight` / `tracking-tighter` at display sizes); interface text uses regular and medium.
- **Geist Mono** with tabular numerals for numbers only — prices, sizes, balances, addresses, countdowns. Labels, buttons and tabs stay in Geist.
- Minimum readable size is 12 px. The scale is Tailwind's default (12 / 14 / 16 / 18 / 20 / 24 / 30 / 36 / 48 / 60).

_Changed 2026-10-08:_ one family (Geist + Geist Mono) replaced the earlier Space Grotesk / Geist / Geist Mono trio. A single family keeps the terminal and marketing pages visually consistent, and Geist's neutral, precise forms suit dense trading data better than Space Grotesk's quirky shapes.

## Tokens

Colors, fonts, radii and motion are defined once as Tailwind v4 theme tokens in `apps/web/app/globals.css` (`bg-surface`, `text-muted`, `border-border`, `text-long`, …). Components never use raw hex values; the only exception is the chart canvas, which mirrors the tokens because it cannot read CSS variables.

## Voice

Moxie is direct, informed, and a little provocative. It explains market mechanics plainly and never substitutes slogans for evidence.

Headlines are short and active. Product labels use established trading language. Risk messages state what happened, why it matters, and what the user can do next.

## Usage

- Use dimensional effects to explain probability and market pressure.
- Keep the terminal flat, fast, and information-first.
- Never use generic globes, floating coins, purple gradients, or decorative glass cards.
- Keep critical text and controls in accessible DOM layers rather than WebGL.
