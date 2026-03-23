export type MemberRecord = {
  discordUserId: string;
  username: string;
  displayName: string;
  gameName: string;
};

export type WeeklySignupRecord = {
  weekKey: string;
  discordUserId: string;
  username: string;
  gameName: string;
  dayKey: string;
  dayLabel: string;
  updatedAt: string;
  displayName?: string;
  sheetRowNumber?: number;
};
