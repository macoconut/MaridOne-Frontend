export type DocumentResponseDto = {
  pathId: number;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  createdAt: string;
  updatedAt?: string;
  isPublic: boolean;
};