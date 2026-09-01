import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'How the model works · Football Power Rankings',
  description:
    'A technical walkthrough of how the NFL and FBS power rankings model ingests ESPN box scores, builds a 27-D feature tensor, and trains a TensorFlow.js MLP on standardized point differential.',
};

const PIPELINE = [
  {
    step: '01',
    label: 'Roster the league',
    detail: '32 NFL clubs, or ~FBS via ESPN FPI',
  },
  {
    step: '02',
    label: 'Enumerate weeks',
    detail: 'Regular season only · seasontype=2',
  },
  {
    step: '03',
    label: 'Pull box scores',
    detail: 'Summary API · 10 concurrent workers',
  },
  { step: '04', label: 'Featurize', detail: '27-D vector per team-game' },
  { step: '05', label: 'Z-score', detail: 'Population μ, σ across the season' },
  { step: '06', label: 'Fit MLP', detail: '27→128→64→32→1 · Adam · MSE' },
  {
    step: '07',
    label: 'Mean-pool',
    detail: 'Team rank = mean predicted margin',
  },
] as const;

const FEATURES = [
  {
    group: 'Offense (own)',
    rows: [
      ['offensiveYards', 'totalYards', 'Net offensive yards from scrimmage.'],
      [
        'passingYards',
        'netPassingYards',
        'Net passing yards (sacks already deducted by ESPN).',
      ],
      ['rushingYards', 'rushingYards', 'Rushing yards.'],
      [
        'completionPercentage',
        'completionAttempts',
        'Derived: completed / attempts × 100, parsed from C-A or C/A.',
      ],
      ['firstDowns', 'firstDowns', 'First downs earned.'],
      [
        'thirdDownConversions',
        'thirdDownEff',
        'Makes only, parsed from made-attempt strings.',
      ],
      ['fourthDownConversions', 'fourthDownEff', 'Makes only.'],
      [
        'redZoneConversions',
        'redZoneAttempts',
        'Scores inside the 20, makes only.',
      ],
    ],
  },
  {
    group: 'Defense (opponent box score)',
    rows: [
      [
        'opponentOffensiveYards',
        'opp.totalYards',
        'Yards allowed. Mirror of the other sideline.',
      ],
      [
        'opponentPassingYards',
        'opp.netPassingYards',
        'Net passing yards allowed.',
      ],
      ['opponentRushingYards', 'opp.rushingYards', 'Rushing yards allowed.'],
      [
        'opponentCompletionPercentage',
        'opp.completionAttempts',
        'Opponent C% allowed through the air.',
      ],
      ['opponentFirstDowns', 'opp.firstDowns', 'First downs allowed.'],
      [
        'opponentThirdDownConversions',
        'opp.thirdDownEff',
        'Opponent third-down makes.',
      ],
      [
        'opponentFourthDownConversions',
        'opp.fourthDownEff',
        'Opponent fourth-down makes.',
      ],
      [
        'opponentRedZoneConversions',
        'opp.redZoneAttempts',
        'Opponent red-zone scores.',
      ],
    ],
  },
  {
    group: 'Special teams / kicking',
    rows: [
      [
        'kickReturnYards',
        'kickReturnYards',
        'Team total, else Σ player kickReturns.kickReturnYards.',
      ],
      [
        'puntReturnYards',
        'puntReturnYards',
        'Team total, else Σ player puntReturns.puntReturnYards.',
      ],
      [
        'fieldGoalsMade',
        'fieldGoalsMade',
        'Makes parsed from FG made/attempts; player kicking fallback.',
      ],
      ['punts', 'punts', 'Punt count; player punting fallback.'],
    ],
  },
  {
    group: 'Turnovers, flags, clock, score',
    rows: [
      ['turnovers', 'turnovers', 'Giveaways. ESPN’s team turnover total.'],
      [
        'takeaways',
        'opp.turnovers',
        'Not a native takeaway field — opponent giveaways.',
      ],
      [
        'penalties',
        'totalPenaltiesYards',
        'Count half of the P-Y display string.',
      ],
      [
        'penaltyYards',
        'totalPenaltiesYards',
        'Yardage half of the same string.',
      ],
      [
        'timeOfPossession',
        'possessionTime',
        'MM:SS → seconds. Numeric ESPN values treated as seconds.',
      ],
      [
        'score',
        'header.competitors.score',
        'Final points. Also lives in the target.',
      ],
      [
        'opponentScore',
        'opp score',
        'Final points allowed. Also lives in the target.',
      ],
    ],
  },
] as const;

function SectionHeading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <header className="mb-4">
      <p className="text-[11px] font-medium tracking-[0.28em] uppercase text-primary">
        {kicker}
      </p>
      <h2 className="mt-1 text-2xl font-semibold text-white">{title}</h2>
    </header>
  );
}

export default function AboutPage() {
  return (
    <main className="mx-auto m-5 w-full max-w-[1200px] text-white">
      <article className="bg-gradient-to-br rounded-lg border border-primary/40 from-slate-700 to-slate-900">
        <div className="p-6 sm:p-8">
          <p className="text-[11px] font-medium tracking-[0.32em] uppercase text-primary">
            System notes · TensorFlow.js · ESPN box scores
          </p>
          <h1 className="mt-2 mb-4 text-3xl font-bold sm:text-4xl">
            How the ranking model actually works
          </h1>
          <p className="mb-6 max-w-3xl text-white/85">
            This is not a black-box “AI ranking.” It is a small multilayer
            perceptron, trained from scratch in TensorFlow.js on the server,
            whose job is to map a 27-dimensional box-score vector onto a
            standardized point differential, then average those predictions by
            team. The real work happens in{' '}
            <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-sm text-primary-300">
              computeSeasonRankings
            </code>
            , inside a Node.js route that can run for up to 300 seconds.
          </p>

          <ol className="grid grid-cols-1 gap-2 mb-10 sm:grid-cols-2">
            {PIPELINE.map((item) => (
              <li
                key={item.step}
                className="flex gap-3 rounded-md border border-white/10 bg-black/30 px-3 py-2.5"
              >
                <span className="font-mono text-sm text-primary">
                  {item.step}
                </span>
                <span>
                  <span className="block text-sm font-semibold">
                    {item.label}
                  </span>
                  <span className="text-xs text-white/60">{item.detail}</span>
                </span>
              </li>
            ))}
          </ol>

          <section className="mb-10">
            <SectionHeading
              kicker="01 · Ingest"
              title="Where the bytes come from"
            />
            <p className="mb-4 text-white/85">
              Every number in the model originates from ESPN’s undocumented but
              public JSON APIs. There is no proprietary play-by-play dump, no
              Next Gen Stats, no PFF grades. We speak HTTP to three families of
              endpoints, with a 3-attempt retry and linear backoff (400&nbsp;ms,
              800&nbsp;ms), and we ask Next to cache each response for 24 hours.
            </p>
            <div className="overflow-x-auto mb-4 rounded-md border border-white/10">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="text-xs tracking-wider uppercase bg-black/40 text-white/50">
                  <tr>
                    <th className="px-3 py-2 font-medium">Purpose</th>
                    <th className="px-3 py-2 font-medium">NFL</th>
                    <th className="px-3 py-2 font-medium">FBS (CFB)</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-[13px] text-white/80">
                  <tr className="border-t border-white/10">
                    <td className="px-3 py-2 font-sans text-white">
                      Team universe
                    </td>
                    <td className="px-3 py-2">site.api …/nfl/teams?limit=32</td>
                    <td className="px-3 py-2">
                      Fitt v3 FPI?season=&amp;limit=200
                    </td>
                  </tr>
                  <tr className="border-t border-white/10">
                    <td className="px-3 py-2 font-sans text-white">
                      Week calendar + scoreboard
                    </td>
                    <td className="px-3 py-2">…/nfl/scoreboard?seasontype=2</td>
                    <td className="px-3 py-2">
                      …/college-football/scoreboard?groups=80
                    </td>
                  </tr>
                  <tr className="border-t border-white/10">
                    <td className="px-3 py-2 font-sans text-white">
                      Per-game box score
                    </td>
                    <td className="px-3 py-2">…/nfl/summary?event=ID</td>
                    <td className="px-3 py-2">
                      …/college-football/summary?event=ID
                    </td>
                  </tr>
                  <tr className="border-t border-white/10">
                    <td className="px-3 py-2 font-sans text-white">
                      Reference ranking
                    </td>
                    <td className="px-3 py-2">
                      ESPN FPI (fpi, fpirank, W-L-T)
                    </td>
                    <td className="px-3 py-2">
                      core API rankings/1 (AP Top 25), latest week with data
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mb-3 text-white/85">
              NFL teams are the 32 clubs on the league teams endpoint, sorted by
              display name. College football is not “every NCAA team”: the FPI
              payload is the FBS set (limit 200), and scoreboards are pinned to
              ESPN group <code className="font-mono text-primary-300">80</code>{' '}
              (FBS). If an FBS club plays an FCS opponent, we still ingest the
              FBS side of that box score; the FCS opponent is dropped because
              its id is not in the roster.
            </p>
            <p className="mb-3 text-white/85">
              Season slicing is strict. We only keep{' '}
              <span className="text-primary-300">regular season</span> games (
              <code className="font-mono text-sm">seasontype = 2</code>
              ). Preseason and playoffs never enter the tensor. A game is
              admitted only if ESPN marks it completed (
              <code className="font-mono text-sm">
                status.type.completed
              </code>{' '}
              or <code className="font-mono text-sm">STATUS_FINAL</code>
              ). Week numbers are read from the scoreboard calendar; if that
              parse fails we fall back to 18 NFL weeks or 16 CFB weeks.
            </p>
            <p className="text-white/85">
              Event ids are collected across every week, dumped into a{' '}
              <code className="font-mono text-sm">Set</code> so a game cannot be
              trained on twice, then fetched with a worker pool of{' '}
              <strong>10 concurrent summary requests</strong>. That pool is why
              the first CFB run is slow: you are hydrating on the order of a
              thousand game summaries, not running a giant GPU job.
            </p>
          </section>

          <section className="mb-10">
            <SectionHeading
              kicker="02 · Parse"
              title="One game becomes two training rows"
            />
            <p className="mb-4 text-white/85">
              A summary payload has a two-team box score plus a header with
              final scores. We emit <em>two</em>{' '}
              <code className="font-mono text-sm">GameStats</code> objects: team
              A vs B, and team B vs A, with opponent features mirrored. That
              duplication is load-bearing. It makes the marginal distribution of{' '}
              <code className="font-mono text-sm">score</code> and{' '}
              <code className="font-mono text-sm">opponentScore</code> identical
              across the season matrix (every point scored is also a point
              allowed, from the other row). That identity is what lets the
              target collapse to a scaled margin, as we&apos;ll see in §04.
            </p>
            <p className="mb-4 text-white/85">
              ESPN stats are annoyingly heterogeneous. Some fields are numeric{' '}
              <code className="font-mono text-sm">value</code>s. Efficiency
              stats arrive as display strings like{' '}
              <code className="font-mono text-sm">7-14</code> or{' '}
              <code className="font-mono text-sm">7/14</code>. We split on{' '}
              <code className="font-mono text-sm">[-/]</code> and keep the
              numerator (makes). Completion percentage is reconstructed from
              completions and attempts rather than trusted as a pre-baked
              percentage. Penalties arrive as a single{' '}
              <code className="font-mono text-sm">count-yards</code> blob.
              Possession is either{' '}
              <code className="font-mono text-sm">MM:SS</code> or a raw second
              count. Missing stats become 0, not null — the network never sees
              NaNs.
            </p>
            <p className="text-white/85">
              Special teams are the flakiest layer. Kick-return yards,
              punt-return yards, field goals made, and punts are read from the
              team box score first. If those keys are empty, we walk{' '}
              <code className="font-mono text-sm">boxscore.players</code>, find
              the matching statistical group (
              <code className="font-mono text-sm">kickReturns</code>,{' '}
              <code className="font-mono text-sm">puntReturns</code>,{' '}
              <code className="font-mono text-sm">kicking</code>,{' '}
              <code className="font-mono text-sm">punting</code>), locate the
              column by key name, and sum across athletes. Slash stats like{' '}
              <code className="font-mono text-sm">
                fieldGoalsMade/fieldGoalAttempts
              </code>{' '}
              contribute only the left-hand number.
            </p>
          </section>

          <section className="mb-10">
            <SectionHeading
              kicker="03 · Feature space"
              title="The 27-dimensional team-game vector"
            />
            <p className="mb-4 text-white/85">
              After parsing, time of possession is converted to seconds and the
              record is projected into a fixed-order{' '}
              <code className="font-mono text-sm">float32</code> vector of
              length 27. There is no embedding layer, no opponent id, no
              home/away bit, no week index, no rest days, no QB identity. The
              model can only “see” what happened on the stat sheet that
              afternoon.
            </p>
            <div className="space-y-5">
              {FEATURES.map((group) => (
                <div key={group.group}>
                  <h3 className="mb-2 text-lg font-semibold text-primary-300">
                    {group.group}
                  </h3>
                  <div className="overflow-x-auto rounded-md border border-white/10">
                    <table className="w-full min-w-[40rem] text-left text-sm">
                      <thead className="text-xs tracking-wider uppercase bg-black/40 text-white/50">
                        <tr>
                          <th className="px-3 py-2 font-medium">Tensor slot</th>
                          <th className="px-3 py-2 font-medium">ESPN source</th>
                          <th className="px-3 py-2 font-medium">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map(([slot, source, notes]) => (
                          <tr key={slot} className="border-t border-white/10">
                            <td className="px-3 py-2 font-mono text-[13px] text-primary-200">
                              {slot}
                            </td>
                            <td className="px-3 py-2 font-mono text-[13px] text-white/70">
                              {source}
                            </td>
                            <td className="px-3 py-2 text-white/80">{notes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-10">
            <SectionHeading
              kicker="04 · Normalize"
              title="Z-scoring the season, then defining y"
            />
            <p className="mb-4 text-white/85">
              All team-games in the season are flattened into one matrix{' '}
              <span className="font-mono text-sm">X ∈ ℝⁿˣ²⁷</span>. For each
              column <span className="font-mono text-sm">j</span> we compute the{' '}
              <em>population</em> mean and standard deviation (divide by{' '}
              <span className="font-mono text-sm">n</span>, not{' '}
              <span className="font-mono text-sm">n − 1</span>):
            </p>
            <pre className="overflow-x-auto p-4 mb-4 font-mono text-sm rounded-md border border-white/10 bg-black/50 text-primary-200">
              {`μⱼ = (1/n) Σᵢ xᵢⱼ
σⱼ = √( (1/n) Σᵢ (xᵢⱼ − μⱼ)² )
x̃ᵢⱼ = (xᵢⱼ − μⱼ) / σⱼ     with σⱼ := 1 if the column is constant`}
            </pre>
            <p className="mb-4 text-white/85">
              This is a season-relative z-score: a 350-yard passing game in a
              shootout year is not the same coordinate as 350 yards in a mud
              year. Normalization is global across the league-season, not
              per-team, so a team that always runs the ball still gets compared
              to the league centroid.
            </p>
            <p className="mb-4 text-white/85">
              The supervision target is not win/loss and not a ranking
              permutation. It is the difference of the already-normalized
              scoring columns:
            </p>
            <pre className="overflow-x-auto p-4 mb-4 font-mono text-sm rounded-md border border-white/10 bg-black/50 text-primary-200">
              {`yᵢ = x̃ᵢ,score − x̃ᵢ,opponentScore`}
            </pre>
            <p className="text-white/85">
              Because every game is stored twice (once per sideline),{' '}
              <span className="font-mono text-sm">score</span> and{' '}
              <span className="font-mono text-sm">opponentScore</span> share the
              same empirical moments: μ<sub>s</sub> = μ<sub>o</sub> and σ
              <sub>s</sub> = σ<sub>o</sub>. The expression therefore simplifies
              to{' '}
              <span className="font-mono text-sm">
                yᵢ = (marginᵢ) / σ<sub>score</sub>
              </span>
              . We are asking the net to predict{' '}
              <strong>standardized point differential</strong>. That is the
              entire learning problem.
            </p>
          </section>

          <section className="mb-10">
            <SectionHeading
              kicker="05 · Architecture"
              title="A four-layer MLP, ~14k parameters"
            />
            <p className="mb-4 text-white/85">
              The network is a vanilla TensorFlow.js{' '}
              <code className="font-mono text-sm">tf.sequential</code> dense
              stack. No dropout, no batch-norm, no residual connections, no
              attention. Hidden activations are ReLU. The output unit is linear
              (identity) because this is unbounded regression, not a
              classification.
            </p>
            <div className="overflow-x-auto p-4 mb-4 font-mono text-sm leading-7 rounded-md border border-white/10 bg-black/40 text-primary-200">
              <p>input ℝ²⁷</p>
              <p>dense 27 → 128 ReLU 3,584 params</p>
              <p>dense 128 → 64 ReLU 8,256 params</p>
              <p>dense 64 → 32 ReLU 2,080 params</p>
              <p>dense 32 → 1 linear 33 params</p>
              <p className="text-white/50">≈ 13,953 trainable weights</p>
            </div>
            <ul className="pl-5 mb-4 space-y-2 list-disc text-white/85">
              <li>
                <strong>Optimizer:</strong> Adam, TensorFlow.js defaults (α =
                10⁻³, β₁ = 0.9, β₂ = 0.999, ε = 10⁻⁷).
              </li>
              <li>
                <strong>Loss:</strong> mean squared error on{' '}
                <span className="font-mono text-sm">y</span>. Quadratic penalty,
                so a 21-point miss is 9× as expensive as a 7-point miss.
                Blowouts dominate the gradient.
              </li>
              <li>
                <strong>Reported metric:</strong> MAE, which is easier to read
                in “standardized points” but is not what Adam is minimizing.
              </li>
              <li>
                <strong>Schedule:</strong> 50 epochs, batch size 32,{' '}
                <code className="font-mono text-sm">validationSplit: 0.2</code>,{' '}
                <code className="font-mono text-sm">shuffle: true</code> (TF.js
                default). The last 20% of the shuffled rows are held out for the
                val curve; they are <em>not</em> held out of the eventual
                ranking pass.
              </li>
            </ul>
            <p className="mb-4 text-white/85">
              Sample size vs capacity is the fun part. An NFL regular season is
              272 games × 2 rows ≈ 544 examples. After the val split you have
              ~435 training rows to estimate 14k weights. That is an
              overparameterized interpolating regime. FBS is healthier (~130
              teams × ~12 games, still doubled). We are not training a
              foundation model. We are fitting a flexible function of one
              season’s box scores, then immediately evaluating it on those same
              rows.
            </p>
            <p className="text-white/85">
              Weights are ephemeral. After{' '}
              <code className="font-mono text-sm">fit</code> we{' '}
              <code className="font-mono text-sm">predict</code>, convert the
              output tensor to a nested JS array, then{' '}
              <code className="font-mono text-sm">dispose</code> the input,
              target, and model and close a{' '}
              <code className="font-mono text-sm">tf.engine()</code> scope.
              Nothing is checkpointed to disk. Hit the endpoint again (or wait
              out the 24h cache) and you train a fresh draw of Adam from the
              default random initialization. Rankings can jitter slightly run to
              run; the cache is what makes the UI feel deterministic.
            </p>
          </section>

          <section className="mb-10">
            <SectionHeading
              kicker="06 · Inference"
              title="Ranking is mean predicted margin"
            />
            <p className="mb-4 text-white/85">
              After training we push the entire season tensor — train and val
              rows together — back through the net. For team{' '}
              <span className="font-mono text-sm">t</span> with games{' '}
              <span className="font-mono text-sm">Gₜ</span>:
            </p>
            <pre className="overflow-x-auto p-4 mb-4 font-mono text-sm rounded-md border border-white/10 bg-black/50 text-primary-200">
              {`sₜ = (1 / |Gₜ|)  Σ_{g ∈ Gₜ}  fθ(x̃_g)`}
            </pre>
            <p className="mb-4 text-white/85">
              Teams with zero completed regular-season games are dropped before
              <code className="font-mono text-sm"> fit</code> and never appear.
              Everyone else is sorted by{' '}
              <span className="font-mono text-sm">sₜ</span> descending. That
              scalar is the number you see in the table. It is
              <em> not</em> a win total, not an Elo rating, and not ESPN FPI. It
              is the team’s average predicted standardized margin given how its
              box scores look.
            </p>
            <p className="mb-4 text-white/85">
              Two interpretive caveats, because they matter:
            </p>
            <ul className="pl-5 mb-4 space-y-2 list-disc text-white/85">
              <li>
                <strong>Feature leakage into y.</strong> The last two input
                coordinates <em>are</em> z-scored score and opponent score, and{' '}
                <span className="font-mono text-sm">y</span> is exactly their
                difference. A linear readout of those two slots already solves
                the task. In principle the hidden layers can ignore rushing
                yards entirely and just reconstruct margin. In practice Adam,
                ReLU geometry, and MSE on a small sample let the other 25
                box-score channels still move the prediction — the net is a
                nonlinear smoother of “how you won,” not a pure margin
                calculator — but this is not an out-of-sample “predict the score
                without knowing the score” model. It is a learned compression of
                a game that already includes the result.
              </li>
              <li>
                <strong>No explicit strength of schedule.</strong> Opponent
                quality enters only insofar as the opponent’s box-score
                production that day sits in the mirrored features. Beating a
                cupcake 40–10 and beating a contender 40–10 look similar if the
                yardage/turnover profiles match. There is no Massey, Colley, or
                Bradley-Terry graph on top. Home field, injuries, weather, and
                recency are all invisible. A week-1 demolition and a week-18
                demolition are exchangeable.
              </li>
            </ul>
            <p className="text-white/85">
              So when our list disagrees with FPI or the AP poll, that is not a
              bug so much as a different objective: FPI is a predictive
              efficiency rating with opponent adjustments; AP is a human ballot.
              We are mean-pooling a box-score MLP’s reconstructed margin.
            </p>
          </section>

          <section className="mb-10">
            <SectionHeading
              kicker="07 · Serving"
              title="The HTTP path, the cache, and the fake HUD"
            />
            <p className="mb-4 text-white/85">
              The browser calls{' '}
              <code className="font-mono text-sm">
                GET /api/rankings?season=YYYY&amp;league=nfl|cfb
              </code>
              . Seasons are clamped to 2023–2026. The handler is a Node runtime
              (not Edge) with{' '}
              <code className="font-mono text-sm">maxDuration = 300</code>,
              wrapped in{' '}
              <code className="font-mono text-sm">unstable_cache</code> under
              the key{' '}
              <code className="font-mono text-sm">power-rankings-v3</code>,
              revalidate 86,400 seconds. First visitor of the day pays for ESPN
              hydration plus 50 epochs of Adam. Everyone else that day gets JSON
              out of cache.
            </p>
            <p className="mb-4 text-white/85">
              The sci-fi overlay — “UPLINKING ESPN SCOREBOARD,” the ring, the
              equalizer — is a client-side progress skin keyed off the fetch
              promise. Its stage list is not hooked to real training callbacks.{' '}
              <code className="font-mono text-sm">model.fit</code> runs with{' '}
              <code className="font-mono text-sm">verbose: 0</code>. We do not
              stream epoch loss to the browser.
            </p>
            <p className="text-white/85">
              Side-by-side on the home page, NFL is compared to ESPN FPI
              (including the FPI scalar and W-L-T from the same payload). FBS is
              compared to the AP Top 25, walking regular-season weeks in reverse
              until a rankings document exists. Delta in the UI is{' '}
              <span className="font-mono text-sm">espnRank − modelRank</span>:
              positive means we have you higher than the public list.
            </p>
          </section>

          <section>
            <SectionHeading
              kicker="08 · Bottom line"
              title="What you are looking at"
            />
            <p className="mb-4 text-white/85">
              Ingest completed regular-season ESPN box scores. Turn each
              sideline into a 27-D vector of yards, efficiency makes, return
              yards, turnovers, flags, clock, and points. Z-score the season.
              Train a 27→128→64→32→1 ReLU MLP with Adam/MSE to reconstruct
              standardized point differential. Rank teams by the mean of those
              reconstructions. Compare against FPI or the AP poll so you can
              argue on the internet with numbers that at least came from a
              well-specified objective.
            </p>
            <p className="text-white/60">
              If you want the code, the interesting files are{' '}
              <code className="font-mono text-sm text-primary-300">
                src/utils/espnApi.ts
              </code>{' '}
              (ingest + parse),{' '}
              <code className="font-mono text-sm text-primary-300">
                src/lib/powerRankings.ts
              </code>{' '}
              (z-score, graph, fit, mean-pool), and{' '}
              <code className="font-mono text-sm text-primary-300">
                src/app/api/rankings/route.ts
              </code>{' '}
              (cache + HTTP).
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
