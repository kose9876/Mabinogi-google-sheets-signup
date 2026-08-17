import {
  ButtonInteraction,
  Client,
  DiscordAPIError,
  Events,
  GatewayIntentBits,
  TextChannel
} from "discord.js";
import { buildEventPanelPayload, buildSignupPanelPayload, handleChatCommand } from "./commands";
import { config } from "./config";
import { memberDirectoryService } from "./services/memberDirectoryService";
import { otherSignupService } from "./services/otherSignupService";
import { signupService } from "./services/signupService";
import { formatButtonLog, formatUserLog, logCliError, logCliInfo } from "./utils/cliLog";
import { DayKey, dayOrder } from "./utils/time";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

async function handleButton(interaction: ButtonInteraction): Promise<void> {
  const { customId } = interaction;
  const actor = formatUserLog(interaction.user);

  const [scope, key, action] = customId.split(":");
  if (!key || !action || (scope !== "signup" && scope !== "other")) {
    logCliInfo(`button invalid by ${actor} customId=${JSON.stringify(customId)}`);
    await interaction.reply({ content: "未知的按鈕操作。", flags: "Ephemeral" });
    return;
  }

  if (scope === "other") {
    if (action !== "join" && action !== "leave" && action !== "refresh") {
      await interaction.reply({ content: "未知的副本報名操作。", flags: "Ephemeral" });
      return;
    }

    logCliInfo(`button start by ${actor} customId=${JSON.stringify(customId)}`);
    await interaction.deferUpdate();

    let message: string;
    if (action === "refresh") {
      message = "已更新目前報名狀態。";
    } else {
      const fallbackName = interaction.member && "displayName" in interaction.member
        ? interaction.member.displayName
        : interaction.user.globalName || interaction.user.username;
      const gameName = await memberDirectoryService.getGameName(interaction.user.id) || fallbackName;
      const user = {
        discordUserId: interaction.user.id,
        username: interaction.user.username,
        gameName
      };
      message = action === "join"
        ? await otherSignupService.join(key, user)
        : await otherSignupService.leave(key, user);
    }

    const summary = await otherSignupService.getSummary(key);
    await interaction.editReply(buildEventPanelPayload(summary));
    await interaction.followUp({ content: message, flags: "Ephemeral" });
    logCliInfo(`button result by ${actor} customId=${JSON.stringify(customId)} result=${JSON.stringify(message)}`);
    return;
  }

  const weekKey = key;

  if (action !== "day_all" && action !== "refresh" && !dayOrder.includes(action as DayKey)) {
    logCliInfo(`button invalid-day by ${actor} ${formatButtonLog(interaction, { weekKey, action })}`);
    await interaction.reply({ content: "未知的報名日期。", flags: "Ephemeral" });
    return;
  }

  logCliInfo(`button start by ${actor} ${formatButtonLog(interaction, { weekKey, action })}`);
  await interaction.deferUpdate();

  if (action === "refresh") {
    const payload = await buildSignupPanelPayload(weekKey);
    await interaction.editReply(payload);
    const message = "已更新目前報名狀態。";
    await interaction.followUp({ content: message, flags: "Ephemeral" });
    logCliInfo(`button result by ${actor} ${formatButtonLog(interaction, { weekKey, action, result: message })}`);
    return;
  }

  const fallbackName =
    interaction.member && "displayName" in interaction.member
      ? interaction.member.displayName
      : interaction.user.globalName || interaction.user.username;

  const gameName = await memberDirectoryService.getGameName(interaction.user.id) || fallbackName;

  const user = {
    discordUserId: interaction.user.id,
    username: interaction.user.username,
    gameName
  };

  const message = action === "day_all"
    ? await signupService.toggleAllDays(weekKey, user)
    : await signupService.toggleDay(weekKey, user, action as DayKey).then((result) => result.message);

  const payload = await buildSignupPanelPayload(weekKey);
  await interaction.editReply(payload);
  await interaction.followUp({ content: message, flags: "Ephemeral" });
  logCliInfo(`button result by ${actor} ${formatButtonLog(interaction, { weekKey, action, result: message })}`);
}

client.once(Events.ClientReady, async (readyClient) => {
  logCliInfo(`logged in as ${readyClient.user.tag}`);

  if (config.signupChannelId) {
    const channel = await readyClient.channels.fetch(config.signupChannelId);
    if (channel instanceof TextChannel) {
      logCliInfo(`signup channel ready name=${JSON.stringify(channel.name)} id=${channel.id}`);
    }
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await handleChatCommand(interaction);
      return;
    }

    if (interaction.isButton()) {
      await handleButton(interaction);
      return;
    }
  } catch (error) {
    if (interaction.isChatInputCommand()) {
      logCliError(
        `command failed for ${formatUserLog(interaction.user)} command=${interaction.commandName}`,
        error
      );
    } else if (interaction.isButton()) {
      logCliError(
        `button failed for ${formatUserLog(interaction.user)} customId=${JSON.stringify(interaction.customId)}`,
        error
      );
    } else {
      logCliError("interaction handling failed", error);
    }

    if (error instanceof DiscordAPIError && error.code === 10062) {
      return;
    }

    if (interaction.isRepliable()) {
      try {
        const message = "執行時發生錯誤，請稍後再試。";
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: message, flags: "Ephemeral" });
        } else {
          await interaction.reply({ content: message, flags: "Ephemeral" });
        }
      } catch (replyError) {
        logCliError("failed to send interaction error response", replyError);
      }
    }
  }
});

async function main(): Promise<void> {
  await signupService.init();
  await otherSignupService.init();
  await client.login(config.discordToken);
}

main().catch((error) => {
  logCliError("bot startup failed", error);
  process.exit(1);
});
