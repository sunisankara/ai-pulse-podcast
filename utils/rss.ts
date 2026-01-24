
import { PodcastEpisode } from '../types';

export function generateRSSFeed(
  episodes: PodcastEpisode[], 
  githubPagesUrl: string = 'https://username.github.io/repo', 
  ownerEmail: string = 'broadcast@sundaramlabs.ai'
): string {
  const lastBuildDate = new Date().toUTCString();
  
  const items = episodes
    .map(e => {
      const storyList = e.mainStories && e.mainStories.length > 0 
        ? `<p><strong>Today's Top 3 Stories:</strong></p><ul>${e.mainStories.map(s => `<li>${s}</li>`).join('')}</ul><hr/>`
        : '';
      
      // MP3 Link pointing to GitHub Releases
      const audioLink = e.audioUrl || `${githubPagesUrl}/releases/download/v${e.id}/${e.id}.mp3`;
        
      return `
    <item>
      <title>${e.title}</title>
      <description><![CDATA[${storyList}${e.script.substring(0, 800)}...]]></description>
      <pubDate>${new Date(e.date).toUTCString()}</pubDate>
      <guid isPermaLink="false">${e.id}</guid>
      <enclosure url="${audioLink}" length="0" type="audio/mpeg"/>
      <itunes:author>AI Daily Pulse</itunes:author>
      <itunes:duration>15:00</itunes:duration>
      <itunes:explicit>no</itunes:explicit>
    </item>`;
    }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>AI Daily Pulse: Deep Dive</title>
    <link>${githubPagesUrl}</link>
    <language>en-us</language>
    <itunes:author>AI Daily Pulse</itunes:author>
    <itunes:summary>Your daily 15-minute conversational deep dive into latest AI developments. Headless production by Sundaram Labs.</itunes:summary>
    <description>Automated daily AI intelligence briefing. Produced by Sundaram Labs.</description>
    <itunes:owner>
      <itunes:name>Sundaram Labs Broadcast</itunes:name>
      <itunes:email>${ownerEmail}</itunes:email>
    </itunes:owner>
    <itunes:explicit>no</itunes:explicit>
    <itunes:category text="Technology"/>
    <itunes:image href="${githubPagesUrl}/cover.jpg"/>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    ${items}
  </channel>
</rss>`;
}
