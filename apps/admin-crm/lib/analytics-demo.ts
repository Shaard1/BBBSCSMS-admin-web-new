import { shiftDay } from "@/lib/analytics";
import type { CommunityReport } from "@/lib/types";

/** Local, deterministic sample activity. Never written to the database. */
export function createDemoAnalytics(start:string,end:string,today:string) {
  const reports:CommunityReport[]=[];
  const registrations:{created_at:string}[]=[];
  const categories=["Road Damage","Garbage Collection","Broken Streetlight","Drainage Issue","Noise Complaint","Others"];
  const dayCount=Math.round((Date.parse(end)-Date.parse(start))/86400000)+1;
  for(let index=0;index<dayCount;index++) {
    const date=shiftDay(start,index);
    const seed=Math.floor(Date.parse(date)/86400000);
    const wave=(Math.sin(seed*.62)+1)/2;
    const weekend=[0,6].includes(new Date(date+"T00:00:00Z").getUTCDay());
    const reportCount=Math.max(2,Math.round(8+wave*16+(seed%5)*2-(weekend?5:0)));
    const registrationCount=Math.max(1,Math.round(5+(Math.sin(seed*.41+2)+1)*5+(seed%3)*2-(weekend?3:0)));
    const age=(Date.parse(today)-Date.parse(date))/86400000;
    for(let item=0;item<reportCount;item++) {
      const score=(seed*7+item*13)%100;
      const resolvedThreshold=age>14?72:age>6?51:age>2?30:10;
      const status=score<resolvedThreshold?"Resolved":score<resolvedThreshold+21?"In Progress":"Pending";
      reports.push({id:"demo-"+date+"-"+item,created_at:date+"T"+String(8+item%10).padStart(2,"0")+":00:00+08:00",status,category:categories[(seed+item*item)%categories.length]});
    }
    for(let item=0;item<registrationCount;item++)registrations.push({created_at:date+"T10:00:00+08:00"});
  }
  return {reports,registrations};
}
