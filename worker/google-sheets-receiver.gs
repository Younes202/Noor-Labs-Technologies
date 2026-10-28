// NOOR Leads — Google Apps Script that receives rows from the Cloudflare Worker
// and appends them to this spreadsheet ("Quotes" and "Chatbot Leads" tabs).
//
// Setup (once):
//   1. Extensions → Apps Script, paste this file, Save.
//   2. Project Settings → Script properties → add SECRET = the value shared with the Worker (SHEETS_SECRET).
//   3. Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone → Deploy.
//      Give the Web app URL to the Worker as SHEETS_WEBHOOK_URL.
// Only requests carrying the SECRET are written; nobody can read the sheet without your Google login.

const SHEETS = {
  quote: {
    name: 'Quotes',
    headers: ['Date', 'Quote No.', 'Action', 'Name', 'Company', 'Email', 'Phone', 'Package', 'Maintenance (years)',
              'Currency', 'Price', 'Maintenance / month', 'Total', 'Language', 'Page'],
  },
  chat: {
    name: 'Chatbot Leads',
    headers: ['Date', 'Name', 'Email', 'Phone', 'Company', 'Interest (AI summary)', 'Questions asked', 'Language', 'Page'],
  },
};

function doPost(e) {
  const secret = PropertiesService.getScriptProperties().getProperty('SECRET');
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply({ ok: false, error: 'bad_json' });
  }
  if (!secret || data.secret !== secret) return reply({ ok: false, error: 'forbidden' });

  const cfg = SHEETS[data.type];
  if (!cfg || !Array.isArray(data.row)) return reply({ ok: false, error: 'bad_request' });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const book = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = book.getSheetByName(cfg.name);
    if (!sheet) {
      sheet = book.insertSheet(cfg.name);
      sheet.appendRow(cfg.headers);
      sheet.getRange(1, 1, 1, cfg.headers.length).setFontWeight('bold').setBackground('#ede4fb');
      sheet.setFrozenRows(1);
    }
    const row = data.row.slice(0, cfg.headers.length - 1).map(clean);
    sheet.appendRow([new Date()].concat(row));
  } finally {
    lock.releaseLock();
  }
  return reply({ ok: true });
}

// Visitor text is stored as plain text: values starting with = + - @ would otherwise run as formulas
function clean(value) {
  const text = String(value == null ? '' : value).slice(0, 5000);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
