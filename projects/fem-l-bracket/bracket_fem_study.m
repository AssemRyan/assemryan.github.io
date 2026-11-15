% FEM study of a steel L-bracket (2D plane stress) - MATLAB PDE Toolbox
% Assem Ryan, 2026. Units: mm, N, MPa (N/mm^2).
% 1) Validation: straight cantilever vs. Euler-Bernoulli / Timoshenko beam theory + mesh convergence
% 2) L-bracket: sharp inner corner (stress singularity) vs. fillet radius sweep
% 3) Lightweighting: fillet + three lightening holes on the neutral axis
clear; close all;
out = fileparts(mfilename('fullpath'));
figdir = fullfile(out, 'figures'); if ~exist(figdir, 'dir'), mkdir(figdir); end

E = 210000; nu = 0.3; G = E/(2*(1+nu));   % S235 steel
Re = 235;                                  % yield strength [MPa]
t = 10;                                    % plate thickness [mm]
rho = 7.85e-6;                             % density [kg/mm^3]
F = 1500;                                  % tip load [N], downward
h = 40;                                    % arm height [mm]

%% 1) Validation: straight cantilever L = 200 mm, h = 40 mm
L = 200; I = t*h^3/12; A = t*h;
dEB = F*L^3/(3*E*I);                       % bending deflection
dTim = dEB + F*L/((5/6)*G*A);              % + shear deflection
sMid = F*(L/2)/(t*h^2/6);                  % bending stress at mid-span, outer fibre
Hs = [10 5 2.5 1.25];
val = zeros(numel(Hs), 3);
for k = 1:numel(Hs)
    m = createpde('structural', 'static-planestress');
    g = decsg([3;4;0;L;L;0;0;0;h;h], 'R1', ('R1')');
    geometryFromEdges(m, g);
    setup(m, E, nu, nearestEdge(m.Geometry, [0 h/2]), nearestEdge(m.Geometry, [L h/2]), F/(h*t));
    generateMesh(m, 'Hmax', Hs(k), 'GeometricOrder', 'quadratic');
    R = solve(m);
    N = m.Mesh.Nodes;
    tip = -mean(R.Displacement.uy(N(1,:) > L - 1e-6));
    s = interpolateStress(R, L/2, h - 1e-3);
    val(k, :) = [Hs(k), tip, s.sxx];
end

%% 2) L-bracket: fillet sweep and sharp-corner singularity
radii = [2 4 6 8 10 15 20];
sweep = zeros(numel(radii), 4);
for k = 1:numel(radii)
    [m, res] = bracket(radii(k), false, 1.5, E, nu, F, t, rho);
    sweep(k, :) = [radii(k), res.peak, res.tip, res.mass];
end
Hc = [8 4 2 1];
conv = zeros(numel(Hc), 3);
for k = 1:numel(Hc)
    [~, a] = bracket(0, false, Hc(k), E, nu, F, t, rho);
    [~, b] = bracket(10, false, Hc(k), E, nu, F, t, rho);
    conv(k, :) = [Hc(k), a.peak, b.peak];
end

%% 3) Design variants for the summary
[mA, A0] = bracket(0,  false, 1.5, E, nu, F, t, rho);
[mB, B0] = bracket(10, false, 1.5, E, nu, F, t, rho);
[mC, C0] = bracket(10, true,  1.5, E, nu, F, t, rho);
[mD, D0] = bracket(20, true,  1.5, E, nu, F, t, rho, 45);
V = {'A: sharp inner corner', A0; 'B: fillet r = 10 mm', B0; 'C: r = 10 mm + 3 holes D16', C0; 'D: leg 45 mm, r = 20 mm + holes', D0};

%% Figures
f = figure('Visible', 'off', 'Position', [0 0 1100 420]);
subplot(1,2,1); semilogx(val(:,1), val(:,2), 'o-', 'LineWidth', 1.5); hold on;
yline(dEB, '--', 'Euler-Bernoulli'); yline(dTim, ':', 'Timoshenko', 'LineWidth', 1.5);
set(gca, 'XDir', 'reverse'); grid on; xlabel('max. element size H_{max} [mm]'); ylabel('tip deflection [mm]');
title('Validation: cantilever tip deflection');
subplot(1,2,2); semilogx(val(:,1), val(:,3), 's-', 'LineWidth', 1.5); hold on; yline(sMid, '--', 'beam theory M/W');
set(gca, 'XDir', 'reverse'); grid on; xlabel('max. element size H_{max} [mm]'); ylabel('\sigma_{xx} at mid-span, top fibre [MPa]');
title('Validation: bending stress');
exportgraphics(f, fullfile(figdir, 'fig1_validation.png'), 'Resolution', 150);

f = figure('Visible', 'off', 'Position', [0 0 1100 420]);
subplot(1,2,1); semilogx(conv(:,1), conv(:,2), 'o-', conv(:,1), conv(:,3), 's-', 'LineWidth', 1.5);
set(gca, 'XDir', 'reverse'); grid on; legend('sharp corner (r = 0)', 'fillet r = 10 mm', 'Location', 'northwest');
xlabel('max. element size H_{max} [mm]'); ylabel('peak von Mises stress [MPa]'); title('Mesh convergence at the inner corner');
subplot(1,2,2); plot(sweep(:,1), sweep(:,2), 'o-', 'LineWidth', 1.5); grid on; yline(Re/1.5, '--', 'R_e / 1.5');
xlabel('inner fillet radius r [mm]'); ylabel('peak von Mises stress [MPa]'); title('Fillet radius sweep (H_{max} = 1.5 mm)');
exportgraphics(f, fullfile(figdir, 'fig2_fillet_convergence.png'), 'Resolution', 150);

ms = {mA, mB, mC, mD};
f = figure('Visible', 'off', 'Position', [0 0 1500 900]);
for k = 1:4
    subplot(2,2,k);
    Rk = V{k,2}.R;
    pdeplot(ms{k}, 'XYData', Rk.VonMisesStress, 'ColorMap', 'jet', 'Mesh', 'off');
    clim([0 max(A0.peak, 160)]); axis equal tight;
    title(sprintf('%s\npeak %.0f MPa | tip %.3f mm | %.2f kg', V{k,1}, V{k,2}.peak, V{k,2}.tip, V{k,2}.mass));
end
exportgraphics(f, fullfile(figdir, 'fig3_variants_vonmises.png'), 'Resolution', 150);

%% Results file
S.validation = struct('Hmax', val(:,1)', 'tip_mm', val(:,2)', 'sxx_mid_MPa', val(:,3)', ...
    'tip_EulerBernoulli_mm', dEB, 'tip_Timoshenko_mm', dTim, 'sxx_beam_MPa', sMid);
S.fillet_sweep = struct('r_mm', sweep(:,1)', 'peak_vonMises_MPa', sweep(:,2)', 'tip_mm', sweep(:,3)', 'mass_kg', sweep(:,4)');
S.corner_convergence = struct('Hmax', conv(:,1)', 'sharp_peak_MPa', conv(:,2)', 'r10_peak_MPa', conv(:,3)');
for k = 1:4
    S.variants(k) = struct('name', V{k,1}, 'peak_vonMises_MPa', V{k,2}.peak, 'tip_mm', V{k,2}.tip, ...
        'mass_kg', V{k,2}.mass, 'safety_vs_yield', Re/V{k,2}.peak);
end
S.inputs = struct('E_MPa', E, 'nu', nu, 'Re_MPa', Re, 'thickness_mm', t, 'F_N', F, 'mesh', 'quadratic triangles (PDE Toolbox)');
fid = fopen(fullfile(out, 'results.json'), 'w'); fprintf(fid, '%s', jsonencode(S, 'PrettyPrint', true)); fclose(fid);
disp(jsonencode(S));

%% ---- local functions ----
function setup(m, E, nu, eFix, eLoad, q)
structuralProperties(m, 'YoungsModulus', E, 'PoissonsRatio', nu);
structuralBC(m, 'Edge', eFix, 'Constraint', 'fixed');
structuralBoundaryLoad(m, 'Edge', eLoad, 'SurfaceTraction', [0; -q]);
end

function [m, res] = bracket(r, holes, H, E, nu, F, t, rho, w)
if nargin < 9, w = 25; end
% L-bracket: wall leg w x 160 mm (default w = 25) (fixed at x = 0), arm 200 x 40 mm (y = 120..160), load at x = 200
gd = [[3;4;0;w;w;0;0;0;160;160], [3;4;0;200;200;0;120;120;160;160]];
ns = ['R1'; 'R2']; sf = 'R1+R2';
if r > 0
    gd = [gd, [3;4;w;w+r;w+r;w;120-r;120-r;120;120], [1;w+r;120-r;r;0;0;0;0;0;0]];
    ns = [ns; 'R3'; 'C1']; sf = '(R1+R2+R3)-C1';
end
if holes
    xs = [80 120 160];
    for i = 1:3
        gd = [gd, [1; xs(i); 140; 8; 0;0;0;0;0;0]]; %#ok<AGROW>
        ns = [ns; sprintf('H%d', i)]; %#ok<AGROW>
    end
    sf = ['(' sf ')-H1-H2-H3'];
end
g = decsg(gd, sf, ns');
m = createpde('structural', 'static-planestress');
geometryFromEdges(m, g);
setup(m, E, nu, nearestEdge(m.Geometry, [0 80]), nearestEdge(m.Geometry, [200 140]), F/(40*t));
generateMesh(m, 'Hmax', H, 'GeometricOrder', 'quadratic');
R = solve(m);
N = m.Mesh.Nodes; vm = R.VonMisesStress;
mask = N(1,:) > 5;                       % exclude the clamped wall edge (artificial singularity of the ideal clamp)
res.peak = max(vm(mask));
res.tip = -mean(R.Displacement.uy(N(1,:) > 200 - 1e-6));
res.mass = area(m.Mesh) * t * rho;
res.R = R;
end
