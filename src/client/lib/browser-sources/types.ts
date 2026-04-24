export type SourceTier = 'fast';

export interface SourceConfig {
  id: string;
  name: string;
  color: string;       // hex color, e.g. "#ea580c"
  description: string;
  url: string;
  favicon: string;
  tier: SourceTier;
  type: 'server';
}
