import { Link, useLocation } from "wouter";
import { ReactNode } from "react";

const links = [["/", "⌂", "Home"], ["/scan", "⌾", "Scan"], ["/rules", "☑", "Rules"], ["/verdicts", "◈", "Verdicts"], ["/health", "◇", "Health"], ["/history", "↺", "History"], ["/modes", "▣", "Modes"], ["/assistant", "✦", "Guide"]];

export default function ProductShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <div className="product-app"><aside className="app-sidebar"><div className="sidebar-brand">Metrology<span>Lens</span><small>COMMODITY COMPLIANCE</small></div><nav>{links.map(([href, icon, label]) => <Link key={href} href={href} className={location === href ? "active" : ""}><b>{icon}</b><span>{label}</span></Link>)}</nav><div className="sidebar-note">LEGAL METROLOGY ACT, 2009<br />PCR 2011 · FSSAI 2.4.5</div></aside><main className="app-main"><header className="app-header"><div><span className="eyebrow">FIELD INSPECTION SYSTEM</span><strong>{links.find(item => item[0] === location)?.[2] ?? "MetrologyLens"}</strong></div><Link href="/assistant" className="assistant-link">Need help? Ask the guide ↗</Link></header>{children}</main><nav className="app-mobile-nav">{links.slice(0, 6).map(([href, icon, label]) => <Link key={href} href={href} className={location === href ? "active" : ""}><b>{icon}</b><small>{label}</small></Link>)}</nav></div>;
}
