"use client";
import Link from "next/link";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminPageSkeleton } from "@/components/admin-page-skeleton";
import { Notice, RefreshButton } from "@/components/workspace-ui";
import { UiDropdown } from "@/components/ui-dropdown";
import { Hourglass, Wrench, CheckCheck, ArrowUpRight, CheckCircle2, Clock3, Download, FileText, Users } from "@/components/crm-icons";
import { reportSnapshot } from "@/lib/workspace-metrics";
import { createDemoAnalytics } from "@/lib/analytics-demo";
import { CategoryBreakdown, WorkloadBreakdown } from "@/components/analytics-breakdowns";
import { ActivityChart } from "@/components/daily-activity-chart";
import { dailyActivity, dayKey, shiftDay, formatDay, fetchAnalyticsInputs } from "@/lib/analytics";
import { normalizeReportStatus } from "@/lib/report-utils";
import type { CommunityReport } from "@/lib/types";
const statusColors = ["#F97345", "#7047EB", "#079D8F"];
const statusTints = ["#FDBA74", "#AC8AFF", "#53D8BE"];
export default function AnalyticsPage() {
    const [reports, setReports] = useState<CommunityReport[]>([]);
    const [registrations,setRegistrations]=useState<{created_at:string}[]>([]);
    const today=dayKey(new Date());
    const [period,setPeriod]=useState("30");
    const [demo,setDemo]=useState(false);
    const [range,setRange]=useState({start:shiftDay(today,-29),end:today});
    const [custom,setCustom]=useState(range);
    const [rangeError,setRangeError]=useState("");
    function changePeriod(value:string) {
      setPeriod(value);setRangeError("");
      if(value!=="custom")setRange({start:shiftDay(today,1-Number(value)),end:today});
      else setCustom(range);
    }
    function applyRange() {
      const count=(Date.parse(custom.end)-Date.parse(custom.start))/86400000+1;
      if(!custom.start||!custom.end||!Number.isFinite(count)||count<1||count>366||custom.end>today){setRangeError("Choose a valid range of up to 366 days, ending today or earlier.");return;}
      setRange(custom);setRangeError("");
    }
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState("");
    const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
    const requestRef = useRef(0);
    const load = useCallback(async () => {
        const requestId = ++requestRef.current;
        setIsLoading(true);
        setMessage("");
        try {
            const {reports:nextReports,registrations:nextRegistrations} = await fetchAnalyticsInputs();
            if (requestId !== requestRef.current)
                return;
            setReports(nextReports);
            setRegistrations(nextRegistrations);
            setUpdatedAt(new Date());
        }
        catch (error) {
            if (requestId === requestRef.current)
                setMessage(error instanceof Error ? error.message : "Unable to load analytics. Please try again.");
        }
        finally {
            if (requestId === requestRef.current)
                setIsLoading(false);
        }
    }, []);
    useEffect(() => { void load(); }, [load]);
    const sample=useMemo(()=>demo?createDemoAnalytics(range.start,range.end,today):null,[demo,range,today]);
    const visibleReports=sample?.reports??reports;
    const visibleRegistrations=sample?.registrations??registrations;
    const selectedReports=useMemo(()=>visibleReports.filter(report=>{if(!Number.isFinite(Date.parse(report.created_at)))return false;const date=dayKey(report.created_at);return date>=range.start&&date<=range.end;}),[visibleReports,range]);
    const snapshot=useMemo(()=>reportSnapshot(selectedReports),[selectedReports]);
    const days=useMemo(()=>dailyActivity(visibleReports,visibleRegistrations,range.start,range.end),[visibleReports,visibleRegistrations,range]);
    const residentTotal=days.reduce((sum,day)=>sum+day.residents,0);
    const periodLabel=formatDay(range.start,true)+" – "+formatDay(range.end,true);
    const statusCounts = [snapshot.pending, snapshot.progress, snapshot.resolved];
    const openAges = selectedReports.filter(report => normalizeReportStatus(report.status) !== "resolved").map(report => Math.max(0, (Date.now() - new Date(report.created_at).getTime()) / 86400000));
    const ageGroups = [openAges.filter(age => age < 7).length, openAges.filter(age => age >= 7 && age < 30).length, openAges.filter(age => age >= 30).length];
    const busiest = days.reduce((best, day) => day.reports + day.residents > best.reports + best.residents ? day : best, days[0]);
    function exportData() {
        const rows = [...(demo?[["DEMO DATA — SAMPLE ACTIVITY, NOT LIVE RECORDS"],[]]:[]),["Date", "Reports", "Registrations"], ...days.map(day => [day.date, day.reports, day.residents]), [], ["Report status", "Count"], ["Pending", snapshot.pending], ["In progress", snapshot.progress], ["Resolved", snapshot.resolved], [], ["Category", "Count"], ...snapshot.categories];
        const csv = rows.map(row => row.map(value => '"' + String(value).replaceAll('"', '""') + '"').join(",")).join("\r\n");
        const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" }));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = (demo?"DEMO-":"")+"community-analytics-" + range.start + "-to-" + range.end + ".csv";
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    if (isLoading)
        return <AdminPageSkeleton href="/admin/analytics"/>;
    return <section className="workspace-page analytics-page" aria-label="Community analytics">
    <div className="analytics-toolbar">
      <div className="analytics-actions">
        <div className="analytics-demo-control"><button type="button" role="switch" aria-label="Demo data" aria-checked={demo} onClick={()=>setDemo(value=>!value)}><span className="analytics-switch-track" aria-hidden="true"><i/></span>Demo data</button></div>
        <UiDropdown ariaLabel="Analytics period" matchTriggerWidth options={[{label:"Last 7 days",value:"7"},{label:"Last 30 days",value:"30"},{label:"Custom range",value:"custom"}]} value={period} onChange={changePeriod}/>
        {demo?<button className="secondary-admin-button" type="button" disabled title="Sample activity is generated locally">Refresh</button>:<RefreshButton loading={isLoading} onClick={load}/>}
        <button className="primary-admin-button" type="button" disabled={!!message&&!demo} onClick={exportData}><Download size={16}/> Export CSV</button>
      </div>
    </div>
    {period==="custom" ? <div className="analytics-range-controls"><label>Start date<input type="date" value={custom.start} max={today} onChange={event=>setCustom({...custom,start:event.target.value})}/></label><label>End date<input type="date" value={custom.end} max={today} onChange={event=>setCustom({...custom,end:event.target.value})}/></label><button type="button" className="secondary-admin-button" onClick={applyRange}>Apply range</button>{rangeError?<p role="alert">{rangeError}</p>:null}</div>:null}
    {message&&!demo ? <Notice message={message}/> : <>
      <div className="analytics-metrics">
        <article className="analytics-stat"><div><span>Community reports</span><FileText size={18}/></div><strong>{selectedReports.length.toLocaleString()}</strong><p>{snapshot.open} open · {snapshot.resolved} resolved</p></article>
        <article className="analytics-stat"><div><span>Resolution rate</span><CheckCircle2 size={18}/></div><strong>{snapshot.resolutionRate}<small>%</small></strong></article>
        <article className="analytics-stat"><div><span>New registrations</span><Users size={18}/></div><strong>{residentTotal.toLocaleString()}</strong></article>
        <article className="analytics-stat"><div><span title="Time since submission, not a service target">Open over 7 days</span><Clock3 size={18}/></div><strong>{snapshot.overdue.toLocaleString()}</strong></article>
      </div>
      <div className="analytics-main-grid">
        <section className="analytics-card analytics-trend" aria-labelledby="activity-title">
          <div className="analytics-card-heading"><div><h3 id="activity-title">Submission activity</h3><p>{periodLabel}</p></div><span className="analytics-total">{selectedReports.length+residentTotal}<small>total submissions</small></span></div>
          <ActivityChart key={String(demo)+range.start+range.end} days={days}/>
          <details className="analytics-data"><summary>View daily data table</summary><div className="table-scroll" tabIndex={0} role="region" aria-label="Daily activity data"><table><caption>Daily activity, {periodLabel}</caption><thead><tr><th scope="col">Date</th><th scope="col">Reports</th><th scope="col">Registrations</th></tr></thead><tbody>{days.map(day=><tr key={day.date}><th scope="row">{formatDay(day.date,true)}</th><td>{day.reports}</td><td>{day.residents}</td></tr>)}</tbody></table></div></details>
        </section>
        <ReportStatus counts={statusCounts} periodLabel={periodLabel}/>

      </div>
      <div className="analytics-bottom-grid">
        <CategoryBreakdown categories={snapshot.categories} total={selectedReports.length} periodLabel={periodLabel}/>
        <WorkloadBreakdown counts={ageGroups} busiestDate={formatDay(busiest.date,true)} busiestTotal={selectedReports.length+residentTotal?busiest.reports+busiest.residents:0}/>
      </div>
      <p className="analytics-footnote" title="Figures use submission dates in Philippine time; report statuses reflect their current state.">{demo?"Sample data · not saved to the database":updatedAt?"Updated "+updatedAt.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):""}</p>
    </>}
  </section>;
}
function ReportStatus({counts,periodLabel}:{counts:number[];periodLabel:string}) {
  const [active,setActive]=useState<number|null>(null);
  const total=counts.reduce((sum,count)=>sum+count,0);
  const labels=["Pending","In progress","Resolved"];
  const resolvedRate=total?Math.round(counts[2]/total*100):0;
  const circumference=2*Math.PI*76;
  const nonEmpty=counts.filter(Boolean).length;
  return <section className="analytics-card analytics-status" aria-labelledby="status-title">
    <div className="analytics-card-heading"><div><h3 id="status-title">Report status</h3><p>{periodLabel}</p></div><span className="analytics-status-total">{total} reports</span></div>
    <div className="analytics-status-visual">
      <div className="analytics-ring" role="img" aria-label={labels.map((label,index)=>label+": "+counts[index]).join(". ")}>
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <defs>{statusColors.map((color,index)=><linearGradient key={index} id={"status-gradient-"+index} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={color}/><stop offset="65%" stopColor={color}/><stop offset="100%" stopColor={statusTints[index]}/></linearGradient>)}</defs>
          <circle cx="100" cy="100" r="76" fill="none" stroke="#f0f3f8" strokeWidth="14"/>
          {counts.map((count,index)=>{
            if(!count)return null;
            const offset=counts.slice(0,index).reduce((sum,value)=>sum+value,0)/Math.max(1,total)*circumference;
            const gap=nonEmpty>1?23:0;
            return <circle key={index} cx="100" cy="100" r="76" fill="none" stroke={"url(#status-gradient-"+index+")"} strokeWidth={active===index?17:14} strokeLinecap="round" strokeDasharray={Math.max(1,count/total*circumference-gap)+" "+circumference} strokeDashoffset={-offset-gap/2} transform="rotate(-90 100 100)" opacity={active===null||active===index?1:.7} onMouseEnter={()=>setActive(index)} onMouseLeave={()=>setActive(null)}/>;
          })}
        </svg>
        <div><span className="analytics-ring-eyebrow">{active===null?"Resolution rate":labels[active]}</span><strong>{active===null?resolvedRate+"%":counts[active]}</strong><span>{active===null?"of reports resolved":"of "+total+" reports"}</span></div>
      </div>
    </div>
    <div className="analytics-status-cells" aria-label="Inspect report status">{counts.map((count,index)=>{
      const StatusIcon=[Hourglass,Wrench,CheckCheck][index];
      return <button key={index} className="analytics-status-row" type="button" aria-label={"Inspect "+labels[index]+" reports"} aria-pressed={active===index} onMouseEnter={()=>setActive(index)} onMouseLeave={()=>setActive(null)} onFocus={()=>setActive(index)} onBlur={()=>setActive(null)} onClick={()=>setActive(index)} style={{"--status-color":statusColors[index],"--status-tint":statusTints[index]} as CSSProperties}>
        <span className="analytics-status-row-label"><StatusIcon size={16}/>{labels[index]}</span>
        <span className="analytics-status-row-track" aria-hidden="true"><i style={{width:(total?count/total*100:0)+"%"}}/></span>
        <strong>{count}</strong><small>{total?Math.round(count/total*100):0}%</small>
      </button>;
    })}</div>
    <div className="analytics-status-footer"><span><strong>{counts[0]+counts[1]}</strong> open reports</span><Link href="/admin/reports" aria-label="Review community reports">View reports <ArrowUpRight size={15}/></Link></div>
  </section>;
}
