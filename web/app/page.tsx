import Link from "next/link";
import dynamic from "next/dynamic";

// Plan is a client component; load it only on the homepage and skip SSR
const Plan = dynamic(() => import("./plan"), { ssr: false });

export default function Home() {
  return (
    <main className="p-6">
      <div className="flex items-center justify-end mb-4">
        <Link href="/admin" className="underline">
          Admin
        </Link>
      </div>
      <Plan />
    </main>
  );
}
