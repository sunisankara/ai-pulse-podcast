export interface PodcastEpisode {
  id: string;
  date: string;
  title: string;
  audioUrl: string;
  mainStories: string[];
}
export enum GenerationStep { IDLE='IDLE', SEARCHING='SEARCHING', REFINING='REFINING', SCRIPTING='SCRIPTING', SPEAKING='SPEAKING', COMPLETED='COMPLETED', ERROR='ERROR' }