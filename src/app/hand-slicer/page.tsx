import HandTrackingGame from "@/components/HandTrackingGame";

export const metadata = {
  title: "Hand Slicer - MiniGame Motion Lab",
  description: "Slice orbs with hand tracking and survive escalating speed.",
};

export default function HandSlicerPage() {
  return (
    <main className="min-h-screen">
      <HandTrackingGame />
    </main>
  );
}
