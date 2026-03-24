import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder
} from "discord.js";
import { memberDirectoryService } from "./services/memberDirectoryService";
import { signupService } from "./services/signupService";
import { formatCommandOptions, formatUserLog, logCliInfo } from "./utils/cliLog";
import { dayLabels, dayOrder, getDayDateText, getWeekRangeText } from "./utils/time";

export const commands = [
  new SlashCommandBuilder()
    .setName("signup-panel")
    .setDescription("在目前頻道發送本週報名面板。"),
  new SlashCommandBuilder()
    .setName("signup-status")
    .setDescription("查看指定週次的報名狀態。")
    .addStringOption((option) =>
      option
        .setName("week_key")
        .setDescription("指定週一日期，例如 2026-03-23；不填則使用目前管理中的那一週")
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("signup-add")
    .setDescription("手動幫指定成員加入某一天的報名。")
    .addUserOption((option) =>
      option
        .setName("member")
        .setDescription("要加入報名的成員")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("day")
        .setDescription("要加入的報名日期")
        .addChoices(
          ...dayOrder.map((dayKey) => ({
            name: dayLabels[dayKey],
            value: dayKey
          }))
        )
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("week_key")
        .setDescription("指定週一日期，例如 2026-03-23；不填則使用目前管理中的那一週")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("game_name")
        .setDescription("手動指定遊戲名稱；不填則優先使用 members 表中的名稱")
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("signup-remove")
    .setDescription("手動取消指定成員某一天的報名。")
    .addUserOption((option) =>
      option
        .setName("member")
        .setDescription("要取消報名的成員")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("day")
        .setDescription("要取消的報名日期")
        .addChoices(
          ...dayOrder.map((dayKey) => ({
            name: dayLabels[dayKey],
            value: dayKey
          }))
        )
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("week_key")
        .setDescription("指定週一日期，例如 2026-03-23；不填則使用目前管理中的那一週")
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("signup-prune")
    .setDescription("清理舊的報名資料。")
    .addStringOption((option) =>
      option
        .setName("mode")
        .setDescription("清理模式")
        .addChoices(
          { name: "保留目前管理週", value: "keep_current" },
          { name: "清空全部報名", value: "clear_all" }
        )
        .setRequired(true)
    )
].map((command) => command.toJSON());

export function buildSignupButtons(weekKey: string): ActionRowBuilder<ButtonBuilder>[] {
  const weekdayButtons = dayOrder.slice(0, 5).map((dayKey) =>
    new ButtonBuilder()
      .setCustomId(`signup:${weekKey}:${dayKey}`)
      .setLabel(`${dayLabels[dayKey]} ${getDayDateText(weekKey, dayKey)}`)
      .setStyle(ButtonStyle.Secondary)
  );

  const weekendButtons = dayOrder.slice(5).map((dayKey) =>
    new ButtonBuilder()
      .setCustomId(`signup:${weekKey}:${dayKey}`)
      .setLabel(`${dayLabels[dayKey]} ${getDayDateText(weekKey, dayKey)}`)
      .setStyle(ButtonStyle.Secondary)
  );

  const allButton = new ButtonBuilder()
    .setCustomId(`signup:${weekKey}:day_all`)
    .setLabel("全選/全取消")
    .setStyle(ButtonStyle.Danger);

  const refreshButton = new ButtonBuilder()
    .setCustomId(`signup:${weekKey}:refresh`)
    .setLabel("重新整理")
    .setStyle(ButtonStyle.Primary);

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(weekdayButtons),
    new ActionRowBuilder<ButtonBuilder>().addComponents([...weekendButtons, allButton, refreshButton])
  ];
}

export async function buildSignupPanelPayload(weekKey: string): Promise<{
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
}> {
  const summary = await signupService.buildSummaryText(weekKey);
  const embed = new EmbedBuilder()
    .setTitle(`${getWeekRangeText(weekKey)} 報名狀態`)
    .setDescription(summary)
    .setColor(0x1c7ed6);

  return {
    embeds: [embed],
    components: buildSignupButtons(weekKey)
  };
}

function logCommandStart(interaction: ChatInputCommandInteraction): void {
  logCliInfo(
    `command start by ${formatUserLog(interaction.user)} command=${interaction.commandName} ${formatCommandOptions(interaction)}`
  );
}

function logCommandResult(interaction: ChatInputCommandInteraction, result: string): void {
  logCliInfo(
    `command result by ${formatUserLog(interaction.user)} command=${interaction.commandName} result=${JSON.stringify(result)}`
  );
}

export async function handleChatCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  logCommandStart(interaction);

  if (interaction.commandName === "signup-panel") {
    const channel = interaction.channel;
    if (!channel?.isTextBased() || !("send" in channel)) {
      const message = "請在文字頻道使用此指令。";
      await interaction.reply({ content: message, flags: "Ephemeral" });
      logCommandResult(interaction, message);
      return;
    }

    const weekKey = signupService.getManagedWeekKey();
    const payload = await buildSignupPanelPayload(weekKey);
    await channel.send(payload);
    const message = `已在目前頻道發送 ${getWeekRangeText(weekKey)} 的報名面板。`;
    await interaction.reply({ content: message, flags: "Ephemeral" });
    logCommandResult(interaction, message);
    return;
  }

  if (interaction.commandName === "signup-status") {
    const weekKey = interaction.options.getString("week_key") || signupService.getManagedWeekKey();
    const summary = await signupService.buildSummaryText(weekKey);
    const embed = new EmbedBuilder()
      .setTitle(`${getWeekRangeText(weekKey)} 報名狀態`)
      .setDescription(summary)
      .setColor(0xf08c00);

    await interaction.reply({ embeds: [embed], flags: "Ephemeral" });
    logCommandResult(interaction, `status shown for week=${weekKey}`);
    return;
  }

  if (interaction.commandName === "signup-add") {
    const targetUser = interaction.options.getUser("member", true);
    const dayKey = interaction.options.getString("day", true) as typeof dayOrder[number];
    const weekKey = interaction.options.getString("week_key") || signupService.getManagedWeekKey();
    const providedGameName = interaction.options.getString("game_name");
    const member = interaction.options.getMember("member");
    const fallbackName = member && "displayName" in member
      ? member.displayName
      : targetUser.globalName || targetUser.username;
    const gameName = providedGameName || await memberDirectoryService.getGameName(targetUser.id) || fallbackName;

    const message = await signupService.addManualDay(weekKey, {
      discordUserId: targetUser.id,
      username: targetUser.username,
      gameName
    }, dayKey);

    await interaction.reply({ content: message, flags: "Ephemeral" });
    logCommandResult(interaction, message);
    return;
  }

  if (interaction.commandName === "signup-remove") {
    const targetUser = interaction.options.getUser("member", true);
    const dayKey = interaction.options.getString("day", true) as typeof dayOrder[number];
    const weekKey = interaction.options.getString("week_key") || signupService.getManagedWeekKey();
    const member = interaction.options.getMember("member");
    const fallbackName = member && "displayName" in member
      ? member.displayName
      : targetUser.globalName || targetUser.username;
    const gameName = await memberDirectoryService.getGameName(targetUser.id) || fallbackName;

    const message = await signupService.removeManualDay(weekKey, {
      discordUserId: targetUser.id,
      username: targetUser.username,
      gameName
    }, dayKey);

    await interaction.reply({ content: message, flags: "Ephemeral" });
    logCommandResult(interaction, message);
    return;
  }

  if (interaction.commandName === "signup-prune") {
    const mode = interaction.options.getString("mode", true);
    await interaction.deferReply({ flags: "Ephemeral" });

    if (mode === "keep_current") {
      const removedCount = await signupService.pruneToManagedWeek();
      const weekKey = signupService.getManagedWeekKey();
      const message = `已清理 ${removedCount} 筆舊報名資料，保留 ${getWeekRangeText(weekKey)} 這一週。`;
      await interaction.editReply(message);
      logCommandResult(interaction, message);
      return;
    }

    if (mode === "clear_all") {
      const removedCount = await signupService.clearAllSignups();
      const message = `已清空全部報名資料，共刪除 ${removedCount} 筆。`;
      await interaction.editReply(message);
      logCommandResult(interaction, message);
      return;
    }

    const message = "未知的清理模式。";
    await interaction.editReply(message);
    logCommandResult(interaction, message);
  }
}
