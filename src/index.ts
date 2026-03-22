import {
  ButtonInteraction,
  Client,
  DiscordAPIError,
  Events,
  GatewayIntentBits,
  TextChannel
} from "discord.js";
import { buildSignupPanelPayload, handleChatCommand } from "./commands";
import { config } from "./config";
import { memberDirectoryService } from "./services/memberDirectoryService";
import { signupService } from "./services/signupService";
import { DayKey, dayOrder } from "./utils/time";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

async function handleButton(interaction: ButtonInteraction): Promise<void> {
  const { customId } = interaction;

  const [scope, weekKey, action] = customId.split(":");
  if (scope !== "signup" || !weekKey || !action) {
    await interaction.reply({ content: "未知的按鈕操作。", flags: "Ephemeral" });
    return;
  }

  if (action !== "day_all" && !dayOrder.includes(action as DayKey)) {
    await interaction.reply({ content: "未知的報名日期。", flags: "Ephemeral" });
    return;
  }

  await interaction.deferUpdate();

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
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);

  if (config.signupChannelId) {
    const channel = await readyClient.channels.fetch(config.signupChannelId);
    if (channel instanceof TextChannel) {
      console.log(`Signup channel ready: ${channel.name}`);
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
    console.error("Interaction handling failed:", error);

    if (error instanceof DiscordAPIError && error.code === 10062) {
      return;
    }

    if (interaction.isRepliable()) {
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: "執行時發生錯誤，請稍後再試。", flags: "Ephemeral" });
        } else {
          await interaction.reply({ content: "執行時發生錯誤，請稍後再試。", flags: "Ephemeral" });
        }
      } catch (replyError) {
        console.error("Failed to send interaction error response:", replyError);
      }
    }
  }
});

async function main(): Promise<void> {
  await signupService.init();
  await client.login(config.discordToken);
}

main().catch((error) => {
  console.error("Bot startup failed:", error);
  process.exit(1);
});
