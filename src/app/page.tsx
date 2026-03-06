import Link from "next/link";

export default function Home() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden px-6 py-10 md:px-12 md:py-12">
      <div className="grain-overlay" />
      <div className="orbit-glow left-[-120px] top-[-140px] h-[320px] w-[320px] bg-[#20d4b2]/35" />
      <div className="orbit-glow right-[-180px] top-[22%] h-[360px] w-[360px] bg-[#ff7a18]/30" />

      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-10 lg:gap-14">
        <div className="float-in space-y-5">
          <div className="hero-line inline-flex rounded-full px-4 py-2 text-xs uppercase tracking-[0.28em] text-[#ffe4be]">
            Franzzz
          </div>
          <h1 className="title-display max-w-4xl text-5xl leading-[0.95] text-[#f7fbff] sm:text-6xl lg:text-8xl">
            MiniGame Portal
            <span className="block text-[#ffd166]">Track Hands, Break Scores</span>
          </h1>
          <p className="max-w-2xl text-base text-[#bfd0da] sm:text-lg">
            Dua mini game berbasis kamera dengan vibe arcade modern: pilih mode slicing untuk aksi cepat atau rhythm untuk akurasi beat.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Link
            href="/hand-slicer"
            className="glass-panel card-rise float-in group relative overflow-hidden rounded-3xl p-7 sm:p-8"
          >
            <div className="absolute right-[-30px] top-[-40px] h-32 w-32 rounded-full bg-[#20d4b2]/20 blur-3xl" />
            <p className="mb-4 text-xs uppercase tracking-[0.24em] text-[#9fd7cc]">Arcade Action</p>
            <h2 className="title-display text-4xl text-white">Hand Slicer</h2>
            <p className="mt-3 max-w-md text-[#a8c0cd]">
              Tebas orb hijau secepat mungkin dan hindari killer merah. Semakin lama bertahan, tempo akan meningkat.
            </p>
            <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-[#20d4b2]/40 bg-[#20d4b2]/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.16em] text-[#b0f4e6]">
              Launch
              <span aria-hidden>+</span>
            </div>
          </Link>

          <Link
            href="/hand-rhythm"
            className="glass-panel card-rise float-in group relative overflow-hidden rounded-3xl p-7 sm:p-8"
          >
            <div className="absolute right-[-30px] top-[-40px] h-32 w-32 rounded-full bg-[#ff7a18]/20 blur-3xl" />
            <p className="mb-4 text-xs uppercase tracking-[0.24em] text-[#ffbf90]">Music Challenge</p>
            <h2 className="title-display text-4xl text-white">Hand Rhythm</h2>
            <p className="mt-3 max-w-md text-[#a8c0cd]">
              Upload lagu, sinkronkan gerakan jari dengan beat, dan bangun combo tinggi untuk hasil grade terbaik.
            </p>
            <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-[#ff7a18]/50 bg-[#ff7a18]/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.16em] text-[#ffd0ad]">
              Play
              <span aria-hidden>+</span>
            </div>
          </Link>
        </div>

        <div className="float-in flex flex-wrap items-center justify-between gap-4 text-sm text-[#95a8b3]">
          <p>Camera + MediaPipe + Canvas Rendering</p>
          <p className="rounded-full border border-[#ffe4be]/25 bg-[#ffe4be]/10 px-4 py-2 uppercase tracking-[0.18em] text-[#ffe4be]">
            System Ready
          </p>
        </div>
      </section>

      <div className="pointer-events-none absolute bottom-7 left-1/2 -translate-x-1/2 text-xs uppercase tracking-[0.2em] text-[#7d95a1]">
        Dibuat Sama Franzzz Imoetzz
      </div>
    </main>
  );
}
