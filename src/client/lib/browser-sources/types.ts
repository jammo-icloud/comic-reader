export type SourceTier = 'fast';

export interface SourceConfig {
  id: string;
  name: string;
  color: string;
  tier: SourceTier;
  type: 'server';
  url: string;
  favicon: string;
  description: string;
}
