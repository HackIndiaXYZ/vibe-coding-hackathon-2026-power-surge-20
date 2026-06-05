"use client";
import { useState } from "react";

export default function Home() {
  const [result, setResult] = useState(null);

  async function ping() {
    const res = await fetch("http://localhost:8000/ping");
    const data = await res.json();
    setResult(data);
  }

  return (
    <main style={{ padding: "2rem" }}>
      <button onClick={ping}>Ping backend</button>
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </main>
  );
}
