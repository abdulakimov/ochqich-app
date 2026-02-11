"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function CreateConsentPage() {
  const [attributes, setAttributes] = useState("full_name,email,phone");
  const [message, setMessage] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const requestedAttributes = attributes
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const res = await fetch("/api/consents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestedAttributes })
    });

    if (res.ok) {
      setMessage("Consent request created.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Consent Request</CardTitle>
        <CardDescription>Input requested attributes as comma-separated values.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="attrs">Requested Attributes</Label>
            <Textarea id="attrs" value={attributes} onChange={(e) => setAttributes(e.target.value)} rows={5} required />
          </div>
          <Button type="submit">Create Request</Button>
          {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        </form>
      </CardContent>
    </Card>
  );
}
