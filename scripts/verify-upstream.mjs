import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const pins = JSON.parse(readFileSync(new URL("../deployments/percolator-pins.json", import.meta.url)));

for (const repository of pins.repositories) {
  const actual = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: new URL(`../${repository.path}/`, import.meta.url),
    encoding: "utf8",
  }).trim();

  if (actual !== repository.commit) {
    throw new Error(`${repository.name}: expected ${repository.commit}, found ${actual}`);
  }
  console.log(`ok ${repository.name} ${actual}`);
}

