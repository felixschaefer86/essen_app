"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../src/lib/supabase"; // Pfad ggf. anpassen auf ../src/lib/supabase

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg("Falsche E-Mail oder Passwort!");
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-100">
        <h1 className="text-2xl font-bold text-slate-800 text-center mb-2">
          Familien-Speiseplan 🍕
        </h1>
        <p className="text-slate-500 text-center text-sm mb-6">
          Bitte melde dich an, um fortzufahren.
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              E-Mail-Adresse
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-green-500 text-slate-800"
              placeholder="familie@beispiel.de"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Passwort
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-green-500 text-slate-800"
              placeholder="••••••••"
            />
          </div>

          {errorMsg && (
            <p className="text-red-500 text-xs font-medium text-center">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white font-medium p-3 rounded-xl transition-colors"
          >
            {loading ? "Melde an..." : "Anmelden"}
          </button>
        </form>
      </div>
    </main>
  );
}