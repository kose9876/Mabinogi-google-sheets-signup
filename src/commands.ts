import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel
} from "discord.js";
import { signupService } from "./services/signupService";
import { dayLabels, dayOrder, getDayDateText, getWeekRangeText } from "./utils/time";

export const commands = [
  new SlashCommandBuilder()
    .setName("signup-panel")
    .setDescription("發送下週日期報名面板")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("要發送報名面板的頻道")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("signup-status")
    .setDescription("查看指定週次的日期報名狀況")
    .addStringOption((option) =>
      option
        .setName("week_key")
        .setDescription("週一日期，例如 2026-03-30；不填則使用下週")
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("signup-prune")
    .setDescription("手動清除報名資料，方便測試週次切換")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName("mode")
        .setDescription("清理模式")
        .addChoices(
          { name: "只保留目前管理週", value: "keep_current" },
          { name: "清空全部報名", value: "clear_all" }
        )
        .setRequired(true)
    )
].map((command) => command.toJSON());

function requireTextChannel(
  interaction: ChatInputCommandInteraction,
  optionName: string
): TextChannel | null {
  const channel = interaction.options.getChannel(optionName, true);
  return channel instanceof TextChannel ? channel : null;
}

export function buildSignupButtons(weekKey: string): ActionRowBuilder<ButtonBuilder>[] {
  const weekdayButtons = dayOrder.slice(0, 5).map((dayKey) =>
    new ButtonBuilder()
      .setCustomId(`signup:${weekKey}:${dayKey}`)
      .setLabel(`${dayLabels[dayKey]} ${getDayDateText(weekKey, dayKey)}`)
      .setStyle(ButtonStyle.Primary)
  );

  const weekendButtons = dayOrder.slice(5).map((dayKey) =>
    new ButtonBuilder()
      .setCustomId(`signup:${weekKey}:${dayKey}`)
      .setLabel(`${dayLabels[dayKey]} ${getDayDateText(weekKey, dayKey)}`)
      .setStyle(ButtonStyle.Success)
  );

  const allButton = new ButtonBuilder()
    .setCustomId(`signup:${weekKey}:day_all`)
    .setLabel("我要打全部")
    .setStyle(ButtonStyle.Danger);

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(weekdayButtons),
    new ActionRowBuilder<ButtonBuilder>().addComponents(weekendButtons),
    new ActionRowBuilder<ButtonBuilder>().addComponents(allButton)
  ];
}

export async function buildSignupPanelPayload(weekKey: string): Promise<{
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
}> {
  const summary = await signupService.buildSummaryText(weekKey);
  const embed = new EmbedBuilder()
    .setTitle(`${getWeekRangeText(weekKey)} 日期報名`)
    .setDescription(summary)
    .setColor(0x1c7ed6);

  return {
    embeds: [embed],
    components: buildSignupButtons(weekKey)
  };
}

export async function handleChatCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (interaction.commandName === "signup-panel") {
    const channel = requireTextChannel(interaction, "channel");
    if (!channel) {
      await interaction.reply({ content: "請選擇文字頻道。", flags: "Ephemeral" });
      return;
    }

    const weekKey = signupService.getManagedWeekKey();
    const payload = await buildSignupPanelPayload(weekKey);
    await channel.send(payload);
    await interaction.reply({ content: `已發送 ${getWeekRangeText(weekKey)} 的報名面板到 <#${channel.id}>。`, flags: "Ephemeral" });
    return;
  }

  if (interaction.commandName === "signup-status") {
    const weekKey = interaction.options.getString("week_key") || signupService.getManagedWeekKey();
    const summary = await signupService.buildSummaryText(weekKey);
    const embed = new EmbedBuilder()
      .setTitle(`${getWeekRangeText(weekKey)} 日期報名狀態`)
      .setDescription(summary)
      .setColor(0xf08c00);

    await interaction.reply({ embeds: [embed], flags: "Ephemeral" });
    return;
  }

  if (interaction.commandName === "signup-prune") {
    const mode = interaction.options.getString("mode", true);
    await interaction.deferReply({ flags: "Ephemeral" });

    if (mode === "keep_current") {
      const removedCount = await signupService.pruneToManagedWeek();
      const weekKey = signupService.getManagedWeekKey();
      await interaction.editReply(`已清理 ${removedCount} 筆舊報名資料，保留 ${getWeekRangeText(weekKey)} 這一週。`);
      return;
    }

    if (mode === "clear_all") {
      const removedCount = await signupService.clearAllSignups();
      await interaction.editReply(`已清空全部報名資料，共刪除 ${removedCount} 筆。`);
      return;
    }

    await interaction.editReply("未知的清理模式。");
  }
}
