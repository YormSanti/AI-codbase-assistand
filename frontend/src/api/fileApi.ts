import { apiRequest } from "./client";
import type { CodeSymbol, FilePreview } from "../types/domain";

export const fileApi = {
  getContent(fileId: number): Promise<FilePreview> {
    return apiRequest<FilePreview>(`/api/files/${fileId}/content`);
  },

  getSymbols(fileId: number): Promise<CodeSymbol[]> {
    return apiRequest<CodeSymbol[]>(`/api/files/${fileId}/symbols`);
  },
};
