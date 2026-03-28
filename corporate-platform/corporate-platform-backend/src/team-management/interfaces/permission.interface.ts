export interface PermissionView {
  key: string;
  description: string;
  category: string;
}

export interface PermissionResponse {
  all: PermissionView[];
}
