import { CpkStatus } from "../types";

export const getCpkStatus = (cpk: number | null): CpkStatus => {
  if (cpk !== null && cpk !== undefined && cpk >= 2.0) return "cyan";
  if (cpk !== null && cpk !== undefined && cpk >= 1.33) return "green";
  if (cpk !== null && cpk !== undefined && cpk >= 1.0) return "yellow";
  return "red";
};
