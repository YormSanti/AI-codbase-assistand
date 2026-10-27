import { apiRequest } from "./client";
import type { HealthReport } from "../types/domain";

export const healthApi = {
  check(): Promise<{ status: string }> {
    return apiRequest<{ status: string }>("/health");
  },
  /** Scan the project's indexed text files for TODOs, risky patterns, likely secrets, and large files. */
  scan(repositoryId: number): Promise<HealthReport> {
    return apiRequest<HealthReport>(`/api/repositories/${repositoryId}/health`);
  },
};
