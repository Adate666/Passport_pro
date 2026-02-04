
export type UsageCategory = 'standard' | 'diploma' | 'visa' | 'badge';

export interface PassportStandard {
  id: string;
  country: string;
  widthMm: number;
  heightMm: number;
  description: string;
  category: UsageCategory;
}

export interface CropState {
  x: number;
  y: number;
  scale: number;
}

export interface GeminiAnalysis {
  isCompliant: boolean;
  score: number;
  feedback: string[];
}

export interface PaperSize {
  widthMm: number;
  heightMm: number;
}

export interface PaperFormat {
  id: string;
  name: string;
  widthMm: number; // For preset formats
  heightMm: number; // For preset formats
}
