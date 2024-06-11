import PowerRankings from '@/components/PowerRankings';

const IndexPage = () => {
  return (
    <main className="m-5 flex flex-col gap-5 justify-center items-center">
      <h1 className="text-center text-2xl font-bold">NFL Team Rankings</h1>

      <PowerRankings />
    </main>
  );
};

export default IndexPage;
