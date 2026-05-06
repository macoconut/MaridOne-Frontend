export type DocumentResponseDto = {
  pathId: number;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  connectedEntity: string | null;
  connectedIds: string | null;
  createdAt: string;
  updatedAt: string | null;
  isPublic: boolean;
};