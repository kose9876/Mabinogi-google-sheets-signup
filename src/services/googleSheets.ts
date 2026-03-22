import { GoogleAuth } from "google-auth-library";
import { google, sheets_v4 } from "googleapis";
import { config } from "../config";

type Row = Record<string, string>;

export class GoogleSheetsService {
  private sheets: sheets_v4.Sheets;
  private nextRowIndexBySheet = new Map<string, number>();

  constructor() {
    const auth = new GoogleAuth({
      keyFile: config.googleCredentialsPath,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });

    this.sheets = google.sheets({ version: "v4", auth });
  }

  async ensureSheet(sheetName: string, headers: string[]): Promise<void> {
    const spreadsheet = await this.sheets.spreadsheets.get({
      spreadsheetId: config.googleSheetId
    });

    const existing = spreadsheet.data.sheets?.some(
      (sheet) => sheet.properties?.title === sheetName
    );

    if (!existing) {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: config.googleSheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName
                }
              }
            }
          ]
        }
      });
    }

    const values = await this.getValues(sheetName);
    if (values.length === 0) {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: config.googleSheetId,
        range: `${sheetName}!A1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [headers]
        }
      });
      this.nextRowIndexBySheet.set(sheetName, 2);
      return;
    }

    this.nextRowIndexBySheet.set(sheetName, values.length + 1);
  }

  async appendRow(sheetName: string, row: string[]): Promise<void> {
    const nextRowIndex = await this.getNextRowIndex(sheetName);

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: config.googleSheetId,
      range: `${sheetName}!A${nextRowIndex}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [row]
      }
    });

    this.nextRowIndexBySheet.set(sheetName, nextRowIndex + 1);
  }

  async getRows(sheetName: string): Promise<Row[]> {
    const values = await this.getValues(sheetName);
    if (values.length < 2) {
      return [];
    }

    const [headers, ...rows] = values;
    return rows.map((row) => {
      const record: Row = {};
      headers.forEach((header, index) => {
        record[header] = row[index] ?? "";
      });
      return record;
    });
  }

  async replaceRows(sheetName: string, headers: string[], rows: string[][]): Promise<void> {
    await this.sheets.spreadsheets.values.clear({
      spreadsheetId: config.googleSheetId,
      range: `${sheetName}!A:Z`
    });

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: config.googleSheetId,
      range: `${sheetName}!A1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [headers, ...rows]
      }
    });

    this.nextRowIndexBySheet.set(sheetName, rows.length + 2);
  }

  private async getNextRowIndex(sheetName: string): Promise<number> {
    const cached = this.nextRowIndexBySheet.get(sheetName);
    if (cached) {
      return cached;
    }

    const values = await this.getValues(sheetName);
    const nextRowIndex = Math.max(values.length + 1, 2);
    this.nextRowIndexBySheet.set(sheetName, nextRowIndex);
    return nextRowIndex;
  }

  private async getValues(sheetName: string): Promise<string[][]> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: config.googleSheetId,
      range: `${sheetName}!A:Z`
    });

    return (response.data.values as string[][] | undefined) ?? [];
  }
}

export const googleSheetsService = new GoogleSheetsService();
