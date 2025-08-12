// app/page.tsx
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import ClientViewportRedirect from "./redirect-to-mobile";

// Lazy-load the existing Plan client component for desktop
const Plan = dynamic(() => import("./plan"), { ssr: false });

function isMobileUA(ua: string) {
  const s = ua.toLowerCase();
  // keep it simple and reliable
  return /(iphone|ipad|ipod|android|blackberry|iemobile|opera mini)/i.test(s);
}

export default function Home() {
  const ua = headers().get("user-agent") || "";

  // Server-side redirect for real mobile devices
  if (isMobileUA(ua)) {
    redirect("/mobile");
  }

  return (
    <main className="p-6">
      {/* Client fallback: if it looks small, move to /mobile. Skips when already on /mobile. */}
      <ClientViewportRedirect />
      <Plan />
    </main>
  );
}
