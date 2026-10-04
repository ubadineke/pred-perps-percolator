"use client";
import { AppShell } from "@/components/app-shell";
export default function ErrorPage({reset}:{reset:()=>void}){return <AppShell><div className="admin-page"><div className="admin-notice error"><span><b>Admin console unavailable</b>The configuration could not be loaded.</span><button type="button" onClick={reset}>Retry</button></div></div></AppShell>}
