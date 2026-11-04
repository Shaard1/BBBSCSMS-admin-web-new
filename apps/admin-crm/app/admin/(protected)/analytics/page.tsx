"use client";
import Link from "next/link";
import {CloudImportIcon,CloudExportIcon} from "@/components/cloud-transfer-icons";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminPageSkeleton } from "@/components/admin-page-skeleton";
import { Notice, RefreshButton } from "@/components/workspace-ui";
import { UiDropdown } from "@/components/ui-dropdown";
import { Hourglass, Wrench, CheckCheck, ArrowUpRight, CheckCircle2, Clock3, FileText, Users } from "@/components/crm-icons";
import { reportSnapshot } from "@/lib/workspace-metrics";
import { createDemoAnalytics } from "@/lib/analytics-demo";
import { CategoryBreakdown, WorkloadBreakdown } from "@/components/analytics-breakdowns";
import {parseAnalyticsCsv} from "@/lib/analytics-import";
import type {ActivityDay} from "@/lib/analytics";
import { DateRangeCalendar } from "@/components/date-range-calendar";
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
    const [imported,setImported]=useState<{name:string;days:ActivityDay[]}|null>(null);
    const [importError,setImportError]=useState("");
    const importInput=useRef<HTMLInputElement>(null);
    async function importFile(file:File){try{if(file.size>2_000_000)throw new Error("Choose a CSV smaller than 2 MB.");const days=parseAnalyticsCsv(await file.text());setImported({name:file.name,days});setDemo(false);setImportError("");}catch(error){setImportError(error instanceof Error?error.message:"Unable to read CSV.");}}

    const [range,setRange]=useState({start:shiftDay(today,-29),end:today});
    const [custom,setCustom]=useState(range);
    const [rangeError,setRangeError]=useState("");
    const [rangeOpen,setRangeOpen]=useState(false);
    const rangeAnchor=useRef<HTMLDivElement>(null);
    const rangePanel=useRef<HTMLDivElement>(null);
    function closeRange(){setRangeOpen(false);rangeAnchor.current?.querySelector<HTMLButtonElement>("button")?.focus();}
    useEffect(()=>{
      if(!rangeOpen)return;
      function position(){const anchor=rangeAnchor.current?.getBoundingClientRect();const panel=rangePanel.current;if(!anchor||!panel)return;panel.style.left=Math.max(16,Math.min(anchor.right-panel.offsetWidth,window.innerWidth-panel.offsetWidth-16))+"px";panel.style.top=Math.max(16,Math.min(anchor.bottom+8,window.innerHeight-panel.offsetHeight-16))+"px";}
      function outside(event:PointerEvent){if(!rangeAnchor.current?.contains(event.target as Node)&&!rangePanel.current?.contains(event.target as Node))setRangeOpen(false);}
      position();rangePanel.current?.querySelector<HTMLButtonElement>(".crm-calendar-days button:not(:disabled)")?.focus();
      window.addEventListener("resize",position);window.addEventListener("scroll",position,true);document.addEventListener("pointerdown",outside);
      return()=>{window.removeEventListener("resize",position);window.removeEventListener("scroll",position,true);document.removeEventListener("pointerdown",outside);};
    },[rangeOpen]);
    function changePeriod(value:string) {
      setPeriod(value);setRangeError("");
      if(value!=="custom")setRange({start:shiftDay(today,1-Number(value)),end:today});
      else {setCustom(range);setRangeOpen(true);}
      if(value!=="custom")setRangeOpen(false);
    }
    function applyRange() {
      const count=(Date.parse(custom.end)-Date.parse(custom.start))/86400000+1;
      if(!custom.start||!custom.end||!Number.isFinite(count)||count<1||count>366||custom.end>today){setRangeError("Choose a valid range of up to 366 days, ending today or earlier.");return;}
      setRange(custom);setRangeError("");closeRange();
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
    function resetAnalytics(){
      const end=dayKey(new Date());const initial={start:shiftDay(end,-29),end};
      setDemo(false);setImported(null);setPeriod("30");setRange(initial);setCustom(initial);
      setRangeOpen(false);setRangeError("");setImportError("");void load();
    }
    const sample=useMemo(()=>demo?createDemoAnalytics(range.start,range.end,today):null,[demo,range,today]);
    const visibleReports=sample?.reports??reports;
    const visibleRegistrations=sample?.registrations??registrations;
    const selectedReports=useMemo(()=>visibleReports.filter(report=>{if(!Number.isFinite(Date.parse(report.created_at)))return false;const date=dayKey(report.created_at);return date>=range.start&&date<=range.end;}),[visibleReports,range]);
    const snapshot=useMemo(()=>reportSnapshot(selectedReports),[selectedReports]);
    const days=useMemo(()=>imported?.days??dailyActivity(visibleReports,visibleRegistrations,range.start,range.end),[imported,visibleReports,visibleRegistrations,range]);
    const reportTotal=days.reduce((sum,day)=>sum+day.reports,0);
    const residentTotal=days.reduce((sum,day)=>sum+day.residents,0);
    const periodLabel=formatDay(days[0].date,true)+" – "+formatDay(days[days.length-1].date,true);
    const statusCounts = [snapshot.pending, snapshot.progress, snapshot.resolved];
    const openAges = selectedReports.filter(report => normalizeReportStatus(report.status) !== "resolved").map(report => Math.max(0, (Date.now() - new Date(report.created_at).getTime()) / 86400000));
    const ageGroups = [openAges.filter(age => age < 7).length, openAges.filter(age => age >= 7 && age < 30).length, openAges.filter(age => age >= 30).length];
    const busiest = days.reduce((best, day) => day.reports + day.residents > best.reports + best.residents ? day : best, days[0]);
    function exportData() {
        const rows = [...(demo?[["DEMO DATA — SAMPLE ACTIVITY, NOT LIVE RECORDS"],[]]:[]),["Date", "Reports", "Registrations"], ...days.map(day => [day.date, day.reports, day.residents]), [], ["Report status", "Count"], ["Pending", snapshot.pending], ["In progress", snapshot.progress], ["Resolved", snapshot.resolved], [], ["Category", "Count"], ...snapshot.categories];
        if(imported)rows.splice(0,rows.length,["IMPORTED REPORT — VIEW ONLY"],["Date","Reports","Registrations"],...days.map(day=>[day.date,day.reports,day.residents]));
        const csv = rows.map(row => row.map(value => '"' + String(value).replaceAll('"', '""') + '"').join(",")).join("\r\n");
        const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" }));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = (imported?"IMPORTED-":demo?"DEMO-":"")+"community-analytics-" + days[0].date + "-to-" + days[days.length-1].date + ".csv";
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    if (isLoading)
        return <AdminPageSkeleton href="/admin/analytics"/>;
    return <section className="workspace-page analytics-page" aria-label="Community analytics">
    <div className="analytics-toolbar">
      <div className="analytics-actions">
        <div ref={rangeAnchor} className="analytics-period-control"><UiDropdown disabled={!!imported} ariaLabel="Analytics period" matchTriggerWidth options={[{label:"Last 7 days",value:"7"},{label:"Last 30 days",value:"30"},{label:"Custom range",value:"custom"}]} value={period} onChange={changePeriod}/></div>
        <div className="analytics-demo-control"><button type="button" role="switch" aria-label="Demo data" disabled={!!imported} aria-checked={demo} onClick={()=>setDemo(value=>!value)}><span className="analytics-switch-track" aria-hidden="true"><i/></span>Demo data</button></div>
        <input ref={importInput} type="file" accept=".csv,text/csv" hidden aria-label="Import Analytics CSV" onChange={event=>{const file=event.target.files?.[0];if(file)void importFile(file);event.target.value="";}}/>
        <div className="analytics-action-group" role="group" aria-label="Analytics actions">
        <button type="button" className="secondary-admin-button" onClick={()=>importInput.current?.click()}><CloudImportIcon size={18}/> Import CSV</button>
        <button className="primary-admin-button" type="button" disabled={!!message&&!demo&&!imported} onClick={exportData}><CloudExportIcon size={18}/> Export CSV</button>
        <RefreshButton loading={isLoading} onClick={resetAnalytics}/>
        </div>
      </div>
    </div>
    {importError?<Notice message={importError} onDismiss={()=>setImportError("")}/>:null}
    {imported?<div className="analytics-import-notice"><span><strong>Imported report</strong> · {imported.name} · daily figures only</span><button type="button" className="secondary-admin-button" onClick={()=>setImported(null)}>Back to live data</button></div>:null}
    {rangeOpen ? <div ref={rangePanel} className="analytics-range-controls analytics-range-popover" role="region" aria-label="Custom date range" onKeyDown={event=>{if(event.key==="Escape"){event.stopPropagation();closeRange();}}}>
      <strong>Custom date range</strong>
      <DateRangeCalendar value={custom} today={today} onChange={setCustom}/>
      {rangeError?<p role="alert">{rangeError}</p>:null}
      <div className="analytics-range-actions"><button type="button" className="secondary-admin-button" onClick={closeRange}>Cancel</button><button type="button" className="primary-admin-button" onClick={applyRange}>Apply range</button></div>
    </div>:null}
    {message&&!demo&&!imported ? <Notice message={message}/> : <>
      <div className="analytics-metrics">
        <article className="analytics-stat"><div><span>Community reports</span><FileText size={18}/></div><strong>{reportTotal.toLocaleString()}</strong>{!imported?<p>{snapshot.open} open · {snapshot.resolved} resolved</p>:null}</article>
        {!imported?<article className="analytics-stat"><div><span>Resolution rate</span><CheckCircle2 size={18}/></div><strong>{snapshot.resolutionRate}<small>%</small></strong></article>:null}
        <article className="analytics-stat"><div><span>New registrations</span><Users size={18}/></div><strong>{residentTotal.toLocaleString()}</strong></article>
        {!imported?<article className="analytics-stat"><div><span title="Time since submission, not a service target">Open over 7 days</span><Clock3 size={18}/></div><strong>{snapshot.overdue.toLocaleString()}</strong></article>:null}
      </div>
      <div className={"analytics-main-grid"+(imported?" analytics-import-grid":"")}>
        <section className="analytics-card analytics-trend" aria-labelledby="activity-title">
          <div className="analytics-card-heading"><div><h3 id="activity-title">Submission activity</h3><p>{periodLabel}</p></div><span className="analytics-total">{reportTotal+residentTotal}<small>total submissions</small></span></div>
          <ActivityChart key={String(demo)+(imported?.name??"live")+days[0].date+days[days.length-1].date} days={days}/>
          <details className="analytics-data"><summary>View daily data table</summary><div className="table-scroll" tabIndex={0} role="region" aria-label="Daily activity data"><table><caption>Daily activity, {periodLabel}</caption><thead><tr><th scope="col">Date</th><th scope="col">Reports</th><th scope="col">Registrations</th></tr></thead><tbody>{days.map(day=><tr key={day.date}><th scope="row">{formatDay(day.date,true)}</th><td>{day.reports}</td><td>{day.residents}</td></tr>)}</tbody></table></div></details>
        </section>
        {!imported?<ReportStatus counts={statusCounts} periodLabel={periodLabel}/>:null}

      </div>
      {!imported?<div className="analytics-bottom-grid">
        <CategoryBreakdown categories={snapshot.categories} total={selectedReports.length} periodLabel={periodLabel}/>
        <WorkloadBreakdown counts={ageGroups} busiestDate={formatDay(busiest.date,true)} busiestTotal={selectedReports.length+residentTotal?busiest.reports+busiest.residents:0}/>
      </div>
      :null}
      <p className="analytics-footnote" title="Figures use submission dates in Philippine time; report statuses reflect their current state.">{imported?"Imported file · view only":demo?"Sample data · not saved to the database":updatedAt?"Updated "+updatedAt.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):""}</p>
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
    <div className="analytics-status-body">
    <div className="analytics-status-visual">
      <div className="analytics-ring" role="img" aria-label={labels.map((label,index)=>label+": "+counts[index]).join(". ")}>
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <defs>{statusColors.map((color,index)=><linearGradient key={index} id={"status-gradient-"+index} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={color}/><stop offset="65%" stopColor={color}/><stop offset="100%" stopColor={statusTints[index]}/></linearGradient>)}</defs>
          <circle cx="100" cy="100" r="76" fill="none" stroke="#f0f3f8" strokeWidth="22"/>
          {counts.map((count,index)=>{
            if(!count)return null;
            const offset=counts.slice(0,index).reduce((sum,value)=>sum+value,0)/Math.max(1,total)*circumference;
            const gap=nonEmpty>1?31:0;
            return <circle key={index} cx="100" cy="100" r="76" fill="none" stroke={"url(#status-gradient-"+index+")"} strokeWidth={active===index?25:22} strokeLinecap="round" strokeDasharray={Math.max(1,count/total*circumference-gap)+" "+circumference} strokeDashoffset={-offset-gap/2} transform="rotate(-90 100 100)" opacity={active===null||active===index?1:.7} onMouseEnter={()=>setActive(index)} onMouseLeave={()=>setActive(null)}/>;
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
    </div>
    <div className="analytics-status-footer"><span><strong>{counts[0]+counts[1]}</strong> open reports</span><Link href="/admin/reports" aria-label="Review community reports">View reports <ArrowUpRight size={15}/></Link></div>
  </section>;
}
