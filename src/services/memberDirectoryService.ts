import { config } from "../config";
import { MemberRecord } from "../types";
import { googleSheetsService } from "./googleSheets";

const CACHE_TTL_MS = 5 * 60 * 1000;

export class MemberDirectoryService {
  private cacheExpiresAt = 0;
  private gameNameByUserId = new Map<string, string>();

  async getGameName(discordUserId: string): Promise<string | null> {
    await this.ensureCache();
    return this.gameNameByUserId.get(discordUserId) || null;
  }

  private async ensureCache(): Promise<void> {
    if (Date.now() < this.cacheExpiresAt && this.gameNameByUserId.size > 0) {
      return;
    }

    const rows = (await googleSheetsService.getRows(config.membersSheetName)) as MemberRecord[];
    this.gameNameByUserId = new Map(
      rows
        .filter((row) => row.discordUserId && row.gameName)
        .map((row) => [row.discordUserId, row.gameName.trim()])
    );
    this.cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  }
}

export const memberDirectoryService = new MemberDirectoryService();
