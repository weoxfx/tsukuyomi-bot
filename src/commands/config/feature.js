import { PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import Guild from '../../models/Guild.js';
import { successEmbed, errorEmbed, infoEmbed, GLYPHS } from '../../utils/embeds.js';
import { hasModPerms } from '../../utils/helpers.js';

const featureCategories = {
  economy: {
    name: '💰 Economy',
    commands: ['balance', 'daily', 'shop', 'inventory', 'profile', 'setprofile', 'setbackground', 'claim', 'addcoins', 'rep']
  },
  gambling: {
    name: '🎰 Gambling',
    commands: ['slots', 'blackjack', 'coinflip', 'dice', 'roulette', 'adventure']
  },
  leveling: {
    name: '📊 Leveling',
    commands: ['level', 'rank', 'top', 'leaderboard', 'xp', 'levelup']
  },
  games: {
    name: '🎮 Games',
    commands: ['trivia', 'tictactoe']
  },
  fun: {
    name: '😂 Fun',
    commands: ['meme', 'gif', 'poll']
  },
  tickets: {
    name: '🎫 Tickets',
    commands: ['ticket', 'ticketpanel']
  },
  afk: {
    name: '💤 AFK',
    commands: ['afk']
  },
  welcome: {
    name: '👋 Welcome & Goodbye',
    commands: ['welcome', 'goodbye']
  },
  boost: {
    name: '💎 Server Boost',
    commands: ['boost'],
    isFeatureToggle: true,
    featurePath: 'features.boostSystem.enabled'
  },
  profilecustomization: {
    name: '🎨 Profile Customization',
    commands: [],
    isFeatureToggle: true
  }
};

const protectedCommands = ['help', 'config', 'feature', 'setup'];

export default {
  name: 'feature',
  description: 'Enable or disable bot features and commands',
  usage: '<enable|disable|status> <feature|command>',
  aliases: ['features', 'toggle', 'cmd', 'command'],
  category: 'config',
  permissions: [PermissionFlagsBits.ManageGuild],
  cooldown: 3,

  async execute(message, args, client) {
    const guildId = message.guild.id;
    const guildConfig = await Guild.getGuild(guildId);

    if (!hasModPerms(message.member, guildConfig)) {
      return message.reply({
        embeds: [await errorEmbed(guildId, 'Permission Denied',
          `${GLYPHS.LOCK} You need Moderator/Staff permissions to manage features.`)]
      });
    }

    if (!args[0]) {
      return showFeatureMenu(message, guildConfig);
    }

    const action = args[0].toLowerCase();

    if (action === 'list' || action === 'disabled') {
      return showDisabledList(message, guildConfig);
    }

    if (action === 'status') {
      const feature = args[1]?.toLowerCase();
      if (!feature) return showFeatureMenu(message, guildConfig);
      return showFeatureStatus(message, guildConfig, feature);
    }

    if (action === 'enable' || action === 'disable') {
      const target = args[1]?.toLowerCase();
      if (!target) {
        const embed = await errorEmbed(guildId, 'Missing Target',
          `${GLYPHS.ERROR} Please specify a feature or command.\n\n` +
          `**Usage:**\n` +
          `${GLYPHS.ARROW_RIGHT} \`feature ${action} <feature>\` - ${action} a feature category\n` +
          `${GLYPHS.ARROW_RIGHT} \`feature ${action} <command>\` - ${action} a single command\n\n` +
          `**Features:** ${Object.keys(featureCategories).map(f => `\`${f}\``).join(', ')}`
        );
        return message.reply({ embeds: [embed] });
      }
      return toggleFeature(message, guildConfig, target, action === 'enable', client);
    }

    if (featureCategories[action]) {
      return showFeatureStatus(message, guildConfig, action);
    }

    return showFeatureMenu(message, guildConfig);
  }
};

async function showFeatureMenu(message, guildConfig) {
  const disabledText = guildConfig.textCommands?.disabledCommands || [];
  const disabledSlash = guildConfig.slashCommands?.disabledCommands || [];

  let description = `**Manage bot features and commands**\n\n`;

  for (const [key, category] of Object.entries(featureCategories)) {
    if (category.isFeatureToggle) {
      if (key === 'profilecustomization') {
        const enabled = guildConfig.economy?.profileCustomization?.enabled !== false;
        description += `${enabled ? '✅' : '❌'} **${category.name}** - Feature toggle\n`;
      } else if (key === 'boost') {
        const enabled = guildConfig.features?.boostSystem?.enabled;
        description += `${enabled ? '✅' : '❌'} **${category.name}** - Feature toggle\n`;
      }
      continue;
    }

    const disabledCount = category.commands.filter(cmd =>
      disabledText.includes(cmd) || disabledSlash.includes(cmd)
    ).length;
    const status = disabledCount === 0 ? '✅' : disabledCount === category.commands.length ? '❌' : '⚠️';
    description += `${status} **${category.name}** - ${category.commands.length} commands\n`;
  }

  description += `\n**Commands:**\n`;
  description += `${GLYPHS.ARROW_RIGHT} \`feature enable <feature>\` - Enable a feature\n`;
  description += `${GLYPHS.ARROW_RIGHT} \`feature disable <feature>\` - Disable a feature\n`;
  description += `${GLYPHS.ARROW_RIGHT} \`feature status <feature>\` - View feature status\n`;
  description += `${GLYPHS.ARROW_RIGHT} \`feature list\` - List all disabled commands\n`;
  description += `${GLYPHS.ARROW_RIGHT} \`feature enable <command>\` - Enable single command\n`;
  description += `${GLYPHS.ARROW_RIGHT} \`feature disable <command>\` - Disable single command`;

  const embed = new EmbedBuilder()
    .setTitle('🔧 Feature Management')
    .setDescription(description)
    .setColor('#667eea')
    .setFooter({ text: '✅ Enabled | ❌ Disabled | ⚠️ Partially disabled' });

  return message.reply({ embeds: [embed] });
}

async function showDisabledList(message, guildConfig) {
  const guildId = message.guild.id;
  const disabledText = guildConfig.textCommands?.disabledCommands || [];
  const disabledSlash = guildConfig.slashCommands?.disabledCommands || [];

  let description = '';

  if (disabledText.length > 0) {
    description += `**Disabled Text Commands (${disabledText.length}):**\n`;
    description += disabledText.map(c => `${GLYPHS.DOT} \`${c}\``).join('\n');
    description += '\n\n';
  }

  if (disabledSlash.length > 0) {
    description += `**Disabled Slash Commands (${disabledSlash.length}):**\n`;
    description += disabledSlash.map(c => `${GLYPHS.DOT} \`/${c}\``).join('\n');
  }

  if (!description) {
    description = `${GLYPHS.SUCCESS} No commands are currently disabled!\n\nAll bot features are active.`;
  }

  const embed = await infoEmbed(guildId, '📋 Disabled Commands', description);
  return message.reply({ embeds: [embed] });
}

async function showFeatureStatus(message, guildConfig, feature) {
  const guildId = message.guild.id;

  if (feature === 'profilecustomization' || feature === 'profilecustom' || feature === 'customization') {
    const profileEnabled = guildConfig.economy?.profileCustomization?.enabled !== false;
    const cardOverlay = guildConfig.economy?.cardOverlay || { color: '#000000', opacity: 0.5 };

    const embed = new EmbedBuilder()
      .setTitle('🎨 Profile Customization Status')
      .setColor(profileEnabled ? '#00FF7F' : '#FF4757')
      .setDescription(
        `**Status:** ${profileEnabled ? '✅ Enabled (Users can customize)' : '❌ Disabled (Admin controls)'}\n\n` +
        (profileEnabled
          ? `**When enabled (current):**\n` +
          `Users can customize their own overlay:\n` +
          `• \`setprofile overlay color <hex>\`\n` +
          `• \`setprofile overlay opacity <0-100>\`\n\n` +
          `**Commands:**\n` +
          `${GLYPHS.ARROW_RIGHT} \`feature disable profilecustomization\` - Take control as admin`
          : `**When disabled (current):**\n` +
          `Server overlay applies to all profiles:\n` +
          `• Color: \`${cardOverlay.color}\`\n` +
          `• Opacity: \`${Math.round(cardOverlay.opacity * 100)}%\`\n\n` +
          `**Admin Commands:**\n` +
          `${GLYPHS.ARROW_RIGHT} \`setoverlay color <hex>\` - Set overlay color\n` +
          `${GLYPHS.ARROW_RIGHT} \`setoverlay opacity <0-100>\` - Set overlay opacity\n\n` +
          `${GLYPHS.ARROW_RIGHT} \`feature enable profilecustomization\` - Let users customize`)
      )
      .setFooter({ text: 'Background changes via shop/inventory always work' });

    return message.reply({ embeds: [embed] });
  }

  if (feature === 'boost' || feature === 'boostsystem' || feature === 'boosts') {
    const boostConfig = guildConfig.features?.boostSystem || {};
    const boostChannel = boostConfig.channelId ? message.guild.channels.cache.get(boostConfig.channelId) : null;

    const embed = new EmbedBuilder()
      .setTitle('💎 Server Boost Status')
      .setColor(boostConfig.enabled ? '#FF73FA' : '#FF4757')
      .setDescription(
        `**Status:** ${boostConfig.enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
        `**Channel:** ${boostChannel ? `<#${boostChannel.id}>` : 'Not set'}\n\n` +
        `**Commands:**\n` +
        `${GLYPHS.ARROW_RIGHT} \`feature enable boost\` - Enable boost announcements\n` +
        `${GLYPHS.ARROW_RIGHT} \`feature disable boost\` - Disable boost announcements\n` +
        `${GLYPHS.ARROW_RIGHT} \`boost channel #channel\` - Set boost channel\n` +
        `${GLYPHS.ARROW_RIGHT} \`boost message <text>\` - Set thank you message`
      )
      .setFooter({ text: 'Configure with the boost command' });

    return message.reply({ embeds: [embed] });
  }

  const category = featureCategories[feature];

  if (!category) {
    const embed = await errorEmbed(guildId, 'Unknown Feature',
      `${GLYPHS.ERROR} \`${feature}\` is not a valid feature.\n\n` +
      `**Available features:**\n${Object.keys(featureCategories).map(f => `\`${f}\``).join(', ')}`
    );
    return message.reply({ embeds: [embed] });
  }

  const disabledText = guildConfig.textCommands?.disabledCommands || [];
  const disabledSlash = guildConfig.slashCommands?.disabledCommands || [];

  const commandStatus = category.commands.map(cmd => {
    const textDisabled = disabledText.includes(cmd);
    const slashDisabled = disabledSlash.includes(cmd);
    let icon = '✅';
    if (textDisabled && slashDisabled) icon = '❌';
    else if (textDisabled || slashDisabled) icon = '⚠️';
    return `${icon} \`${cmd}\``;
  });

  const enabledCount = category.commands.filter(cmd =>
    !disabledText.includes(cmd) && !disabledSlash.includes(cmd)
  ).length;

  const embed = new EmbedBuilder()
    .setTitle(`${category.name} Status`)
    .setDescription(commandStatus.join('\n'))
    .setColor(enabledCount === category.commands.length ? '#57F287' : enabledCount === 0 ? '#ED4245' : '#FEE75C')
    .addFields({ name: 'Summary', value: `${enabledCount}/${category.commands.length} commands enabled` })
    .setFooter({ text: '✅ Enabled | ❌ Disabled | ⚠️ Partially disabled' });

  return message.reply({ embeds: [embed] });
}

async function toggleFeature(message, guildConfig, target, isEnabling, client) {
  const guildId = message.guild.id;

  if (target === 'profilecustomization' || target === 'profilecustom' || target === 'customization') {
    await Guild.updateGuild(guildId, { $set: { 'economy.profileCustomization.enabled': isEnabling } });
    const embed = await successEmbed(guildId,
      `Profile Customization ${isEnabling ? 'Enabled' : 'Disabled'}`,
      `${GLYPHS.SUCCESS} **🎨 Profile Customization** has been ${isEnabling ? 'enabled' : 'disabled'}.\n\n` +
      (isEnabling
        ? `Users can now customize their own overlay color and opacity using:\n` +
        `• \`setprofile overlay color <hex>\`\n` +
        `• \`setprofile overlay opacity <0-100>\``
        : `Users can no longer customize their overlay. Use \`setoverlay\` to set server-wide overlay settings.`)
    );
    return message.reply({ embeds: [embed] });
  }

  if (target === 'boost' || target === 'boostsystem' || target === 'boosts') {
    await Guild.updateGuild(guildId, { $set: { 'features.boostSystem.enabled': isEnabling } });
    const embed = await successEmbed(guildId,
      `Boost Announcements ${isEnabling ? 'Enabled' : 'Disabled'}`,
      `${GLYPHS.SUCCESS} **💎 Boost Announcements** have been ${isEnabling ? 'enabled' : 'disabled'}.`
    );
    return message.reply({ embeds: [embed] });
  }

  const category = featureCategories[target];
  let commandsToManage = [];
  let featureName = '';

  if (category) {
    commandsToManage = category.commands;
    featureName = category.name;
  } else {
    const commandExists = client.commands.has(target) || client.aliases?.has(target);
    if (!commandExists) {
      const embed = await errorEmbed(guildId, 'Not Found',
        `${GLYPHS.ERROR} \`${target}\` is not a valid feature or command.\n\n` +
        `**Features:** ${Object.keys(featureCategories).map(f => `\`${f}\``).join(', ')}\n\n` +
        `Or use a valid command name.`
      );
      return message.reply({ embeds: [embed] });
    }
    const actualCommand = client.commands.get(target) || client.commands.get(client.aliases.get(target));
    commandsToManage = [actualCommand?.name || target];
    featureName = `Command: ${commandsToManage[0]}`;
  }

  const disabledText = [...(guildConfig.textCommands?.disabledCommands || [])];
  const disabledSlash = [...(guildConfig.slashCommands?.disabledCommands || [])];
  let skippedProtected = [];

  for (const cmd of commandsToManage) {
    if (!isEnabling && protectedCommands.includes(cmd)) {
      skippedProtected.push(cmd);
      continue;
    }
    if (isEnabling) {
      const textIdx = disabledText.indexOf(cmd);
      if (textIdx > -1) disabledText.splice(textIdx, 1);
      const slashIdx = disabledSlash.indexOf(cmd);
      if (slashIdx > -1) disabledSlash.splice(slashIdx, 1);
    } else {
      if (!disabledText.includes(cmd)) disabledText.push(cmd);
      if (!disabledSlash.includes(cmd)) disabledSlash.push(cmd);
    }
  }

  await Guild.updateGuild(guildId, {
    $set: {
      'textCommands.disabledCommands': disabledText,
      'slashCommands.disabledCommands': disabledSlash
    }
  });

  let description = `${GLYPHS.SUCCESS} **${featureName}** has been ${isEnabling ? 'enabled' : 'disabled'}.\n\n`;
  description += `**Commands affected:** ${commandsToManage.length - skippedProtected.length}\n`;
  if (commandsToManage.length <= 10) {
    description += `**Commands:** ${commandsToManage.filter(c => !skippedProtected.includes(c)).map(c => `\`${c}\``).join(', ')}`;
  }
  if (skippedProtected.length > 0) {
    description += `\n\n⚠️ **Skipped (protected):** ${skippedProtected.map(c => `\`${c}\``).join(', ')}`;
  }

  const embed = await successEmbed(guildId, `Feature ${isEnabling ? 'Enabled' : 'Disabled'}`, description);
  return message.reply({ embeds: [embed] });
}
