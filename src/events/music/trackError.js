/**
 * Music Track Error Event Handler
 * Handles errors during track playback
 */

import Event from '../../structures/Event.js';

class MusicTrackError extends Event {
  constructor(client, file) {
    super(client, file, {
      name: 'musicTrackError'
    });
  }

  async run(player, track, payload) {
    try {
      const channel = this.client.channels.cache.get(player.textChannel);
      if (!channel) return;

      this.client.logger.error(`Track error for ${track?.info?.title}:`, payload);

      await channel.send({
        embeds: [{
          color: 0xff4757,
          title: '『 Playback Error 』',
          description: `**Error:** Track processing failure detected for: **${track?.info?.title || 'Unknown Track'}**\n\n**Notice:** Proceeding to next queue entry, Master.`,
          timestamp: new Date().toISOString()
        }]
      });

      // Riffy's internal trackError handler already calls player.stop()
      // which triggers trackEnd → play(). Don't call stop() again here.
    } catch (error) {
      this.client.logger.error('Error in musicTrackError event:', error);
    }
  }
}

export default MusicTrackError;
