import { GoogleAuth } from "google-auth-library";
import { google, sheets_v4 } from "googleapis";
import { config } from "../config";

type Row = Record<string, string>;

export class GoogleSheetsService {
  private sheets: sheets_v4.Sheets;

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
      return;
    }
  }

  async appendRow(sheetName: string, row: string[]): Promise<void> {
    await this.sheets.spreadsheets.values.append({
      spreadsheetId: config.googleSheetId,
      range: `${sheetName}!A:Z`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [row]
      }
    });
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
