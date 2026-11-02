import { supabase } from "@/lib/supabase";
import type { CommunityReport } from "@/lib/types";

export type ActivityDay = { date: string; reports: number; residents: number };
const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" });
export const dayKey = (value: string | Date) => dayFormatter.format(new Date(value));
export const shiftDay = (date: string, days: number) => new Date(Date.parse(date + "T00:00:00Z") + days * 86400000).toISOString().slice(0, 10);
export const formatDay = (date: string, short = false) => new Date(date + "T00:00:00Z").toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: short ? "short" : "long", ...(short ? {} : { year: "numeric" }) });

export function dailyActivity(reports: {created_at:string}[], registrations: {created_at:string}[], start: string, end: string): ActivityDay[] {
  const count = Math.round((Date.parse(end)-Date.parse(start))/86400000)+1;
  if (!Number.isFinite(count) || count<1 || count>366) return [];
  const days = Array.from({length:count},(_,index)=>({date:shiftDay(start,index),reports:0,residents:0}));
  const byDate = new Map(days.map(day=>[day.date,day]));
  for (const [key,rows] of [["reports",reports],["residents",registrations]] as const) {
    for(const row of rows) {
      if(!Number.isFinite(Date.parse(row.created_at)))continue;
      const day=byDate.get(dayKey(row.created_at));
      if(day)day[key]++;
    }
  }
  return days;
}

// Paginate aggregate inputs, without names, contact details or uploaded files.
export async function fetchAnalyticsInputs() {
  async function read<T>(table:"reports"|"residents",columns:string) {
    const rows:T[]=[];
    for(let offset=0;;offset+=500){
      const {data,error}=await supabase.from(table).select(columns).order("created_at").order("id").range(offset,offset+499);
      if(error)throw error;
      const batch=(data??[]) as unknown as T[]; rows.push(...batch);
      if(batch.length<500)return rows;
    }
  }
  const [reports,registrations]=await Promise.all([
    read<CommunityReport>("reports","id,category,status,created_at"),
    read<{created_at:string}>("residents","created_at")
  ]);
  return {reports,registrations};
}
