import Jumbotron from '@/components/Jumbotron';
import PowerRankings from '@/components/PowerRankings';

const IndexPage = () => {
  return (
    <main className="m-5 flex flex-col gap-5 justify-center items-center max-w-[1200px] w-full mx-auto">
      <PowerRankings />
    </main>
  );
};

export default IndexPage;
