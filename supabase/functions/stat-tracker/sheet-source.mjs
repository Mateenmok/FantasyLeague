// Fixed, public, read-only source. Never accept a URL, spreadsheet ID or range
// from the caller: this endpoint is not a general-purpose Google proxy.
export const SPREADSHEET_ID = "1nq9_Ff8-C6oSki0pC3PsNhWKRdNZMtXh1hKI4o4nrhA";
export const SHEETS = [
  ["all", "All Pokemon", "966043028"],
  ["miami-dragapults", "Miami Dragapults", "940361633"],
  ["boston-eeltics", "Boston Eeltics", "657932025"],
  ["massachusetts-midnight", "Massachusetts Midnight", "202297035"],
  ["sunnyshore-city-shelter", "Sunnyshore City Shelter", "188807168"],
  ["north-carolina-ceruledge", "North Carolina Ceruledge", "1860004613"],
  ["stockholm-spin-cycles", "Stockholm Spin Cycles", "232390717"],
  ["san-francisco-soulfire", "San Francisco Soulfire", "1172995716"],
  ["uconn-arcanines", "UConn Arcanines", "1178632803"],
  ["chicago-conkquerers", "Chicago Conkquerers", "513760838"],
  ["kansas-krooks", "Kansas Krooks", "439064261"],
  ["daytona-torterras", "Daytona Torterras", "1360751905"],
  ["las-vegas-gatrs", "Las Vegas Gatrs", "1807878412"],
  ["south-jersey-hounds", "South Jersey Hounds", "1072534718"],
  ["dallas-disguises", "Dallas Disguises", "1932045932"],
  ["guide", "Stat Guide", "1083434706"],
].map(([id, name, gid]) => ({ id, name, gid }));

export function sourceUrl(sheet) {
  const params = new URLSearchParams({ gid: sheet.gid, headers: "1", tqx: "out:json",
    range: sheet.id === "guide" ? "A2:E100" : sheet.id === "all" ? "A2:P1000" : "A2:R1000" });
  return `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?${params}`;
}

export function parseSheet(text, sheet) {
  // Decode Google's JSON envelope as data; never execute their JSONP response.
  const match = text.match(/^\s*\/\*O_o\*\/\s*google\.visualization\.Query\.setResponse\(([\s\S]*)\);?\s*$/);
  if (!match) throw new Error("Tracker response was not a data table.");
  const payload = JSON.parse(match[1]);
  if (payload.status !== "ok" || !Array.isArray(payload.table?.cols) || !Array.isArray(payload.table?.rows)) {
    throw new Error("Tracker data is temporarily unavailable.");
  }
  const columns = payload.table.cols.map(col => String(col.label || col.id));
  const required = sheet.id === "guide" ? ["Stat", "Full Name"] : ["Pokemon", "Status", "IMP", "GP"];
  if (!required.every(key => columns.includes(key)) || (sheet.id === "all" && !columns.includes("Team"))) {
    throw new Error("The tracker columns have changed.");
  }
  // Team tabs also contain decorative "END OF TEAM STATS" footer rows. Only
  // named roster entries have a Status; do not render a footer as a Pokémon.
  const rows = payload.table.rows.filter(row => row.c?.[0]?.v != null && String(row.c[0].v).trim()
    && (sheet.id === "guide" || row.c[columns.indexOf("Status")]?.v))
    .map(row => columns.map((_, i) => {
      const cell = row.c[i];
      return { value: cell?.v ?? null, display: String(cell?.f ?? cell?.v ?? "") };
    }));
  return { sheet: sheet.id, title: sheet.name, columns, rows, fetchedAt: new Date().toISOString(),
    sheets: SHEETS.map(({ id, name }) => ({ id, name })) };
}
