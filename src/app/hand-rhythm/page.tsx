import HandRhythmGame from "@/components/HandRhythmGame";

export const metadata = {
  title: "Hand Rhythm - MiniGame Motion Lab",
  description: "Upload your music and hit notes with hand tracking rhythm mode.",
};

export default function HandRhythmPage() {
  return (
    <main className="min-h-screen">
      <HandRhythmGame />
    </main>
  );
}
