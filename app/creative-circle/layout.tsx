import type { Metadata } from "next";
export const metadata: Metadata = { title:"Creative Circle", robots:{index:false,follow:false} };
export default function CreativeCircleLayout({children}:{children:React.ReactNode}){return <div className="cc-page">{children}</div>}
