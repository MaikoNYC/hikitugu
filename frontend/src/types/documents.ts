import type { Document, DocumentSection } from "./database";

export type GenerationMode = "full" | "section" | "outline";

export interface CreateDocumentRequest {
  title: string;
  template_id?: string;
  generation_mode: GenerationMode;
  data_source_ids: string[];
  target_description: string;
}

export interface DocumentWithSections extends Document {
  sections: DocumentSection[];
}
