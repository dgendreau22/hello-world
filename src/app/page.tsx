"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [count, setCount] = useState(0);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-zinc-100 to-zinc-200 dark:from-zinc-900 dark:to-zinc-950">
      <main className="flex flex-col items-center gap-8 p-8">
        <h1 className="text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Hello World!
        </h1>
        <p className="text-xl text-zinc-600 dark:text-zinc-400">
          Welcome to your Next.js + shadcn/ui app
        </p>

        <div className="flex flex-col items-center gap-4 rounded-xl border border-zinc-200 bg-white p-8 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-lg text-zinc-700 dark:text-zinc-300">
            You clicked the button{" "}
            <span className="font-bold text-zinc-900 dark:text-zinc-100">
              {count}
            </span>{" "}
            times
          </p>
          <div className="flex gap-4">
            <Button onClick={() => setCount(count + 1)}>Click me!</Button>
            <Button variant="outline" onClick={() => setCount(0)}>
              Reset
            </Button>
          </div>
        </div>

        <p className="text-sm text-zinc-500">
          Built with Next.js, TypeScript, Tailwind CSS, and shadcn/ui
        </p>
      </main>
    </div>
  );
}
