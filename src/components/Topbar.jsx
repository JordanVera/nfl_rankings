import Link from 'next/link';

const Topbar = () => {
  return (
    <header className="border-b border-gray-800 p-5">
      <div className="flex gap-5">
        <Link href="/">Home</Link>
        <Link href="/about">About</Link>
      </div>
    </header>
  );
};
export default Topbar;
