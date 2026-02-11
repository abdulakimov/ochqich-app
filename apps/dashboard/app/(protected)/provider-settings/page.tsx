"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Settings = {
  name: string;
  redirectUri: string;
  webhookUrl: string;
  apiKey: string;
  updatedAt: string;
};

export default function ProviderSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [message, setMessage] = useState("");

  const load = async () => {
    const res = await fetch("/api/provider-settings");
    const data = await res.json();
    setSettings(data);
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!settings) return;

    const res = await fetch("/api/provider-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings)
    });
    if (res.ok) {
      setMessage("Saved.");
      void load();
    }
  };

  const rotateApiKey = async () => {
    const res = await fetch("/api/provider-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rotateApiKey: true })
    });

    if (res.ok) {
      setMessage("API key rotated.");
      void load();
    }
  };

  if (!settings) return <p>Loading...</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Provider Settings</CardTitle>
        <CardDescription>Manage name, redirect URL, webhook URL, and API key.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={save}>
          <div className="space-y-2">
            <Label htmlFor="name">Provider Name</Label>
            <Input id="name" value={settings.name} onChange={(e) => setSettings({ ...settings, name: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="redirectUri">Redirect URI</Label>
            <Input id="redirectUri" value={settings.redirectUri} onChange={(e) => setSettings({ ...settings, redirectUri: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="webhookUrl">Webhook URL</Label>
            <Input id="webhookUrl" value={settings.webhookUrl} onChange={(e) => setSettings({ ...settings, webhookUrl: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apiKey">Current API Key</Label>
            <Input id="apiKey" value={settings.apiKey} disabled />
          </div>
          <div className="flex gap-3">
            <Button type="submit">Save Settings</Button>
            <Button onClick={rotateApiKey} type="button" variant="secondary">Rotate API Key</Button>
          </div>
          {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        </form>
      </CardContent>
    </Card>
  );
}
