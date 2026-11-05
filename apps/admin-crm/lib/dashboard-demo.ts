import type { CommunityReport } from "./types";
import { reportCategoryOptions } from "./report-utils";

/** Local preview records; never submitted to a database. */
export function createDashboardDemo(now=new Date()) {
 const descriptions=["Uneven road surface near the community entrance.","Uncollected waste beside the public market.","Streetlight is not working along the main road.","Drainage blocked after heavy rain.","Loud music reported near the basketball court.","Public walkway needs maintenance."];
 const reports:CommunityReport[]=Array.from({length:64},(_,index)=>({
  id:"dashboard-demo-"+index,
  reporter_name:"Sample resident "+(index%12+1),
  category:reportCategoryOptions[index%6],
  description:descriptions[index%6],
  status:index%5<2?"resolved":index%5===2?"in progress":"pending",
  created_at:new Date(now.getTime()-(index+1)*14*3600000).toISOString(),
  latitude:index%7===0?undefined:9.739+index%6*.001,
  longitude:index%7===0?undefined:118.74+index%6*.001,
 }));
 return {reports,pendingCertificates:9,readyCertificates:4,published:12,drafts:3,legacyPending:2};
}
