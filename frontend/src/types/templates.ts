export interface UploadTemplateRequest {
  name: string;
  description?: string;
  file: File;
}

export interface ParsedStructure {
  sections: {
    key: string;
    title: string;
    description?: string;
    order: number;
  }[];
}
