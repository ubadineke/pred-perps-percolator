import { readFileSync } from "node:fs";
import { validateMarketGroupConfig } from "../packages/config/src/market-group.ts";

const path = process.argv[2] ?? "config/percolator.market-group.json";
const config = JSON.parse(readFileSync(path, "utf8"));
validateMarketGroupConfig(config);

console.log(JSON.stringify(config, null, 2));

