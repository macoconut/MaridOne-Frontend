export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface PageableParams {
  page?: number;
  size?: number;
  sort?: string | string[];
}