// Builds two SVG figures from results.json (no external libraries).
const fs = require("fs"), path = require("path");
const R = require("./results.json");
const out = path.join(__dirname, "..", "figures"); fs.mkdirSync(out, { recursive: true });
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

// 1) utilisation of each check (computed / allowable)
const rows = [
  ["Tooth root bending – pinion (Lewis)", R.bending.sigF1, R.bending.allow, "MPa"],
  ["Tooth root bending – gear (Lewis)", R.bending.sigF2, R.bending.allow, "MPa"],
  ["Flank contact stress (Hertz)", R.contact.sigH, R.contact.allow, "MPa"],
  ["Input shaft Ø20 – torsion τ/τ_zul", R.shafts.d_in_min ** 3, R.shafts.d_in ** 3, ""],
  ["Output shaft Ø25 – torsion τ/τ_zul", R.shafts.d_out_min ** 3, R.shafts.d_out ** 3, ""],
  ["Bearing 6204 – required / L10h", R.bearings.required, R.bearings.L10h_6204, "h"],
];
const W = 760, rowH = 46, top = 64, left = 300, barW = 400, H = top + rows.length * rowH + 40;
let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Segoe UI,Arial,sans-serif">
<rect width="${W}" height="${H}" fill="#ffffff"/>
<text x="20" y="30" font-size="18" font-weight="600" fill="#1d2733">Utilisation of each design check (computed ÷ permissible)</text>
<text x="20" y="50" font-size="12" fill="#5b6675">Values from design-calc.js · 1.5 kW, 1440 rpm, i = 3, K_A = 1.25 · 100 % = limit</text>`;
const x100 = left + barW * 0.8;
rows.forEach((r, i) => {
  const u = r[1] / r[2], y = top + i * rowH, w = Math.max(2, Math.min(u, 1.25) / 1.25 * barW);
  const col = u > 1 ? "#c0392b" : u > 0.7 ? "#e67e22" : "#2e86c1";
  s += `<text x="20" y="${y + 22}" font-size="13" fill="#1d2733">${esc(r[0])}</text>
<rect x="${left}" y="${y + 8}" width="${barW}" height="20" fill="#eef1f4"/>
<rect x="${left}" y="${y + 8}" width="${w}" height="20" fill="${col}"/>
<text x="${left + w + 6}" y="${y + 23}" font-size="12" fill="#1d2733">${(u * 100).toFixed(u < 0.1 ? 1 : 0)} %</text>`;
});
s += `<line x1="${x100}" y1="${top}" x2="${x100}" y2="${top + rows.length * rowH}" stroke="#c0392b" stroke-dasharray="4 3"/>
<text x="${x100 - 14}" y="${top + rows.length * rowH + 18}" font-size="12" fill="#c0392b">100 %</text></svg>`;
fs.writeFileSync(path.join(out, "fig_utilisation.svg"), s);

// 2) process plan: main machining time per operation
const ops = R.processPlan.ops, total = R.processPlan.th_total_min;
const H2 = 70 + ops.length * 40 + 40; let t = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H2}" font-family="Segoe UI,Arial,sans-serif">
<rect width="${W}" height="${H2}" fill="#ffffff"/>
<text x="20" y="30" font-size="18" font-weight="600" fill="#1d2733">Arbeitsplan Ritzelwelle – main machining time t_h per operation</text>
<text x="20" y="50" font-size="12" fill="#5b6675">t_h = L·i / (f·n), n = 1000·v_c/(π·d); hobbing t_h = (b+2·overrun)·z / (n_hob·f_a) · total ${total} min</text>`;
const max = Math.max(...ops.map(o => o.th_min));
ops.forEach((o, i) => {
  const y = 70 + i * 40, w = o.th_min / max * 300;
  t += `<text x="20" y="${y + 18}" font-size="12" fill="#1d2733">${i + 1}0 · ${esc(o.name.length > 46 ? o.name.slice(0, 45) + "…" : o.name)}</text>
<rect x="400" y="${y + 4}" width="${w}" height="20" fill="${o.machine.startsWith("CNC") ? "#2e86c1" : o.machine.startsWith("Wälz") ? "#e67e22" : "#27ae60"}"/>
<text x="${406 + w}" y="${y + 19}" font-size="12" fill="#1d2733">${o.th_min.toFixed(2)} min</text>`;
});
t += `<text x="400" y="${H2 - 12}" font-size="11" fill="#5b6675">■ blue: CNC lathe · ■ orange: gear hobbing · ■ green: machining centre</text></svg>`;
fs.writeFileSync(path.join(out, "fig_process_plan.svg"), t);
console.log("figures written");
