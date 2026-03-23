import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  TextChannel
} from "discord.js";
import { signupService } from "./services/signupService";
import { dayLabels, dayOrder, getDayDateText, getWeekRangeText } from "./utils/time";

export const commands = [
  new SlashCommandBuilder()
    .setName("signup-panel")
    .setDescription("在目前頻道發送目前管理週的日期報名面板"),
  new SlashCommandBuilder()
    .setName("signup-status")
    .setDescription("查看指定週次的日期報名狀況")
    .addStringOption((option) =>
      option
        .setName("week_key")
        .setDescription("週一日期，例如 2026-03-23；不填則使用目前管理週")
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("signup-prune")
    .setDescription("手動清除報名資料，方便測試週次切換")
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
    .setLabel("我要打全部")
    .setStyle(ButtonStyle.Danger);

  const refreshButton = new ButtonBuilder()
    .setCustomId(`signup:${weekKey}:refresh`)
    .setLabel("狀態更新")
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
    if (!(interaction.channel instanceof TextChannel)) {
      await interaction.reply({ content: "請在文字頻道使用此指令。", flags: "Ephemeral" });
      return;
    }

    const weekKey = signupService.getManagedWeekKey();
    const payload = await buildSignupPanelPayload(weekKey);
    await interaction.channel.send(payload);
    await interaction.reply({ content: `已在目前頻道發送 ${getWeekRangeText(weekKey)} 的報名面板。`, flags: "Ephemeral" });
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
