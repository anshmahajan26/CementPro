import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const reportTypes = ["demand", "procurement", "emission"];
const formats = ["excel", "pdf"];

const ReportsPage = () => {
  const downloadReport = async (type, format) => {
    const response = await api.get(`/reports/${type}?format=${format}`, { responseType: "blob" });
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;

    const extension = format === "pdf" ? "pdf" : "xlsx";
    anchor.download = `${type}-report.${extension}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Reports & Analytics Export</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Export dataset-driven reports for demand, procurement, and emissions in Excel or PDF format.</p>
          {reportTypes.map((type) => (
            <div key={type} className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold capitalize">{type} report</p>
              <div className="flex gap-2">
                {formats.map((format) => (
                  <Button key={format} variant="outline" onClick={() => downloadReport(type, format)}>
                    Download {format.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsPage;
