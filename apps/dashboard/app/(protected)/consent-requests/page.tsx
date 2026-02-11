"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Consent = {
  id: string;
  requestedAttributes: string[];
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

const variantByStatus = {
  pending: "warning",
  approved: "success",
  rejected: "danger"
} as const;

export default function ConsentRequestListPage() {
  const [items, setItems] = useState<Consent[]>([]);

  const load = async () => {
    const res = await fetch("/api/consents");
    const data = await res.json();
    setItems(data);
  };

  useEffect(() => {
    void load();
  }, []);

  const updateStatus = async (id: string, status: Consent["status"]) => {
    await fetch(`/api/consents/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    void load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consent Requests</CardTitle>
        <CardDescription>View and update consent status.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Attributes</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-xs">{item.id}</TableCell>
                <TableCell>{item.requestedAttributes.join(", ")}</TableCell>
                <TableCell>
                  <Badge variant={variantByStatus[item.status]}>{item.status}</Badge>
                </TableCell>
                <TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell>
                <TableCell className="space-x-2">
                  <Button onClick={() => updateStatus(item.id, "approved")} size="sm" variant="secondary" type="button">Approve</Button>
                  <Button onClick={() => updateStatus(item.id, "rejected")} size="sm" variant="destructive" type="button">Reject</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
