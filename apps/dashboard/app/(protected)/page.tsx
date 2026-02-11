import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardHomePage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Provider Dashboard</CardTitle>
        <CardDescription>Consent flow, provider config, and webhook monitoring in one place.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Configure provider details and rotate API keys.</li>
          <li>Create consent requests by requested attributes.</li>
          <li>Track consent statuses from the list view.</li>
          <li>Inspect incoming webhook logs.</li>
        </ul>
      </CardContent>
    </Card>
  );
}
