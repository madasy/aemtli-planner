import dynamic from "next/dynamic";

// Plan is a client component; load it only on the homepage and skip SSR
const Plan = dynamic(() => import("./plan"), { ssr: false });

export default function Home() {
  return (
    <main className="p-6">
      <Plan />
    </main>
  );
}
