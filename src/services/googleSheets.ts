import { GoogleAuth } from "google-auth-library";
import { google, sheets_v4 } from "googleapis";
import { config } from "../config";

type Row = Record<string, string> & { sheetRowNumber: number };

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
    const values = await this.getValues(sheetName);
    const nextRowIndex = this.getFirstEmptyRowIndex(values);

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: config.googleSheetId,
      range: `${sheetName}!A${nextRowIndex}`,
      valueInputOption: "RAW",
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
    return rows.map((row, index) => {
      const record = { sheetRowNumber: index + 2 } as Row;
      headers.forEach((header, index) => {
        record[header] = row[index] ?? "";
      });
      return record;
    });
  }

  async deleteRows(sheetName: string, rowNumbers: number[]): Promise<void> {
    if (rowNumbers.length === 0) {
      return;
    }

    const sheetId = await this.getSheetId(sheetName);
    const sortedRowNumbers = [...new Set(rowNumbers)].sort((left, right) => right - left);

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: config.googleSheetId,
      requestBody: {
        requests: sortedRowNumbers.map((rowNumber) => ({
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowNumber - 1,
              endIndex: rowNumber
            }
          }
        }))
      }
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

  private async getSheetId(sheetName: string): Promise<number> {
    const spreadsheet = await this.sheets.spreadsheets.get({
      spreadsheetId: config.googleSheetId
    });

    const sheet = spreadsheet.data.sheets?.find((entry) => entry.properties?.title === sheetName);
    const sheetId = sheet?.properties?.sheetId;

    if (sheetId == null) {
      throw new Error(`Sheet not found: ${sheetName}`);
    }

    return sheetId;
  }

  private getFirstEmptyRowIndex(values: string[][]): number {
    if (values.length === 0) {
      return 1;
    }

    for (let index = 1; index < values.length; index += 1) {
      const row = values[index] ?? [];
      if (row.every((cell) => !cell)) {
        return index + 1;
      }
    }

    return values.length + 1;
  }
}

export const googleSheetsService = new GoogleSheetsService();
