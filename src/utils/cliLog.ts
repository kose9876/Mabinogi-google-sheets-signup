import { ButtonInteraction, ChatInputCommandInteraction } from "discord.js";

function getTimestamp(): string {
  return new Date().toLocaleString("sv-SE", {
    timeZone: "Asia/Taipei",
    hour12: false
  });
}

function quoteValue(value: string): string {
  return JSON.stringify(value);
}

export function formatUserLog(user: { username: string; id: string }): string {
  return `${user.username}(${user.id})`;
}

export function formatCommandOptions(interaction: ChatInputCommandInteraction): string {
  const pairs = interaction.options.data.flatMap((option) => {
    if (option.options?.length) {
      return option.options.map((nested) => `${nested.name}=${quoteValue(String(nested.value ?? ""))}`);
    }

    return `${option.name}=${quoteValue(String(option.value ?? ""))}`;
  });

  return pairs.length > 0 ? pairs.join(" ") : "(no args)";
}

export function formatButtonLog(interaction: ButtonInteraction, extra?: Record<string, string>): string {
  const details = Object.entries(extra ?? {})
    .map(([key, value]) => `${key}=${quoteValue(value)}`)
    .join(" ");

  return details ? `${interaction.customId} ${details}` : interaction.customId;
}

export function logCliInfo(message: string): void {
  console.log(`[${getTimestamp()}] ${message}`);
}

export function logCliError(message: string, error: unknown): void {
  console.error(`[${getTimestamp()}] ${message}`, error);
}
