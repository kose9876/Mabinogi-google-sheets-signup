import path from "path";
import dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  discordToken: requireEnv("DISCORD_TOKEN"),
  discordClientId: requireEnv("DISCORD_CLIENT_ID"),
  discordGuildId: requireEnv("DISCORD_GUILD_ID"),
  googleSheetId: requireEnv("GOOGLE_SHEET_ID"),
  googleCredentialsPath: path.resolve(
    process.cwd(),
    process.env.GOOGLE_APPLICATION_CREDENTIALS || "./credentials.json"
  ),
  membersSheetName: process.env.MEMBERS_SHEET_NAME || "members",
  signupsSheetName: process.env.SIGNUPS_SHEET_NAME || "signups",
  signupChannelId: process.env.SIGNUP_CHANNEL_ID || "",
  maxSignupsPerDay: Number(process.env.MAX_SIGNUPS_PER_DAY || "8")
};
