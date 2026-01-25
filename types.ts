export interface PodcastEpisode {
  id: string;
  date: string;
  title: string;
  script: string;
  audioUrl?: string;
  topics: string[];
  mainStories: string[];
  status: 'draft' | 'generated' | 'published';
}
export enum GenerationStep { IDLE='IDLE', SEARCHING='SEARCHING', REFINING='REFINING', SCRIPTING='SCRIPTING', SPEAKING='SPEAKING', COMPLETED='COMPLETED', ERROR='ERROR' }