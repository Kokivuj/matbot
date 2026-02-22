/**
 * Google Apps Script za MatBot
 * 
 * Uputstvo za instalaciju:
 * 1. Otvori Google Sheets (novu ili postojeću tabelu)
 * 2. Idi na Extensions -> Apps Script
 * 3. Obriši sav postojeći kod i nalepi ovaj kod
 * 4. Podesi ime taba na "List1" (ili promeni promenljivu ispod)
 * 5. Klikni na "Deploy" -> "New Deployment"
 * 6. Izaberi "Web app"
 * 7. "Execute as": "Me"
 * 8. "Who has access": "Anyone"
 * 9. Klikni "Deploy" i kopiraj URL (Web App URL) u tvoj MatBot kod (SheetsClient.js)
 */

var TAB_NAME = "List1";

function doGet() {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_NAME);
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var json = [];

    for (var i = 1; i < data.length; i++) {
        var obj = { rowIndex: i + 1 };
        for (var j = 0; j < headers.length; j++) {
            obj[headers[j]] = data[i][j];
        }
        json.push(obj);
    }

    return ContentService.createTextOutput(JSON.stringify(json))
        .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
    var params = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_NAME);

    if (params.action === "add") {
        var lastId = 0;
        if (sheet.getLastRow() > 1) {
            lastId = sheet.getRange(sheet.getLastRow(), 1).getValue();
            if (isNaN(lastId)) lastId = 0;
        }

        // Columns: ID, Datum, Razred, Tip unosa, Originalni zadatak, AI rešenje, AI objašnjenje, Status
        sheet.appendRow([
            lastId + 1,
            params.Datum,
            params.Razred,
            params.TipUnosa,
            params.OriginalniZadatak,
            params.AIResenje,
            params.AIObjasnjenje,
            params.Status || "aktivan"
        ]);

        return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
    }

    if (params.action === "update") {
        var rowIndex = params.rowIndex;
        if (params.Status) sheet.getRange(rowIndex, 8).setValue(params.Status);
        return ContentService.createTextOutput("Updated").setMimeType(ContentService.MimeType.TEXT);
    }

    return ContentService.createTextOutput("Error").setMimeType(ContentService.MimeType.TEXT);
}
