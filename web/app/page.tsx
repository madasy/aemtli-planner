import Link from "next/link";
import Plan from "./plan";

export default async function Home() {
  return (
    <main className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Ämtli – 16 Wochen Plan</h1>
        <Link href="/admin" className="underline">Admin</Link>
      </div>
      <Plan />
    </main>
  );
}
