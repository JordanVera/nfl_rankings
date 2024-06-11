import Image from 'next/image';
import Link from 'next/link';

const Topbar = () => {
  return (
    <header className="border-b border-gray-800 p-5">
      <div className="max-w-[1200px] mx-auto">
        <div className="flex items-center gap-2">
          <Link href="/">
            <Image src="/media/logoWhite.svg" height={30} width={30} />
          </Link>
          <Link href="/" className="hover:bg-gray-800 rounded-md p-2">
            Home
          </Link>
          <Link href="/about" className="hover:bg-gray-800 rounded-md p-2">
            About
          </Link>
        </div>
      </div>
    </header>
  );
};
export default Topbar;
