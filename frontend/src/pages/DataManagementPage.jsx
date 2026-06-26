import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/utils";

const EMPTY_RECORD = {
  date: "",
  daily_rmc_volume_m3: "",
  project_size: "",
  day_in_project: "",
  latitude: "",
  longitude: "",
  cement_kg_m3: "",
  aggregate_10mm_pct: "",
  aggregate_20mm_pct: "",
  agg_moisture_content_pct: "",
  water_binder_ratio: "",
  slump_mm: "",
  batching_time_min: "",
  transport_time_min: "",
  truck_capacity_m3: ""
};

const DataManagementPage = () => {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dataset, setDataset] = useState(null);
  const [recordForm, setRecordForm] = useState({ ...EMPTY_RECORD });
  const [editingId, setEditingId] = useState(null); // null = add mode, string = edit mode
  const [changeForm, setChangeForm] = useState({ currentPassword: "", newPassword: "" });
  const [resetForm, setResetForm] = useState({ email: "", newPassword: "" });
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const loadDataset = async () => {
    try {
      const response = await api.get("/data");
      setDataset(response.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load dataset");
    }
  };

  useEffect(() => {
    loadDataset();
  }, []);

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a CSV file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setError("");
      setMessage("");
      setIsUploading(true);
      setUploadProgress(0);

      const response = await api.post("/data/upload", formData, {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 90) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });
      
      setUploadProgress(100);
      setMessage(response.data.message);
      await loadDataset();

      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.message || "Upload failed");
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleChangeMyPassword = async () => {
    if (!changeForm.currentPassword || !changeForm.newPassword) {
      setPasswordError("Please provide current password and new password.");
      return;
    }

    try {
      setPasswordError("");
      setPasswordMessage("");

      const response = await api.post("/auth/change-password", changeForm);
      localStorage.setItem("token", response.data.token);
      setPasswordMessage("Your password has been changed successfully.");
      setChangeForm({ currentPassword: "", newPassword: "" });
    } catch (err) {
      setPasswordError(err.response?.data?.message || "Failed to change password");
    }
  };

  const handleResetUserPassword = async () => {
    if (!resetForm.email || !resetForm.newPassword) {
      setPasswordError("Please provide target email and new password.");
      return;
    }

    try {
      setPasswordError("");
      setPasswordMessage("");
      const response = await api.post("/auth/reset-password", resetForm);
      setPasswordMessage(`${response.data.message} (${response.data.resetUser.email})`);
      setResetForm({ email: "", newPassword: "" });
    } catch (err) {
      setPasswordError(err.response?.data?.message || "Failed to reset user password");
    }
  };

  const handleAddOrUpdateRecord = async () => {
    try {
      setError("");
      setMessage("");

      const missing = Object.entries(recordForm)
        .filter(([, value]) => value === "")
        .map(([key]) => key);

      if (missing.length) {
        setError(`Please fill all record fields. Missing: ${missing.join(", ")}`);
        return;
      }

      const payload = { ...recordForm };
      Object.keys(payload).forEach((key) => {
        if (key !== "date") {
          payload[key] = Number(payload[key]);
        }
      });

      if (editingId) {
        // UPDATE existing record
        await api.put(`/data/record/${editingId}`, payload);
        setMessage("Record updated successfully. Model retraining started.");
        setEditingId(null);
      } else {
        // ADD new record
        await api.post("/data/add-record", payload);
        setMessage("Daily record added. Model retrained using latest dataset.");
      }

      await loadDataset();
      setRecordForm({ ...EMPTY_RECORD });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save record");
    }
  };

  const handleEditRow = (row) => {
    setEditingId(row._id);
    setRecordForm({
      date: row.date ? new Date(row.date).toISOString().slice(0, 10) : "",
      daily_rmc_volume_m3: String(row.daily_rmc_volume_m3 ?? ""),
      project_size: String(row.project_size ?? ""),
      day_in_project: String(row.day_in_project ?? ""),
      latitude: String(row.latitude ?? ""),
      longitude: String(row.longitude ?? ""),
      cement_kg_m3: String(row.cement_kg_m3 ?? ""),
      aggregate_10mm_pct: String(row.aggregate_10mm_pct ?? ""),
      aggregate_20mm_pct: String(row.aggregate_20mm_pct ?? ""),
      agg_moisture_content_pct: String(row.agg_moisture_content_pct ?? ""),
      water_binder_ratio: String(row.water_binder_ratio ?? ""),
      slump_mm: String(row.slump_mm ?? ""),
      batching_time_min: String(row.batching_time_min ?? ""),
      transport_time_min: String(row.transport_time_min ?? ""),
      truck_capacity_m3: String(row.truck_capacity_m3 ?? "")
    });
    setMessage("");
    setError("");
    // Scroll to the form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setRecordForm({ ...EMPTY_RECORD });
    setMessage("");
    setError("");
  };

  const handleDeleteRow = async (id) => {
    if (!window.confirm("Are you sure you want to delete this record? This will also trigger model retraining.")) {
      return;
    }

    try {
      setError("");
      setMessage("");
      await api.delete(`/data/record/${id}`);
      setMessage("Record deleted. Model retraining started in background.");
      await loadDataset();

      // If we were editing this row, cancel the edit
      if (editingId === id) {
        handleCancelEdit();
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete record");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Password Management (JWT Secured)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-sm font-semibold">Change My Password</p>
            <div className="grid gap-2 md:grid-cols-2">
              <Input
                type="password"
                placeholder="Current password"
                value={changeForm.currentPassword}
                onChange={(e) => setChangeForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
              />
              <Input
                type="password"
                placeholder="New password (min 6 chars)"
                value={changeForm.newPassword}
                onChange={(e) => setChangeForm((prev) => ({ ...prev, newPassword: e.target.value }))}
              />
            </div>
            <Button onClick={handleChangeMyPassword}>Change Password</Button>
          </div>

          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-sm font-semibold">Reset User Password (Manager)</p>
            <div className="grid gap-2 md:grid-cols-2">
              <Input
                type="email"
                placeholder="User email"
                value={resetForm.email}
                onChange={(e) => setResetForm((prev) => ({ ...prev, email: e.target.value }))}
              />
              <Input
                type="password"
                placeholder="New password (min 6 chars)"
                value={resetForm.newPassword}
                onChange={(e) => setResetForm((prev) => ({ ...prev, newPassword: e.target.value }))}
              />
            </div>
            <Button onClick={handleResetUserPassword}>Reset User Password</Button>
          </div>

          {passwordMessage ? <p className="text-sm text-emerald-600">{passwordMessage}</p> : null}
          {passwordError ? <p className="text-sm text-red-500">{passwordError}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dataset Upload &amp; Training</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full text-sm" disabled={isUploading} />
          
          {isUploading && (
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300 ease-out" 
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}

          <Button onClick={handleUpload} disabled={isUploading || !file}>
            {isUploading ? `Uploading... ${uploadProgress}%` : "Upload CSV and Train Models"}
          </Button>
          
          {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
        </CardContent>
      </Card>

      <Card className={editingId ? "ring-2 ring-primary" : ""}>
        <CardHeader>
          <CardTitle>
            {editingId ? "✏️ Editing Record" : "Add New Daily Record (Auto Retrain)"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Object.keys(recordForm).map((key) => (
              <div key={key}>
                <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">{key}</p>
                <Input
                  type={key === "date" ? "date" : "number"}
                  value={recordForm[key]}
                  onChange={(e) => setRecordForm((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={handleAddOrUpdateRecord}>
              {editingId ? "Update Record + Retrain" : "Add Record + Retrain"}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={handleCancelEdit}>
                Cancel Edit
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {dataset?.stats ? (
        <Card>
          <CardHeader>
            <CardTitle>Current Dataset Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Total rows: {formatNumber(dataset.stats.totalRows, 0)}</p>
            <p>Start date: {new Date(dataset.stats.startDate).toLocaleDateString()}</p>
            <p>End date: {new Date(dataset.stats.endDate).toLocaleDateString()}</p>
            <p>Average demand: {formatNumber(dataset.stats.avgDemand)} m3</p>
            <p>Average cement ratio: {formatNumber(dataset.stats.avgCementKgM3)} kg/m3</p>
            <p>Average transport time: {formatNumber(dataset.stats.avgTransportTime)} min</p>
          </CardContent>
        </Card>
      ) : null}

      {dataset?.rows?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Latest 10 Rows Preview</CardTitle>
          </CardHeader>
          <CardContent className="overflow-auto">
            <table className="w-full text-xs md:text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2">Date</th>
                  <th className="py-2">Demand</th>
                  <th className="py-2">Project Size</th>
                  <th className="py-2">Cement kg/m3</th>
                  <th className="py-2">Transport min</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dataset.rows.slice(-10).map((row) => (
                  <tr
                    key={`${row._id}-${row.date}`}
                    className={`border-b border-border/70 ${editingId === row._id ? "bg-primary/10" : ""}`}
                  >
                    <td className="py-2">{new Date(row.date).toLocaleDateString()}</td>
                    <td className="py-2">{formatNumber(row.daily_rmc_volume_m3)}</td>
                    <td className="py-2">{formatNumber(row.project_size)}</td>
                    <td className="py-2">{formatNumber(row.cement_kg_m3)}</td>
                    <td className="py-2">{formatNumber(row.transport_time_min)}</td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEditRow(row)}
                          className="rounded px-2 py-1 text-xs font-semibold text-blue-500 hover:bg-blue-500/10 transition"
                          title="Edit this record"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDeleteRow(row._id)}
                          className="rounded px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-500/10 transition"
                          title="Delete this record"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};

export default DataManagementPage;
