export function generateRSSFeed(episodes: any[], baseUrl: string) {
  const items = episodes.map(e => `
    <item>
      <title>${e.title}</title>
      <pubDate>${new Date(e.date).toUTCString()}</pubDate>
      <enclosure url="${e.audioUrl}" type="audio/mpeg" length="0"/>
      <itunes:summary>${e.title}</itunes:summary>
      <guid>${e.id}</guid>
    </item>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>AI Daily Pulse</title>
    <link>${baseUrl}</link>
    <language>en-us</language>
    <itunes:author>Sundaram Labs</itunes:author>
    <itunes:summary>Your daily 15-minute conversational deep dive into latest AI developments.</itunes:summary>
    ${items}
  </channel>
</rss>`;
}