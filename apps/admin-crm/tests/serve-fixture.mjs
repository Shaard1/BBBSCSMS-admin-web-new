// Isolated QA service. Next's service configuration is overridden with loopback fixtures.
import http from "node:http";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
const require = createRequire(import.meta.url);
const adminId = "00000000-0000-4000-8000-000000000001";
const staffId = "00000000-0000-4000-8000-000000000002";
const year = new Date().getFullYear();
const residentId = (i) =>
  `10000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const photo = "http://127.0.0.1:3218/evidence.svg";
let tables;
function reset() {
  tables = {
    profiles: [
      {
        id: adminId,
        full_name: "Alex Reyes",
        email: "admin@example.test",
        role: "admin",
        status: "approved",
      },
      {
        id: staffId,
        full_name: "Jamie Santos",
        email: "staff@example.test",
        role: "staff",
        status: "active",
      },
    ],
    residents: [
      "Maria Santos",
      "Jose Reyes",
      "Ana Cruz",
      "Paolo Dela Cruz",
    ].map((name, i) => ({
      id: residentId(i + 1),
      user_id: residentId(i + 1),
      full_name: name,
      email: `resident${i}@example.test`,
      status: ["pending", "pending", "approved", "rejected"][i],
      address: "Purok 3, Bancao-Bancao",
      contact_number: "09000000000",
      created_at: `${year}-0${i + 1}-12T08:00:00Z`,
      id_type: "Philippine National ID",
      id_image_front: photo,
      id_image_back: photo,
      profile_image: photo,
      gender: "Not specified",
      rejection_reason: i === 3 ? "Please upload a clearer ID." : null,
    })),
    reports: [
      "Road surface damaged near the community center",
      "Missed garbage collection in Purok 3",
      "Streetlight is not working on the main road",
      "Drainage blocked after heavy rain",
      "Noise concern near the basketball court",
    ].map((description, i) => ({
      id: `20000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
      user_id: residentId((i % 4) + 1),
      description,
      category: [
        "Road Damage",
        "Garbage Collection",
        "Broken Streetlight",
        "Drainage Issue",
        "Noise Complaint",
      ][i],
      status: ["pending", "in progress", "pending", "resolved", "resolved"][i],
      latitude: i === 4 ? 999 : 9.7392 + i * 0.0015,
      longitude: 118.7353 + i * 0.001,
      created_at: `${i === 4 ? year - 1 : year}-0${(i % 4) + 1}-15T08:00:00Z`,
      image_url: photo,
      admin_note: i === 1 ? "Team assigned for follow-up." : "",
    })),
    document_requests: [
      "Barangay Clearance",
      "Certificate of Residency",
      "Certificate of Indigency",
    ].map((certificate_title, i) => ({
      id: `30000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
      resident_name: ["Maria Santos", "Jose Reyes", "Ana Cruz"][i],
      certificate_title,
      certificate_key: "clearance",
      status: ["pending", "processing", "ready_for_release"][i],
      created_at: `${year}-03-11T08:00:00Z`,
      purpose: "Employment requirements",
      address: "Purok 3, Bancao-Bancao",
      contact_number: "09000000000",
      payment_method: "Cash",
      fee_label: "₱50.00",
      form_data: { purpose: "Employment", civil_status: "Single" },
    })),
    announcements: [
      {
        id: "40000000-0000-4000-8000-000000000001",
        title: "Community clean-up this Saturday",
        content:
          "<p>Join your neighbors for a cleaner, healthier barangay. Meet at the community hall at 7 AM.</p>",
        is_published: true,
        thumbnail_url: photo,
        created_by: adminId,
        created_at: `${year}-03-12T08:00:00Z`,
      },
      {
        id: "40000000-0000-4000-8000-000000000002",
        title: "Free health check-up at the barangay hall",
        content: "<p>Registration opens next week. Bring a valid ID.</p>",
        is_published: false,
        created_by: staffId,
        created_at: `${year}-03-11T08:00:00Z`,
      },
    ],
  };
}
reset();
const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3217");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "authorization, apikey, content-type, x-client-info, prefer, range, x-supabase-api-version",
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PATCH,DELETE,HEAD,OPTIONS",
  );
  res.setHeader("Access-Control-Expose-Headers", "content-range");
  const url = new URL(req.url, "http://127.0.0.1:3218");
  const json = (data, status = 200) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(req.method === "HEAD" ? undefined : JSON.stringify(data));
  };
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (url.pathname === "/__reset" && req.method === "POST") {
    reset();
    return json({ ok: true });
  }
  if (url.pathname === "/evidence.svg") {
    res.writeHead(200, { "Content-Type": "image/svg+xml" });
    return res.end(
      '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="460" viewBox="0 0 800 460"><rect width="800" height="460" fill="#dfe9e6"/><path d="M0 300L270 150L480 280L700 110L800 190V460H0Z" fill="#93b4a3"/><path d="M0 460L320 220H400L620 460Z" fill="#c6cfd3"/><rect x="90" y="180" width="145" height="110" rx="5" fill="#f9fbf9"/><path d="M70 180L165 110L255 180Z" fill="#557d7b"/><text x="24" y="430" fill="#25423e" font-family="Arial" font-size="20">SYNTHETIC QA IMAGE · NO REAL RESIDENT DATA</text></svg>',
    );
  }
  let body = {};
  try {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    if (raw) body = JSON.parse(raw);
  } catch {
    return json({ message: "Invalid fixture JSON" }, 400);
  }
  const roleFromToken = req.headers.authorization?.includes("fixture-staff")
    ? "staff"
    : "admin";
  const user = (role) => ({
    id: role === "staff" ? staffId : adminId,
    email: role + "@example.test",
    aud: "authenticated",
    role: "authenticated",
    user_metadata: {
      full_name: role === "staff" ? "Jamie Santos" : "Alex Reyes",
    },
    app_metadata: {},
    created_at: "2025-01-01T00:00:00Z",
  });
  if (url.pathname === "/auth/v1/token") {
    const role = String(body.email).startsWith("staff") ? "staff" : "admin";
    return json({
      access_token: "fixture-" + role,
      refresh_token: "fixture-refresh",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: "bearer",
      user: user(role),
    });
  }
  if (url.pathname === "/auth/v1/user") return json(user(roleFromToken));
  if (url.pathname.startsWith("/auth/v1/admin/users/"))
    return json({
      user: user(url.pathname.endsWith(staffId) ? "staff" : "admin"),
    });
  if (url.pathname === "/auth/v1/logout") return json({});
  if (url.pathname === "/auth/v1/admin/users" && req.method === "POST") {
    const u = {
      ...user("staff"),
      id: randomUUID(),
      email: body.email,
      user_metadata: body.user_metadata ?? {},
    };
    return json(u);
  }
  const name = url.pathname.split("/").pop();
  if (!url.pathname.startsWith("/rest/v1/") || !tables[name])
    return json({ message: "Unknown fixture route" }, 404);
  const matches = (record) => {
    for (const [key, value] of url.searchParams) {
      if (["select", "order", "limit", "offset", "or"].includes(key)) continue;
      if (value.startsWith("eq.") && String(record[key]) !== value.slice(3))
        return false;
      if (
        value.startsWith("in.(") &&
        !value.slice(4, -1).split(",").includes(String(record[key]))
      )
        return false;
    }
    return true;
  };
  let rows = tables[name].filter(matches);
  if (req.method === "PATCH") {
    rows.forEach((row) => Object.assign(row, body));
  }
  if (req.method === "DELETE")
    tables[name] = tables[name].filter((row) => !matches(row));
  if (req.method === "POST") {
    rows = (Array.isArray(body) ? body : [body]).map((row) => ({
      id: randomUUID(),
      created_at: new Date().toISOString(),
      ...row,
    }));
    for (const row of rows) {
      const existing = tables[name].find((r) => r.id === row.id);
      if (existing) Object.assign(existing, row);
      else tables[name].push(row);
    }
  }
  if (req.method === "GET" || req.method === "HEAD") {
    const order = url.searchParams.get("order");
    if (order) {
      const [field, direction] = order.split(".");
      rows.sort(
        (a, b) =>
          String(a[field]).localeCompare(String(b[field])) *
          (direction === "desc" ? -1 : 1),
      );
    }
  }
  res.setHeader(
    "Content-Range",
    `0-${Math.max(0, rows.length - 1)}/${rows.length}`,
  );
  if (url.searchParams.has("limit"))
    rows = rows.slice(0, Number(url.searchParams.get("limit")));
  if (req.headers.accept?.includes("application/vnd.pgrst.object+json"))
    return json(rows[0] ?? null);
  json(rows);
});
server.listen(3218, "127.0.0.1", () =>
  console.log("Synthetic fixture service ready on loopback:3218"),
);
const env = {
  ...process.env,
  NEXT_BUILD_DIR: ".next-qa",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3218",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-public-not-a-real-key",
  SUPABASE_SERVICE_ROLE_KEY: "fixture-service-not-a-real-key",
  ADMIN_SESSION_SECRET: "fixture-only-session-secret-not-for-production-2026",
  NEXT_PUBLIC_SUPABASE_ANNOUNCEMENT_BUCKET: "fixture",
  NEXT_TELEMETRY_DISABLED: "1",
};
const nextBin = require.resolve("next/dist/bin/next");
let child = spawn(
  process.execPath,
  process.env.QA_SKIP_BUILD === "1"
    ? ["-e", "process.exit(0)"]
    : [nextBin, "build"],
  { env, stdio: "inherit" },
);
child.on("exit", (code) => {
  if (code) {
    server.close();
    process.exit(code);
  }
  child = spawn(
    process.execPath,
    [nextBin, "start", "--hostname", "127.0.0.1", "--port", "3217"],
    { env, stdio: "inherit" },
  );
  child.on("exit", () => {
    server.close();
  });
});
function cleanup() {
  child?.kill();
  server.close();
}
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
