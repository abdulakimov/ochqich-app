"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [providerName, setProviderName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerName, apiKey })
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Login failed");
      return;
    }

    router.replace("/");
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Provider Login</CardTitle>
          <CardDescription>Login with provider name + API key.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="providerName">Provider Name</Label>
              <Input id="providerName" value={providerName} onChange={(e) => setProviderName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input id="apiKey" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} required />
            </div>
            {error ? <p className="text-sm text-red-500">{error}</p> : null}
            <Button className="w-full" type="submit">Login</Button>
            <p className="text-xs text-slate-500">Default key for fresh start: <code>demo-api-key</code></p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
