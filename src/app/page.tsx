import { TopSection } from "@/components/TopSection";

export default function Home() {
  return (
    <>
      <TopSection />

      <div className="mx-auto max-w-5xl px-4 pb-12 pt-10">
        <p className="text-xs text-muted">
          &ldquo;NOW&rdquo; is ServiceNow, Inc. (NYSE: NOW). All figures derive from public sources.
          Prices shown are delayed.
        </p>
      </div>
    </>
  );
}
