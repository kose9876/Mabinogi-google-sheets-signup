import { config } from "../config";
import { WeeklySignupRecord } from "../types";
import { DayKey, dayLabels, dayOrder, getDayDateText, getSignupWeekKey, getWeekRangeText, nowIso } from "../utils/time";
import { googleSheetsService } from "./googleSheets";

const signupHeaders = [
  "weekKey",
  "discordUserId",
  "username",
  "gameName",
  "dayKey",
  "dayLabel",
  "updatedAt"
];

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

type SignupUser = {
  discordUserId: string;
  username: string;
  gameName: string;
};

type WeeklySummary = {
  weekKey: string;
  dayUsers: Record<DayKey, WeeklySignupRecord[]>;
};

export class SignupService {
  private cleanupTimer?: NodeJS.Timeout;
  private lastPrunedWeekKey = "";

  async init(): Promise<void> {
    await googleSheetsService.ensureSheet(config.signupsSheetName, signupHeaders);
    await this.pruneStaleSignups();
    this.startCleanupTimer();
  }

  async getWeekSignups(weekKey: string): Promise<WeeklySignupRecord[]> {
    await this.pruneStaleSignups();
    const rows = (await googleSheetsService.getRows(config.signupsSheetName)) as unknown as WeeklySignupRecord[];
    return rows.filter((row) => row.weekKey === weekKey && dayOrder.includes(row.dayKey as DayKey));
  }

  async toggleDay(weekKey: string, user: SignupUser, dayKey: DayKey): Promise<{ added: boolean; message: string }> {
    const signups = await this.getWeekSignups(weekKey);
    const alreadyJoined = signups.some(
      (row) => row.discordUserId === user.discordUserId && row.dayKey === dayKey
    );

    if (alreadyJoined) {
      await this.removeDays(weekKey, user.discordUserId, [dayKey]);
      return { added: false, message: `已取消 ${dayLabels[dayKey]} 報名。` };
    }

    if (this.countUsersForDay(signups, dayKey) >= config.maxSignupsPerDay) {
      return { added: false, message: `${dayLabels[dayKey]} 已額滿。` };
    }

    await this.addDays(weekKey, user, [dayKey]);
    return { added: true, message: `已報名 ${dayLabels[dayKey]}。` };
  }

  async toggleAllDays(weekKey: string, user: SignupUser): Promise<string> {
    const signups = await this.getWeekSignups(weekKey);
    const userDays = new Set(
      signups.filter((row) => row.discordUserId === user.discordUserId).map((row) => row.dayKey as DayKey)
    );

    if (userDays.size === dayOrder.length) {
      await this.removeDays(weekKey, user.discordUserId, dayOrder);
      return "已取消全部日期報名。";
    }

    const missingDays = dayOrder.filter((dayKey) => !userDays.has(dayKey));
    const fullDays = missingDays.filter(
      (dayKey) => this.countUsersForDay(signups, dayKey) >= config.maxSignupsPerDay
    );

    if (fullDays.length > 0) {
      return `以下日期已額滿，無法全選：${fullDays.map((dayKey) => dayLabels[dayKey]).join("、")}`;
    }

    await this.addDays(weekKey, user, missingDays);
    return missingDays.length === dayOrder.length ? "已報名全部日期。" : "已補報剩餘日期。";
  }

  async addManualDay(weekKey: string, user: SignupUser, dayKey: DayKey): Promise<string> {
    const signups = await this.getWeekSignups(weekKey);
    const alreadyJoined = signups.some(
      (row) => row.discordUserId === user.discordUserId && row.dayKey === dayKey
    );

    if (alreadyJoined) {
      return `${user.gameName} 已在 ${dayLabels[dayKey]} 報名。`;
    }

    if (this.countUsersForDay(signups, dayKey) >= config.maxSignupsPerDay) {
      return `${dayLabels[dayKey]} 已額滿，無法手動新增。`;
    }

    await this.addDays(weekKey, user, [dayKey]);
    return `已為 ${user.gameName} 新增 ${dayLabels[dayKey]} 報名。`;
  }

  async buildSummaryText(weekKey: string): Promise<string> {
    const summary = await this.getWeeklySummary(weekKey);
    const lines = [
      `${getWeekRangeText(weekKey)} 報名`,
      "",
      `每一天最多 ${config.maxSignupsPerDay} 人，請點按下方按鈕報名或取消。`,
      ""
    ];

    for (const dayKey of dayOrder) {
      const users = summary.dayUsers[dayKey];
      const names = users.length > 0
        ? users.map((row) => row.gameName || row.displayName || row.username).join("、")
        : "尚無人報名";
      lines.push(`${dayLabels[dayKey]} (${getDayDateText(weekKey, dayKey)}) ${users.length}/${config.maxSignupsPerDay}`);
      lines.push(names);
      lines.push("");
    }

    return lines.join("\n").trim();
  }

  getManagedWeekKey(): string {
    return getSignupWeekKey();
  }

  async pruneToManagedWeek(): Promise<number> {
    const managedWeekKey = this.getManagedWeekKey();
    return this.pruneToWeekKey(managedWeekKey);
  }

  async clearAllSignups(): Promise<number> {
    const rows = (await googleSheetsService.getRows(config.signupsSheetName)) as unknown as WeeklySignupRecord[];
    await googleSheetsService.replaceRows(config.signupsSheetName, signupHeaders, []);
    this.lastPrunedWeekKey = this.getManagedWeekKey();
    return rows.length;
  }

  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      void this.pruneStaleSignups().catch((error) => {
        console.error("Failed to prune stale signups:", error);
      });
    }, CLEANUP_INTERVAL_MS);
  }

  private async pruneStaleSignups(): Promise<void> {
    const managedWeekKey = this.getManagedWeekKey();
    if (this.lastPrunedWeekKey === managedWeekKey) {
      return;
    }

    await this.pruneToWeekKey(managedWeekKey);
  }

  private async pruneToWeekKey(weekKey: string): Promise<number> {
    const removedCount = await this.removeWeekRowsExcept(weekKey);
    this.lastPrunedWeekKey = weekKey;
    return removedCount;
  }

  private async getWeeklySummary(weekKey: string): Promise<WeeklySummary> {
    const signups = await this.getWeekSignups(weekKey);
    const dayUsers = {
      day_mon: [],
      day_tue: [],
      day_wed: [],
      day_thu: [],
      day_fri: [],
      day_sat: [],
      day_sun: []
    } as Record<DayKey, WeeklySignupRecord[]>;

    for (const signup of signups) {
      const dayKey = signup.dayKey as DayKey;
      dayUsers[dayKey].push(signup);
    }

    return { weekKey, dayUsers };
  }

  private countUsersForDay(signups: WeeklySignupRecord[], dayKey: DayKey): number {
    return signups.filter((row) => row.dayKey === dayKey).length;
  }

  private async addDays(weekKey: string, user: SignupUser, dayKeys: DayKey[]): Promise<void> {
    for (const dayKey of dayKeys) {
      const record: WeeklySignupRecord = {
        weekKey,
        discordUserId: user.discordUserId,
        username: user.username,
        gameName: user.gameName,
        dayKey,
        dayLabel: dayLabels[dayKey],
        updatedAt: nowIso()
      };

      await googleSheetsService.appendRow(
        config.signupsSheetName,
        signupHeaders.map((header) => String(record[header as keyof WeeklySignupRecord] ?? ""))
      );
    }
  }

  private async removeDays(weekKey: string, discordUserId: string, dayKeys: readonly DayKey[]): Promise<void> {
    const rows = (await googleSheetsService.getRows(config.signupsSheetName)) as unknown as WeeklySignupRecord[];
    const rowNumbersToDelete = rows
      .filter(
        (row) => row.weekKey === weekKey
          && row.discordUserId === discordUserId
          && dayKeys.includes(row.dayKey as DayKey)
      )
      .map((row) => row.sheetRowNumber)
      .filter((rowNumber): rowNumber is number => typeof rowNumber === "number");

    await googleSheetsService.deleteRows(config.signupsSheetName, rowNumbersToDelete);
  }

  private async removeWeekRowsExcept(weekKey: string): Promise<number> {
    const rows = (await googleSheetsService.getRows(config.signupsSheetName)) as unknown as WeeklySignupRecord[];
    const rowNumbersToDelete = rows
      .filter((row) => row.weekKey !== weekKey)
      .map((row) => row.sheetRowNumber)
      .filter((rowNumber): rowNumber is number => typeof rowNumber === "number");

    await googleSheetsService.deleteRows(config.signupsSheetName, rowNumbersToDelete);
    return rowNumbersToDelete.length;
  }
}

export const signupService = new SignupService();
