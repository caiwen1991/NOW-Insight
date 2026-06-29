import { DisclaimerBar } from "@/components/now/DisclaimerBar";
import { OverviewProvider } from "@/components/now/OverviewProvider";
import { SiteHeader } from "@/components/now/SiteHeader";
import { Hero } from "@/components/now/Hero";
import { Modeler } from "@/components/now/Modeler";
import { News } from "@/components/now/News";
import { Basics } from "@/components/now/Basics";
import { SiteFooter } from "@/components/now/SiteFooter";

export default function Home() {
  return (
    <>
      <DisclaimerBar />
      {/* One live fetch (/api/overview) shared by every data-driven section below. */}
      <OverviewProvider>
        <SiteHeader />
        <Hero />
        <Modeler />
        <News />
        <Basics />
      </OverviewProvider>
      <SiteFooter />
    </>
  );
}
