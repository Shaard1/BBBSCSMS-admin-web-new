import type {SVGProps} from "react";
type IconProps=SVGProps<SVGSVGElement>&{size?:number};
function CloudIcon({size=18,children,...props}:IconProps){return <svg width={size} height={size} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>;}
export function CloudImportIcon(props:IconProps){return <CloudIcon {...props}><path d="M18 37h-6a9 9 0 0 1 0-18h2 M15 15a11 11 0 0 1 20 5h1a8.5 8.5 0 0 1 0 17H24V24m-4 4 4-4 4 4"/></CloudIcon>;}
export function CloudExportIcon(props:IconProps){return <CloudIcon {...props}><path d="M14 36h-2a9 9 0 0 1 0-18h1A11 11 0 0 1 33 13 M34 19h2a8.5 8.5 0 0 1 0 17h-2 M24 24v17m-5-5 5 5 5-5"/></CloudIcon>;}
