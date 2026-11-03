"use client";
import { useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { formatDay, type ActivityDay } from "@/lib/analytics";

export function ActivityChart({days}:{days:ActivityDay[]}) {
  const [series,setSeries]=useState({reports:true,residents:true});
  const plotRef=useRef<HTMLDivElement>(null);
  const tooltipRef=useRef<HTMLDivElement>(null);
  const [tooltipSize,setTooltipSize]=useState({width:180,height:84});
  const [selection,setSelection]=useState<{index:number;near:boolean;px:number;py:number;width:number;height:number}|null>(null);
  const tooltipVisible=!!selection?.near;
  useLayoutEffect(()=>{
    if(!tooltipVisible||!tooltipRef.current)return;
    const {width,height}=tooltipRef.current.getBoundingClientRect();
    setTooltipSize(current=>current.width===width&&current.height===height?current:{width,height});
  },[tooltipVisible]);
  const ceiling=Math.ceil(Math.max(4,...days.flatMap(day=>[...(series.reports?[day.reports]:[]),...(series.residents?[day.residents]:[])]))/4)*4;
  const x=(index:number)=>days.length===1?348:40+index/(days.length-1)*616;
  const y=(value:number)=>204-value/ceiling*176;
  const line=(key:"reports"|"residents")=>days.map((day,index)=>(index?"L":"M")+x(index)+","+y(day[key])).join(" ");
  const selected=selection?days[selection.index]:null;
  function movePointer(event:PointerEvent<HTMLDivElement>) {
    const bounds=event.currentTarget.getBoundingClientRect();
    const px=(event.clientX-bounds.left)/bounds.width*690;
    const py=(event.clientY-bounds.top)/bounds.height*240;
    if(px<40||px>656||py<24||py>207){setSelection(null);return;}
    const position=(px-40)/616*(days.length-1);
    const index=Math.round(position);
    const before=Math.floor(position),after=Math.min(days.length-1,before+1);
    const fraction=position-before;
    const tolerance=10*240/bounds.height;
    const near=event.pointerType==="touch"||(["reports","residents"] as const).some(key=>series[key]&&Math.abs(py-y(days[before][key]+(days[after][key]-days[before][key])*fraction))<=tolerance);
    setSelection({index,near,px:event.clientX-bounds.left,py:event.clientY-bounds.top,width:bounds.width,height:bounds.height});
  }
  function selectDay(index:number) {
    const bounds=plotRef.current?.getBoundingClientRect();
    if(!bounds)return;
    setSelection({index,near:true,px:x(index)/690*bounds.width,py:y(days[index][series.reports?"reports":"residents"])/240*bounds.height,width:bounds.width,height:bounds.height});
  }
  const tooltipPosition=(()=>{
    if(!selection)return {left:0,top:0};
    const gap=14;
    const {px,py,width,height}=selection;
    const fitsRight=px+gap+tooltipSize.width<=width-4;
    const left=Math.max(4,Math.min(fitsRight?px+gap:px-gap-tooltipSize.width,width-tooltipSize.width-4));
    let top=Math.max(4,Math.min(py-tooltipSize.height-gap,height-tooltipSize.height-4));
    if(left<px+6&&left+tooltipSize.width>px-6&&top<py+6&&top+tooltipSize.height>py-6)top=py+gap+tooltipSize.height<=height?py+gap:py-tooltipSize.height-gap;
    return {left,top};
  })();
  const hasActivity=days.some(day=>day.reports||day.residents);
  return <>
    <div className="analytics-chart-key" aria-label="Chart series">{(["reports","residents"] as const).map(key=><button key={key} type="button" aria-pressed={series[key]} onClick={()=>setSeries(current=>({...current,[key]:!current[key]||!current[key==="reports"?"residents":"reports"]}))}><i className={key==="reports"?"analytics-series-report":"analytics-series-registration"} style={{background:key==="reports"?"#7952DE":"#16A394"}}/>{key==="reports"?"Reports":"Registrations"}</button>)}</div>
    <div ref={plotRef} className="analytics-plot analytics-daily-plot" onPointerMove={movePointer} onPointerDown={event=>{if(event.pointerType!=="mouse")event.currentTarget.setPointerCapture(event.pointerId);movePointer(event);}} onPointerLeave={event=>{if(event.pointerType==="mouse")setSelection(null);}} onPointerCancel={()=>setSelection(null)} onKeyDown={event=>{if(event.key==="Escape")setSelection(null);}}>
      <svg viewBox="0 0 690 240" role="img" aria-label="Daily submissions. Use the daily data table for exact values.">
        <defs><linearGradient id="analytics-reports-line" gradientUnits="userSpaceOnUse" x1="40" y1="0" x2="656" y2="0"><stop offset="0%" stopColor="#6941CF"/><stop offset="100%" stopColor="#A17BF0"/></linearGradient><linearGradient id="analytics-residents-line" gradientUnits="userSpaceOnUse" x1="40" y1="0" x2="656" y2="0"><stop offset="0%" stopColor="#0D9488"/><stop offset="100%" stopColor="#45C4AF"/></linearGradient><linearGradient id="analytics-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7952DE" stopOpacity=".16"/><stop offset="100%" stopColor="#7952DE" stopOpacity="0"/></linearGradient></defs>
        {[0,1,2,3,4].map(tick=><g key={tick}><text x="22" y={y(ceiling*tick/4)+4} textAnchor="end">{ceiling*tick/4}</text><line x1="40" x2="656" y1={y(ceiling*tick/4)} y2={y(ceiling*tick/4)} stroke="#b9bec5" strokeWidth="1" strokeDasharray="4 4"/></g>)}
        {series.reports?<><path d={line("reports")+" L"+x(days.length-1)+",204 L"+x(0)+",204 Z"} fill="url(#analytics-area)"/><path d={line("reports")} fill="none" stroke="url(#analytics-reports-line)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></>:null}
        {series.residents?<path d={line("residents")} fill="none" stroke="url(#analytics-residents-line)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 4"/>:null}
        {days.length===1?(["reports","residents"] as const).map(key=>series[key]?<circle key={key} cx={x(0)} cy={y(days[0][key])} r="4" fill={key==="reports"?"#7952DE":"#16A394"}/>:null):null}
        {selection?<line className="analytics-daily-guide" x1={x(selection.index)} x2={x(selection.index)} y1="24" y2="204" stroke="#9299a3" strokeWidth="1" strokeDasharray="4 4"/>:null}
        {selection?.near?(["reports","residents"] as const).map(key=>series[key]?<circle key={key} cx={x(selection.index)} cy={y(days[selection.index][key])} r="5" fill={key==="reports"?"#7952DE":"#16A394"} stroke="white" strokeWidth="2"/>:null):null}
        {days.map((day,index)=>{const step=Math.max(1,Math.ceil((days.length-1)/6));return index%step===0||index===days.length-1?<text key={day.date} x={x(index)} y="230" textAnchor="middle">{days.length===7?new Date(day.date+"T00:00:00Z").toLocaleDateString("en-GB",{weekday:"short",timeZone:"UTC"}):formatDay(day.date,true)}</text>:null;})}
      </svg>
      {selection?.near&&selected?<div ref={tooltipRef} className="analytics-chart-tooltip analytics-pointer-tooltip" style={tooltipPosition} aria-hidden="true"><strong>{formatDay(selected.date)}</strong><span><i className="analytics-series-report"/>Reports<b>{selected.reports}</b></span><span><i className="analytics-series-registration"/>Registrations<b>{selected.residents}</b></span></div>:null}
      <div className="analytics-day-targets" style={{gridTemplateColumns:"repeat("+days.length+",minmax(0,1fr))"}}>{days.map((day,index)=><button key={day.date} type="button" aria-label={formatDay(day.date)+": "+day.reports+" reports, "+day.residents+" registrations"} aria-pressed={selection?.index===index} onFocus={()=>selectDay(index)} onClick={()=>selectDay(index)}/>)}</div>
    </div>
    <div className="analytics-chart-readout" role="status">{selected&&selection?.near?<><strong>{formatDay(selected.date,true)}</strong><span>{selected.reports} reports</span><span>{selected.residents} registrations</span></>:hasActivity?null:<span>No submissions recorded in this period.</span>}</div>
  </>;
}
