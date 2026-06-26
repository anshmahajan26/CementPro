import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { GoogleLogin } from "@react-oauth/google";

const RegisterPage = () => {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "Operator", plantName: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [googleToken, setGoogleToken] = useState("");
  const [pendingGoogleData, setPendingGoogleData] = useState(null);
  const [selectedRole, setSelectedRole] = useState("Operator");
  const [googlePlantName, setGooglePlantName] = useState("");

  const { register, googleLogin, googleRegister } = useAuth();
  const navigate = useNavigate();

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setLoading(true);
      setError("");
      const res = await googleLogin(credentialResponse.credential);
      if (res?.requireRole) {
        setGoogleToken(credentialResponse.credential);
        setPendingGoogleData({ email: res.email, name: res.name });
      } else {
        navigate("/");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Google Auth failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRoleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await googleRegister(googleToken, selectedRole, googlePlantName);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Google Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await register(form);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center p-4 md:p-8">
      <Card className="w-full max-w-5xl overflow-hidden">
        <div className="grid md:grid-cols-2">
          <div className="relative hidden bg-gradient-to-br from-fuchsia-500/75 via-violet-500/65 to-sky-500/70 p-8 text-white md:block">
            <p className="font-heading text-3xl">Join Smart RMC</p>
            <p className="mt-2 text-sm opacity-90">Build a smarter, cleaner, and faster forecasting workflow for your plant.</p>
            <div className="absolute bottom-6 left-8 right-8 rounded-xl bg-white/20 p-4 text-sm backdrop-blur-md">
              Role-based JWT access with modern analytics workspace.
            </div>
          </div>

          <div className="p-6 md:p-8">
            <CardHeader className="p-0">
              <CardTitle>Create Account</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pt-5">
              {pendingGoogleData ? (
                <form className="space-y-3" onSubmit={handleGoogleRoleSubmit}>
                  <p className="text-sm">Hi {pendingGoogleData.name}, please select a role to complete your registration.</p>
                  <select
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                  >
                    <option>Manager</option>
                    <option>Operator</option>
                  </select>
                  <Input 
                    placeholder="RMC Plant Name" 
                    value={googlePlantName} 
                    onChange={(e) => setGooglePlantName(e.target.value)} 
                    required 
                  />
                  {error ? <p className="text-sm text-red-500">{error}</p> : null}
                  <Button className="w-full" type="submit" disabled={loading}>
                    {loading ? "Completing..." : "Complete"}
                  </Button>
                  <Button variant="outline" className="w-full" type="button" onClick={() => setPendingGoogleData(null)}>
                    Cancel
                  </Button>
                </form>
              ) : (
                <form className="space-y-3" onSubmit={handleSubmit}>
                  <Input placeholder="Name" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required />
                  <Input
                    type="email"
                    placeholder="Email"
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    required
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={form.password}
                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                    required
                  />
                  <select
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    value={form.role}
                    onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                  >
                    <option>Manager</option>
                    <option>Operator</option>
                  </select>
                  <Input 
                    placeholder="RMC Plant Name" 
                    value={form.plantName} 
                    onChange={(e) => setForm((prev) => ({ ...prev, plantName: e.target.value }))} 
                    required 
                  />
                  {error ? <p className="text-sm text-red-500">{error}</p> : null}
                  <Button className="w-full" type="submit" disabled={loading}>
                    {loading ? "Creating..." : "Register"}
                  </Button>

                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border"></span></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">Or</span></div>
                  </div>

                  <div className="flex justify-center">
                    <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError("Google Auth Failed")} />
                  </div>
                </form>
              )}
              <p className="mt-4 text-sm text-muted-foreground">
                Already registered? <Link className="font-semibold text-primary" to="/login">Login</Link>
              </p>
            </CardContent>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default RegisterPage;
