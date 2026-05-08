import cron from 'node-cron';
import Guild from '../models/Guild.js';
import BoosterRole from '../models/BoosterRole.js';
import { cleanupTempChannels } from '../events/client/tempVoiceHandler.js';

// Remove expired temporary booster roles - runs every 24 hours at 1 AM
export function startBoosterRoleRemover(client) {
  cron.schedule('0 1 * * *', async () => {
    console.log('🎁 Checking for expired booster roles...');

    try {
      const expiredRoles = await BoosterRole.getExpiredRoles();

      if (expiredRoles.length === 0) {
        console.log('[BOT] No expired booster roles to remove.');
        return;
      }

      let removedCount = 0;
      let failedCount = 0;

      for (const entry of expiredRoles) {
        try {
          const guild = client.guilds.cache.get(entry.guildId);
          if (!guild) {
            await BoosterRole.removeBoosterRole(entry.guildId, entry.userId, entry.roleId);
            continue;
          }

          const member = await guild.members.fetch(entry.userId).catch(() => null);
          if (!member) {
            await BoosterRole.removeBoosterRole(entry.guildId, entry.userId, entry.roleId);
            continue;
          }

          const role = guild.roles.cache.get(entry.roleId);
          if (!role) {
            await BoosterRole.removeBoosterRole(entry.guildId, entry.userId, entry.roleId);
            continue;
          }

          if (member.roles.cache.has(entry.roleId)) {
            await member.roles.remove(role, 'Temporary booster role expired');
            console.log(`[BOT] Removed expired booster role from ${member.user.tag} in ${guild.name}`);
            removedCount++;
          }

          await BoosterRole.removeBoosterRole(entry.guildId, entry.userId, entry.roleId);

        } catch (error) {
          console.error(`[BOT] Error removing booster role for ${entry.userId}:`, error.message);
          failedCount++;
          await BoosterRole.removeBoosterRole(entry.guildId, entry.userId, entry.roleId).catch(() => {});
        }
      }

      console.log(`[BOT] Booster role cleanup complete. Removed: ${removedCount}, Failed: ${failedCount}`);

    } catch (error) {
      console.error('[BOT] Error in booster role remover:', error);
    }
  });

  // Also run on startup to catch any missed removals
  setTimeout(async () => {
    console.log('[BOT] Running initial booster role check on startup...');
    try {
      const expiredRoles = await BoosterRole.getExpiredRoles();

      for (const entry of expiredRoles) {
        try {
          const guild = client.guilds.cache.get(entry.guildId);
          if (!guild) {
            await BoosterRole.removeBoosterRole(entry.guildId, entry.userId, entry.roleId);
            continue;
          }

          const member = await guild.members.fetch(entry.userId).catch(() => null);
          if (!member) {
            await BoosterRole.removeBoosterRole(entry.guildId, entry.userId, entry.roleId);
            continue;
          }

          const role = guild.roles.cache.get(entry.roleId);
          if (role && member.roles.cache.has(entry.roleId)) {
            await member.roles.remove(role, 'Temporary booster role expired');
            console.log(`[BOT] Startup cleanup: Removed expired booster role from ${member.user.tag}`);
          }

          await BoosterRole.removeBoosterRole(entry.guildId, entry.userId, entry.roleId);
        } catch (error) {
          console.error(`[BOT] Startup cleanup error for ${entry.userId}:`, error.message);
        }
      }
    } catch (error) {
      console.error('[BOT] Error in startup booster role check:', error);
    }
  }, 10000);

  console.log('[BOT] Booster role removal scheduler initialized (runs daily at 1 AM).');
}

// Clean up bot economy and member entries daily at midnight
export function startBotEconomyCleanup(client) {
  cron.schedule('0 0 * * *', async () => {
    console.log('🧹 Cleaning up bot economy and member entries...');

    try {
      const Economy = (await import('../models/Economy.js')).default;
      const Member = (await import('../models/Member.js')).default;

      let totalEconomyDeleted = 0;
      let totalMemberDeleted = 0;
      const guilds = client.guilds.cache;

      for (const [guildId, guild] of guilds) {
        try {
          await guild.members.fetch();

          const economyEntries = await Economy.find({ guildId });
          const memberEntries = await Member.find({ guildId });

          for (const entry of economyEntries) {
            try {
              const user = await client.users.fetch(entry.userId).catch(() => null);
              if ((user && user.bot) || entry.userId === client.user.id) {
                await Economy.deleteOne({ _id: entry._id });
                totalEconomyDeleted++;
              }
            } catch (error) {
              console.error(`Error checking user ${entry.userId}:`, error.message);
            }
          }

          for (const entry of memberEntries) {
            try {
              const user = await client.users.fetch(entry.userId).catch(() => null);
              if ((user && user.bot) || entry.userId === client.user.id) {
                await Member.deleteOne({ _id: entry._id });
                totalMemberDeleted++;
              }
            } catch (error) {
              console.error(`Error checking member ${entry.userId}:`, error.message);
            }
          }
        } catch (error) {
          console.error(`Error processing guild ${guildId}:`, error.message);
        }
      }

      console.log(`🧹 Bot cleanup complete. Deleted ${totalEconomyDeleted} economy entries and ${totalMemberDeleted} member entries.`);
    } catch (error) {
      console.error('Error in bot economy and member cleanup:', error);
    }
  });

  console.log('[BOT] Bot economy and member cleanup scheduler initialized (runs daily at midnight).');
}

// Initialize all schedulers
export function initializeSchedulers(client) {
  startBoosterRoleRemover(client);
  startBotEconomyCleanup(client);

  // Cleanup orphaned temp channels on startup
  cleanupTempChannels(client);
}
