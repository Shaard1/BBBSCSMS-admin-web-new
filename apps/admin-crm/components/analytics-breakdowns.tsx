import Link from "next/link";
import { ArrowUpRight, Construction, Trash2, Lightbulb, Waves, Volume2, Shapes, CalendarDays } from "@/components/crm-icons";
import type { CSSProperties, ComponentType } from "react";

const categoryStyles:Record<string,{icon:ComponentType<{size?:number;className?:string}>;color:string;tint:string}>={
  "Road Damage":{icon:Construction,color:"#876BE0",tint:"#B7A5F5"},
  "Garbage Collection":{icon:Trash2,color:"#21A79B",tint:"#8AD8C3"},
  "Broken Streetlight":{icon:Lightbulb,color:"#E9A458",tint:"#F7C890"},
  "Drainage Issue":{icon:Waves,color:"#588BCF",tint:"#A2C2F1"},
  "Noise Complaint":{icon:Volume2,color:"#E77C70",tint:"#F2B0A4"},
};
const fallback={icon:Shapes,color:"#8793AD",tint:"#C0C8DA"};

export function CategoryBreakdown({categories,total,periodLabel}:{categories:[string,number][];total:number;periodLabel:string}) {
  const max=Math.max(1,...categories.map(([,count])=>count));
  return <section className="analytics-card analytics-category-card" aria-labelledby="categories-title">
    <div className="analytics-card-heading"><h3 id="categories-title">Reports by category</h3><span className="analytics-period">{periodLabel}</span></div>
    {categories.length?<div className="analytics-category-ranking">{categories.map(([category,count])=>{
      const {icon:Icon,color,tint}=categoryStyles[category]??fallback;
      return <div className="analytics-category-row" key={category} style={{"--category-color":color,"--category-tint":tint} as CSSProperties}>
        <Icon size={17} className="analytics-category-icon"/>
        <span className="analytics-category-name">{category}</span>
        <div className="analytics-category-lane" aria-hidden="true"><span style={{width:count/max*100+"%"}}/></div>
        <strong>{count}</strong><small>{total?Math.round(count/total*100):0}%</small>
      </div>;
    })}</div>:<p className="analytics-empty">No reports in this period.</p>}
  </section>;
}

const ageStyles=[{label:"Under 7 days",color:"#2BAA9C",tint:"#85D8C2"},{label:"7–29 days",color:"#9874DD",tint:"#C6ACF1"},{label:"30+ days",color:"#E68570",tint:"#F4BA99"}];
export function WorkloadBreakdown({counts,busiestDate,busiestTotal}:{counts:number[];busiestDate:string;busiestTotal:number}) {
  const total=counts.reduce((sum,count)=>sum+count,0);
  return <section className="analytics-card analytics-workload-card" aria-labelledby="workload-title">
    <div className="analytics-card-heading"><h3 id="workload-title">Open report workload</h3><Link href="/admin/reports" className="analytics-text-link">View reports <ArrowUpRight size={15}/></Link></div>
    <div className="analytics-workload-headline"><strong>{total.toLocaleString()}</strong><span>open reports</span></div>
    <div className="analytics-age-composition" role="img" aria-label={counts.map((count,index)=>ageStyles[index].label+": "+count).join(". ")}>{counts.map((count,index)=>count>0?<span key={index} style={{flexGrow:count,background:"linear-gradient(90deg,"+ageStyles[index].color+","+ageStyles[index].tint+")"}}/>:null)}</div>
    <div className="analytics-age-columns">{counts.map((count,index)=><div key={index} style={{"--age-color":ageStyles[index].color} as CSSProperties}><span>{ageStyles[index].label}</span><div><strong>{count}</strong><small>{total?Math.round(count/total*100):0}%</small></div></div>)}</div>
    <div className="analytics-busiest-day"><CalendarDays size={17}/><span>Busiest day</span>{busiestTotal?<strong>{busiestDate}<small>{busiestTotal} submissions</small></strong>:<strong>No activity</strong>}</div>
  </section>;
}
