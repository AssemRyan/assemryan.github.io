// Preliminary design of a single-stage spur gear reducer (Vorauslegung).
// Methods: Lewis bending (with Barth dynamic factor), Hertz contact stress (simplified ISO 6336 form),
// torsion-based shaft sizing, ISO 281 basic bearing life, cutting-time estimate for the process plan.
// All inputs are design assumptions (stated below); outputs are computed, not typed.
const fs = require("fs"), path = require("path");
const r = (x, n = 2) => Math.round(x * 10 ** n) / 10 ** n;
const deg = Math.PI / 180;

// ---------- Requirements / assumptions ----------
const IN = {
  P_kW: 1.5,          // IEC 4-pole motor 1.5 kW
  n1: 1440,           // rpm
  i: 3,               // ratio
  KA: 1.25,           // application factor: uniform motor, moderate shocks (conveyor)
  eta: 0.98,          // mesh efficiency, one spur stage
  m: 2,               // module mm
  z1: 20, z2: 60,     // tooth numbers -> no undercut (z1 >= 17)
  alpha: 20,          // pressure angle deg
  b: 20,              // face width mm (b/m = 10)
  E: 210000, nu: 0.3, // steel
  // 42CrMo4 QT (pinion+gear), conservative permissible values for a preliminary check
  sigF_allow: 250,    // MPa bending (≈ σFlim/SF with σFlim≈ 340..400, SF≈1.4..1.6)
  sigH_allow: 650,    // MPa contact (≈ σHlim/SH with σHlim≈ 700..770, SH≈1.1..1.2)
  tau_allow: 25,      // MPa torsion only (allowance for bending/notches in preliminary sizing)
  C_6204: 13.5, C_6205: 14.8, // kN dynamic load ratings (SKF catalogue, deep groove ball bearings)
  life_req_h: 20000,
};

// ---------- Kinematics ----------
const n2 = IN.n1 / IN.i;
const T1 = 9550 * IN.P_kW / IN.n1;                 // Nm
const T2 = T1 * IN.i * IN.eta;
// ---------- Geometry ----------
const d1 = IN.m * IN.z1, d2 = IN.m * IN.z2, a = (d1 + d2) / 2;
const da1 = d1 + 2 * IN.m, da2 = d2 + 2 * IN.m, df1 = d1 - 2.5 * IN.m, df2 = d2 - 2.5 * IN.m;
const db1 = d1 * Math.cos(IN.alpha * deg), db2 = d2 * Math.cos(IN.alpha * deg);
const pb = Math.PI * IN.m * Math.cos(IN.alpha * deg);
// transverse contact ratio
const ga = 0.5 * (Math.sqrt(da1 ** 2 - db1 ** 2) + Math.sqrt(da2 ** 2 - db2 ** 2)) - a * Math.sin(IN.alpha * deg);
const eps = ga / pb;
// ---------- Forces ----------
const Ft = 2000 * T1 / d1;                          // N
const Fr = Ft * Math.tan(IN.alpha * deg);
const Fn = Ft / Math.cos(IN.alpha * deg);
const v = Math.PI * d1 * IN.n1 / 60000;            // m/s
const Kv = (6.1 + v) / 6.1;                         // Barth (cut/milled profile)
// ---------- Bending (Lewis) ----------
// Lewis form factor Y (module-based, 20° full depth) — tabulated: z=20 0.322, z=60 0.422 (Shigley Table 14-2)
const Y1 = 0.322, Y2 = 0.422;
const sigF1 = IN.KA * Kv * Ft / (IN.b * IN.m * Y1);
const sigF2 = IN.KA * Kv * Ft / (IN.b * IN.m * Y2);
// ---------- Contact (Hertz) ----------
const u = IN.z2 / IN.z1;
const ZE = Math.sqrt(1 / (Math.PI * 2 * (1 - IN.nu ** 2) / IN.E));      // √MPa (same material)
const ZH = Math.sqrt(2 / (Math.sin(IN.alpha * deg) * Math.cos(IN.alpha * deg)));
const Zeps = Math.sqrt((4 - eps) / 3);
const sigH = ZE * ZH * Zeps * Math.sqrt(IN.KA * Kv * Ft / (IN.b * d1) * (u + 1) / u);
// ---------- Shafts (torsion) ----------
const dmin = (T) => Math.cbrt(16 * T * 1000 / (Math.PI * IN.tau_allow));
const d_in_min = dmin(T1), d_out_min = dmin(T2);
const d_in = 20, d_out = 25;   // chosen bearing seats (6204 / 6205)
// ---------- Bearings (gear centred between bearings -> each takes Fn/2) ----------
const P = Fn / 2 / 1000; // kN, pure radial
const L10h = (C, n) => (C / P) ** 3 * 1e6 / (60 * n);
const L_in = L10h(IN.C_6204, IN.n1), L_out = L10h(IN.C_6205, n2);

// ---------- Process plan (Arbeitsplan) for the pinion shaft: machining-time estimate ----------
// Raw part: Ø50 x 140 bar, 42CrMo4 QT. t_h = L / (f * n), n = 1000*vc/(π d)
const op = (name, machine, d, L, vc, f, passes = 1, note = "") => {
  const n = 1000 * vc / (Math.PI * d);
  return { name, machine, d, L, vc, f, passes, n: Math.round(n), th_min: r(passes * L / (f * n), 2), note };
};
const ops = [
  op("Plandrehen + Zentrieren beidseitig (Länge 104)", "CNC-Drehmaschine", 50, 25 * 2, 180, 0.2, 1, "radial facing 2 x 25 mm"),
  op("Schruppen Ø50 → Ø44.5 (gesamte Länge)", "CNC-Drehmaschine", 50, 104, 180, 0.3, 1, "ap = 2.75 mm"),
  op("Schruppen Absätze Ø44.5 → Ø18.5–24.5", "CNC-Drehmaschine", 44.5, 84, 180, 0.3, 5, "ap ≈ 2.6 mm/pass, both sides of the gear"),
  op("Schlichten Kopfkreis Ø44 h11, Absätze Ø24, Lagersitze Ø20 k6, Zapfen Ø18 k6", "CNC-Drehmaschine", 24, 104, 220, 0.1, 1, "finishing contour"),
  op("Wälzfräsen Verzahnung m=2, z=20", "Wälzfräsmaschine", 44, 20 + 2 * 10, 0, 0, 1, "special formula"),
  op("Passfedernut 6x3.5 im Zapfen Ø18 fräsen", "Bearbeitungszentrum", 6, 28, 60, 0.03, 2, "fz·z = 0.03 mm/rev, 2 passes"),
];
// hobbing time: t = (b + 2·overrun) · z / (n_hob · f_a · g)   (single-start hob g=1)
{
  const hob = ops[4]; const d_hob = 63, vc = 80, fa = 1.5, z = IN.z1;
  const n_hob = 1000 * vc / (Math.PI * d_hob);
  hob.vc = vc; hob.f = fa; hob.n = Math.round(n_hob); hob.th_min = r(hob.L * z / (n_hob * fa), 2);
  hob.note = "Wälzfräser Ø63, eingängig, axialer Vorschub 1.5 mm/WU";
}
// keyway: feed per minute vf = fz*z*n
{
  const k = ops[5]; const n = 1000 * k.vc / (Math.PI * 6); const vf = 0.03 * 3 * n; // 3-flute end mill
  k.n = Math.round(n); k.th_min = r(k.passes * k.L / vf, 2); k.note = "VHM-Fräser Ø6, z=3, fz=0.03";
}
const th_total = r(ops.reduce((s, o) => s + o.th_min, 0), 2);

const out = {
  inputs: IN,
  kinematics: { n1: IN.n1, n2: r(n2, 1), T1: r(T1), T2: r(T2) },
  geometry: { d1, d2, a, da1, da2, df1, df2, db1: r(db1), db2: r(db2), contactRatio: r(eps, 3) },
  forces: { Ft: r(Ft, 1), Fr: r(Fr, 1), Fn: r(Fn, 1), v: r(v), Kv: r(Kv, 3) },
  bending: { sigF1: r(sigF1, 1), sigF2: r(sigF2, 1), allow: IN.sigF_allow, SF1: r(IN.sigF_allow / sigF1), SF2: r(IN.sigF_allow / sigF2) },
  contact: { ZE: r(ZE, 1), ZH: r(ZH, 3), Zeps: r(Zeps, 3), sigH: r(sigH, 1), allow: IN.sigH_allow, SH: r(IN.sigH_allow / sigH) },
  shafts: { d_in_min: r(d_in_min, 1), d_out_min: r(d_out_min, 1), d_in, d_out },
  bearings: { P_kN: r(P, 3), L10h_6204: Math.round(L_in), L10h_6205: Math.round(L_out), required: IN.life_req_h },
  processPlan: { part: "Ritzelwelle (pinion shaft) z=20, m=2, 42CrMo4+QT, Rohteil Ø50x110 (vergütet geliefert)", ops, th_total_min: th_total },
  checks: {
    noUndercut: IN.z1 >= 17, contactRatioOK: eps >= 1.2, bendingOK: sigF1 <= IN.sigF_allow && sigF2 <= IN.sigF_allow,
    contactOK: sigH <= IN.sigH_allow, shaftOK: d_in >= d_in_min && d_out >= d_out_min,
    bearingOK: L_in >= IN.life_req_h && L_out >= IN.life_req_h,
  },
};
fs.writeFileSync(path.join(__dirname, "results.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ kin: out.kinematics, geo: out.geometry, forces: out.forces, bending: out.bending, contact: out.contact, shafts: out.shafts, bearings: out.bearings, th: th_total, checks: out.checks }, null, 1));
