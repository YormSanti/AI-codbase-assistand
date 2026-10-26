import { apiRequest } from "./client";

export const healthApi = {
  check(): Promise<{ status: string }> {
    return apiRequest<{ status: string }>("/health");
  },
};
