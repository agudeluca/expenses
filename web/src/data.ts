import type { NormalizedTransaction } from "./types";

export async function loadData(): Promise<NormalizedTransaction[]> {
  const res = await fetch("/data.json");
  if (!res.ok) {
    throw new Error(`failed to load data.json: ${res.status}`);
  }
  return res.json();
}
