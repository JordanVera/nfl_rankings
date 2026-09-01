import PowerRankings from '@/components/PowerRankings';

export default function HomePage() {
  return (
    <main className="mx-auto m-5 flex w-full max-w-[1200px] flex-col gap-8 text-white">
      <header>
        <p className="text-[11px] font-medium tracking-[0.32em] uppercase text-primary">
          TensorFlow.js · ESPN box scores · 25-D MLP
        </p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
          Train a season. Rank the league.
        </h1>
        <p className="mt-3 max-w-2xl text-white/85">
          Pick a league and year. The server pulls every regular-season box
          score, fits a small dense network on standardized point differential,
          and returns a power ranking you can read against ESPN.
        </p>
      </header>
      <PowerRankings />
    </main>
  );
}
