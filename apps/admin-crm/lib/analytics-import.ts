import {shiftDay,type ActivityDay} from "@/lib/analytics";
export function parseAnalyticsCsv(text:string):ActivityDay[]{
  if(text.length>2_000_000)throw new Error("Choose a CSV smaller than 2 MB.");
  const rows:string[][]=[];let row:string[]=[],field="",quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===","&&!quoted){row.push(field);field="";}else if((c==="\n"||c==="\r")&&!quoted){if(c==="\r"&&text[i+1]==="\n")i++;row.push(field);rows.push(row);row=[];field="";}else field+=c;}
  if(quoted)throw new Error("The CSV contains an unfinished quoted field.");row.push(field);rows.push(row);
  const header=rows.findIndex(r=>r.map(v=>v.replace(/^\uFEFF/,"").trim()).join(",")==="Date,Reports,Registrations");
  if(header<0)throw new Error("Use an Analytics export with Date, Reports and Registrations columns.");
  const result:ActivityDay[]=[];const seen=new Set<string>();
  for(const r of rows.slice(header+1)){if(r.every(v=>!v.trim())||r[0]==="Report status"||r[0]==="Category")break;const [date,reports,residents]=r.map(v=>v.trim());
    if(r.length!==3||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||![reports,residents].every(v=>/^\d+$/.test(v)&&Number.isSafeInteger(Number(v))&&Number(v)<=1_000_000))throw new Error("Each daily row needs a valid date and non-negative whole-number counts.");
    if(seen.has(date))throw new Error("Duplicate dates found. Use one row per day.");seen.add(date);result.push({date,reports:Number(reports),residents:Number(residents)});
  }
  if(!result.length)throw new Error("The file contains no daily activity.");result.sort((a,b)=>a.date.localeCompare(b.date));
  const count=(Date.parse(result[result.length-1].date)-Date.parse(result[0].date))/86400000+1;if(count>366)throw new Error("Import a range of up to 366 days.");
  const byDate=new Map(result.map(day=>[day.date,day]));return Array.from({length:count},(_,i)=>{const date=shiftDay(result[0].date,i);return byDate.get(date)??{date,reports:0,residents:0};});
}
