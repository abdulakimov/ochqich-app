"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type WebhookLog = {
  id: string;
  event: string;
  payload: string;
  receivedAt: string;
  status: "received" | "processed" | "failed";
};

export default function WebhookLogsPage() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [eventName, setEventName] = useState("consent.updated");

  const load = async () => {
    const res = await fetch("/api/webhook-logs");
    const data = await res.json();
    setLogs(data);
  };

  useEffect(() => {
    void load();
  }, []);

  const sendSample = async (event: FormEvent) => {
    event.preventDefault();
    await fetch("/api/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: eventName, payload: { source: "dashboard", ts: Date.now() } })
    });
    void load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Send Test Webhook</CardTitle>
          <CardDescription>Create log entries for MVP testing.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex items-end gap-3" onSubmit={sendSample}>
            <div className="w-full space-y-2">
              <Label htmlFor="eventName">Event Name</Label>
              <Input id="eventName" value={eventName} onChange={(e) => setEventName(e.target.value)} />
            </div>
            <Button type="submit">Send</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhook Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payload</TableHead>
                <TableHead>Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-xs">{log.id}</TableCell>
                  <TableCell>{log.event}</TableCell>
                  <TableCell>{log.status}</TableCell>
                  <TableCell className="max-w-sm truncate font-mono text-xs">{log.payload}</TableCell>
                  <TableCell>{new Date(log.receivedAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
