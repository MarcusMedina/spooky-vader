// Node-only: loads rules.json and texts for tests/scripts.
import { readFileSync } from "node:fs";
export const config = JSON.parse(readFileSync(new URL("./rules.json", import.meta.url)));
export const texts = JSON.parse(readFileSync(new URL("./texts.sv.json", import.meta.url)));
