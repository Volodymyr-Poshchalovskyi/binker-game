import Navbar from './Navbar';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 font-sans selection:bg-zinc-800 selection:text-white">
      <Navbar />
      <main>{children}</main>
    </div>
  );
}