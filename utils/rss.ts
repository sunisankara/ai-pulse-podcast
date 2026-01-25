export function generateRSSFeed(episodes: any[]) {
  const items = episodes.map(e => `
    <item>
      <title>${e.title}</title>
      <pubDate>${new Date(e.date).toUTCString()}</pubDate>
      <enclosure url="${e.audioUrl || ''}" type="audio/mpeg" length="0"/>
    </item>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>AI Pulse Feed</title>${items}</channel></rss>`;
}