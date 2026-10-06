import { ArrowRight, BarChart3, BookOpenText, CircleHelp, Gauge, Layers3, Radio, Waves } from "lucide-react";
import Layout from "../components/Layout";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

type GuideCardProps = {
  readonly index: string;
  readonly icon: React.ReactNode;
  readonly title: string;
  readonly description: string;
  readonly children: React.ReactNode;
};

function GuideCard({ index, icon, title, description, children }: GuideCardProps) {
  return (
    <Card className="education-card">
      <CardHeader>
        <div className="education-card-kicker"><span>{icon}</span>{index}</div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Term({ name, children }: { readonly name: string; readonly children: React.ReactNode }) {
  return (
    <div className="education-term">
      <strong>{name}</strong>
      <p>{children}</p>
    </div>
  );
}

function FootprintVisual() {
  return <div className="education-footprint-visual" aria-label="Footprint candle example">
    <span className="education-visual-axis">PRICE</span>
    {["101,240", "101,230", "101,220", "101,210"].map((price, index) => (
      <div className="education-footprint-row" key={price}>
        <small>{price}</small>
        <span className={index === 1 ? "sell-cell" : "bid-cell"}>{["84", "312", "128", "76"][index]}</span>
        <span className="footprint-separator">:</span>
        <span className={index === 1 ? "buy-cell" : "ask-cell"}>{["241", "96", "416", "52"][index]}</span>
      </div>
    ))}
    <div className="education-footprint-legend"><span className="education-bid">Bid</span><span className="education-ask">Ask</span></div>
  </div>;
}

function ProfileVisual({ session = false }: { readonly session?: boolean }) {
  const levels = ["", "VAH", "", "POC", "", "VAL", "", ""];
  return <div className={session ? "education-profile-visual session-profile-visual" : "education-profile-visual"} aria-label="Volume profile example">
    <div className="education-profile-bars">{levels.map((level, index) => (
      <div className="education-profile-row" key={`${level}-${index}`}>
        {level && <span className={`education-profile-label education-${level.toLowerCase()}`}>{level}</span>}
        <i className={level === "POC" ? "education-poc-bar" : ""} />
        {!session && (level === "VAH" || level === "VAL") && <span className={`education-profile-guide-line education-${level.toLowerCase()}-guide-line`} />}
      </div>
    ))}</div>
  </div>;
}

function OverlayVisual() {
  return <div className="education-overlay-visual" aria-label="VWAP price overlay example">
    <div className="education-overlay-grid"><i /><i /><i /><i /><i /><i /></div>
    <div className="education-vwap-line"><span>VWAP</span></div>
  </div>;
}

function DeltaVisual({ cumulative = false }: { readonly cumulative?: boolean }) {
  if (cumulative) {
    return <div className="education-delta-visual" aria-label="Cumulative delta graph example">
      <span className="education-delta-zero" />
      <svg className="education-cvd-graph" viewBox="0 0 280 100" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="0,76 38,63 76,68 114,49 152,55 190,31 228,38 280,17" fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="education-cvd-label">CVD</span>
    </div>;
  }

  return <div className="education-delta-visual" aria-label={cumulative ? "Cumulative delta example" : "Delta histogram example"}>
    {["positive", "positive", "negative", "positive", "negative", "negative", "positive"].map((type, index) => (
      <i className={type} key={`${type}-${index}`} style={{ height: `${[38, 58, 28, 72, 46, 64, 82][index]}%` }} />
    ))}
    <span className="education-delta-zero" />
  </div>;
}

export function EducationPage() {
  return (
    <Layout>
      <div className="education-page">
        <section className="education-hero">
          <div>
            <Badge variant="outline" className="education-eyebrow"><BookOpenText size={13} /> Order-flow guide</Badge>
            <h1>From individual trades<br /><span>to market structure.</span></h1>
            <p className="education-intro">
              Learn how TickWeave combines volume, bid/ask pressure and price levels.
              Every term on this page maps to a tool in the order-flow chart.
            </p>
            <Button asChild size="lg"><a href="/order-flow">Open the chart <ArrowRight size={16} /></a></Button>
          </div>
          <div className="education-hero-index" aria-label="Guide contents">
            <span>CONTENTS</span>
            <strong>08</strong>
            <p>Tools for<br />contextual decisions</p>
          </div>
        </section>

        <section className="education-section" aria-labelledby="read-flow-heading">
          <div className="education-section-heading">
            <div><span className="education-section-label">01 / FLOW</span><h2 id="read-flow-heading">Read pressure inside the candle.</h2></div>
            <p>Each candle shows more than price. It reveals who traded more aggressively at each level.</p>
          </div>
          <div className="education-grid education-grid-three">
            <GuideCard index="01 / FOOTPRINT" icon={<BarChart3 size={17} />} title="Footprint Candle" description="Bid and Ask volume are separated at every price level inside a candle.">
              <p>Bid volume is shown on the left, Ask volume on the right. The imbalance between both sides shows who was more aggressive at a level.</p>
              <FootprintVisual />
            </GuideCard>
            <GuideCard index="02 / IMBALANCE" icon={<Gauge size={17} />} title="Imbalances" description="A strong volume difference on one side marks aggressive pressure.">
              <p>An imbalance appears when dominant volume is at least 3:1 larger than the opposite diagonal volume. Buy imbalances signal aggressive buying; sell imbalances signal aggressive selling.</p>
              <div className="education-rule"><span>Minimum ratio</span><strong>3 : 1</strong></div>
            </GuideCard>
            <GuideCard index="03 / STACK" icon={<Layers3 size={17} />} title="Stacked Imbalances" description="Several adjacent imbalances on the same side form a stack.">
              <p>TickWeave marks at least three consecutive imbalances as a stack. A stack confirms that pressure is present across multiple price levels, not just one.</p>
              <div className="education-stack"><i /><i /><i /><span>3+ levels</span></div>
            </GuideCard>
          </div>
        </section>

        <section className="education-section education-section-bordered" aria-labelledby="profiles-heading">
          <div className="education-section-heading">
            <div><span className="education-section-label">02 / PROFILES</span><h2 id="profiles-heading">Where did volume gather?</h2></div>
            <p>Profiles compress many price levels into a map of acceptance and rejection.</p>
          </div>
          <div className="education-grid education-grid-two">
            <GuideCard index="04 / CANDLE" icon={<Waves size={17} />} title="Candle Volume Profile" description="The volume distribution inside a single candle.">
              <p>The profile maps traded volume across the candle's price range. Wider areas show where the most activity took place during that move.</p>
              <ProfileVisual />
            </GuideCard>
            <GuideCard index="05 / SESSION" icon={<Radio size={17} />} title="Session Volume Profile" description="The aggregated profile of a selected trading session.">
              <p>Choose Sydney, Tokyo, London or New York, then select today or yesterday. The profile aggregates every available candle in that window.</p>
              <ProfileVisual session />
            </GuideCard>
          </div>
        </section>

        <section className="education-section education-section-bordered" aria-labelledby="levels-heading">
          <div className="education-section-heading">
            <div><span className="education-section-label">03 / LEVELS</span><h2 id="levels-heading">The three key profile levels.</h2></div>
            <p>These reference points help you read volume distribution and market reactions.</p>
          </div>
          <Card className="education-level-card">
            <CardContent className="education-level-list">
              <Term name="Point of Control (POC)">The price level with the highest traded volume in the profile. It marks where the market found the most activity and acceptance.</Term>
              <Term name="Value Area High (VAH)">The upper boundary of the Value Area. Together with VAL, it contains the configured share of the profile's traded volume.</Term>
              <Term name="Value Area Low (VAL)">The lower boundary of the Value Area. Reactions at VAH or VAL can show whether the market accepts or leaves its previous value.</Term>
            </CardContent>
          </Card>
        </section>

        <section className="education-section education-section-bordered" aria-labelledby="indicators-heading">
          <div className="education-section-heading">
            <div><span className="education-section-label">04 / INDICATORS</span><h2 id="indicators-heading">Additional context around the price chart.</h2></div>
            <p>Indicators add direction, average price and pressure changes to the price action.</p>
          </div>
          <div className="education-grid education-grid-three">
            <GuideCard index="06 / VWAP" icon={<BarChart3 size={17} />} title="Session VWAP" description="The volume-weighted average price, drawn inside the main price pane.">
              <p>VWAP weights every traded price by its volume. In TickWeave it is drawn directly over the candles, showing whether price is above or below the session's accepted average.</p>
              <OverlayVisual />
            </GuideCard>
            <GuideCard index="07 / CVD" icon={<Waves size={17} />} title="Cumulative Delta" description="The running total of Ask volume minus Bid volume.">
              <p>Rising CVD means net aggressive buying; falling CVD means net aggressive selling. Divergences between price and CVD add context to the move.</p>
              <DeltaVisual cumulative />
            </GuideCard>
            <GuideCard index="08 / DELTA" icon={<CircleHelp size={17} />} title="Delta Histogram" description="The per-candle difference between Ask and Bid volume.">
              <p>Each bar shows the difference between Ask and Bid volume for one candle. Direction and height make short-term pressure bursts visible.</p>
              <DeltaVisual />
            </GuideCard>
          </div>
        </section>
      </div>
    </Layout>
  );
}
