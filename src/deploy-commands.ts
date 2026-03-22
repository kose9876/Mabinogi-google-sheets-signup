import { REST, Routes } from "discord.js";
import { commands } from "./commands";
import { config } from "./config";

async function main(): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(config.discordToken);

  await rest.put(
    Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId),
    { body: commands }
  );

  console.log("Slash commands deployed.");
}

main().catch((error) => {
  console.error("Failed to deploy commands:", error);
  process.exit(1);
});
