export interface ApiResponse<T> {
  code: string;
  result: boolean;
  data: T | null;
  validationErrors: unknown[];
}