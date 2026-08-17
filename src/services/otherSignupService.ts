import { randomBytes } from "crypto";
import { config } from "../config";
import { OtherSignupRecord } from "../types";
import { getDateText, nowIso } from "../utils/time";
import { googleSheetsService } from "./googleSheets";

const otherSignupHeaders = [
  "eventId",
  "date",
  "dungeonName",
  "discordUserId",
  "username",
  "gameName",
  "updatedAt"
];

export type OtherSignupUser = {
  discordUserId: string;
  username: string;
  gameName: string;
};

export type EventSummary = {
  eventId: string;
  date: string;
  dungeonName: string;
  users: OtherSignupRecord[];
};

export class OtherSignupService {
  async init(): Promise<void> {
    await googleSheetsService.ensureSheet(config.otherSignupsSheetName, otherSignupHeaders);
  }

  async createEvent(date: string, dungeonName: string): Promise<EventSummary> {
    const eventId = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
    const trimmedDungeonName = dungeonName.trim();
    await googleSheetsService.appendRow(config.otherSignupsSheetName, [
      eventId,
      date,
      trimmedDungeonName,
      "",
      "",
      "",
      nowIso()
    ]);
    return { eventId, date, dungeonName: trimmedDungeonName, users: [] };
  }

  async join(eventId: string, user: OtherSignupUser): Promise<string> {
    const summary = await this.getSummary(eventId);
    if (summary.users.some((participant) => participant.discordUserId === user.discordUserId)) {
      return `${user.gameName} 已經參加 ${summary.dungeonName}。`;
    }

    await googleSheetsService.appendRow(config.otherSignupsSheetName, [
      summary.eventId,
      summary.date,
      summary.dungeonName,
      user.discordUserId,
      user.username,
      user.gameName,
      nowIso()
    ]);
    return `已加入 ${summary.dungeonName}。`;
  }

  async leave(eventId: string, user: OtherSignupUser): Promise<string> {
    const { summary, rows } = await this.getSummaryAndRows(eventId);
    const rowNumbers = rows
      .filter((row) => row.discordUserId === user.discordUserId)
      .map((row) => row.sheetRowNumber)
      .filter((rowNumber): rowNumber is number => typeof rowNumber === "number");

    if (rowNumbers.length === 0) {
      return `${user.gameName} 目前沒有參加 ${summary.dungeonName}。`;
    }

    await googleSheetsService.deleteRows(config.otherSignupsSheetName, rowNumbers);
    return `已取消參加 ${summary.dungeonName}。`;
  }

  async getSummary(eventId: string): Promise<EventSummary> {
    return (await this.getSummaryAndRows(eventId)).summary;
  }

  buildSummaryText(summary: EventSummary): string {
    const names = summary.users.length > 0
      ? summary.users.map((user) => user.gameName || user.username).join("、")
      : "尚無人參加";
    return [
      `${getDateText(summary.date)} ${summary.dungeonName} 報名`,
      "",
      `目前參加：${summary.users.length} 人`,
      "",
      names
    ].join("\n");
  }

  private async getSummaryAndRows(eventId: string): Promise<{
    summary: EventSummary;
    rows: OtherSignupRecord[];
  }> {
    const rows = (await googleSheetsService.getRows(config.otherSignupsSheetName)) as unknown as OtherSignupRecord[];
    const matched = rows.filter((row) => row.eventId === eventId);
    if (matched.length === 0) {
      throw new Error(`Event not found: ${eventId}`);
    }

    const first = matched[0];
    return {
      summary: {
        eventId: first.eventId,
        date: first.date,
        dungeonName: first.dungeonName,
        users: matched.filter((row) => Boolean(row.discordUserId))
      },
      rows: matched
    };
  }
}

export const otherSignupService = new OtherSignupService();
