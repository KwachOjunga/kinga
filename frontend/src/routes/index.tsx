import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kinga Situation Room · Eastern Africa Operational View" },
      {
        name: "description",
        content:
          "Kinga Situation Room — anticipatory-action cockpit monitoring drought, flood and last-mile community alerts across Eastern Africa.",
      },
      { property: "og:title", content: "Kinga Situation Room" },
      {
        property: "og:description",
        content:
          "Unified control center for early-warning triggers, mesh-network dispatch and last-mile USSD acknowledgement.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SituationRoom,
});

type NodeStatus = "dormant" | "armed" | "critical" | "confirmed";

interface RegionNode {
  id: string;
  label: string;
  area: string;
  hazard: "DROUGHT" | "FLOOD";
  lat: number; // -1..1 grid coord
  lon: number; // -1..1 grid coord
  status: NodeStatus;
  soilMoisture: number; // %
  rainfallMm: number;
  lagHours: number;
  threshold: number;
  rationale: string;
  probability: number; // 0..1
}

interface TimelineEvent {
  t: number;
  label: string;
  stage: "ingest" | "armed" | "trigger" | "mesh" | "inst_ack" | "comm_ack";
}

const INITIAL_NODES: RegionNode[] = [
  {
    id: "KE-MSB-DROUGHT-01",
    label: "Marsabit",
    area: "Kenya · Marsabit",
    hazard: "DROUGHT",
    lat: 0.35,
    lon: -0.15,
    status: "armed",
    soilMoisture: 14,
    rainfallMm: 2.1,
    lagHours: 4,
    threshold: 18,
    rationale: "3 of the last 4 weeks below-normal rainfall (CHIRPS SPI-4 = -1.6).",
    probability: 0.72,
  },
  {
    id: "SO-GED-FLOOD-04",
    label: "Gedo",
    area: "Somalia · Gedo",
    hazard: "FLOOD",
    lat: 0.55,
    lon: 0.55,
    status: "armed",
    soilMoisture: 62,
    rainfallMm: 41.8,
    lagHours: 2,
    threshold: 35,
    rationale: "Juba river gauge rising 4.2cm/hr, upstream cell cluster > 30mm/3h.",
    probability: 0.58,
  },
  {
    id: "ET-SOM-DROUGHT-02",
    label: "Somali Region",
    area: "Ethiopia · Dollo",
    hazard: "DROUGHT",
    lat: 0.62,
    lon: 0.05,
    status: "dormant",
    soilMoisture: 22,
    rainfallMm: 6.4,
    lagHours: 6,
    threshold: 18,
    rationale: "Conditions stable, monitoring pastoral corridor.",
    probability: 0.21,
  },
  {
    id: "KE-TRK-DROUGHT-03",
    label: "Turkana",
    area: "Kenya · Turkana",
    hazard: "DROUGHT",
    lat: 0.15,
    lon: -0.45,
    status: "dormant",
    soilMoisture: 26,
    rainfallMm: 8.9,
    lagHours: 3,
    threshold: 18,
    rationale: "Vegetation index recovering after short rains.",
    probability: 0.14,
  },
  {
    id: "UG-KAR-FLOOD-05",
    label: "Karamoja",
    area: "Uganda · Karamoja",
    hazard: "FLOOD",
    lat: -0.15,
    lon: -0.55,
    status: "dormant",
    soilMoisture: 48,
    rainfallMm: 12.2,
    lagHours: 5,
    threshold: 35,
    rationale: "Soil saturation moderate, no active convective cells.",
    probability: 0.09,
  },
];

const GATEWAYS = [
  { id: "GW-01", label: "Gateway Node 01", lat: -0.8, lon: -0.8 },
  { id: "GW-02", label: "Gateway Node 02", lat: 0.8, lon: 0.85 },
];

function statusColor(s: NodeStatus): number {
  switch (s) {
    case "dormant":
      return 0x1fd77a;
    case "armed":
      return 0xf5c518;
    case "critical":
      return 0xff2f4a;
    case "confirmed":
      return 0x63f0c8;
  }
}

function SituationRoom() {
  const [nodes, setNodes] = useState<RegionNode[]>(INITIAL_NODES);
  const [selectedId, setSelectedId] = useState<string>(INITIAL_NODES[0].id);
  const [layers, setLayers] = useState({
    ipc: true,
    pop: false,
    rainfall: true,
    mesh: true,
  });
  const [timeline, setTimeline] = useState<TimelineEvent[]>([
    { t: Date.now() - 45000, label: "IMERG rainfall ingest · Marsabit", stage: "ingest" },
    { t: Date.now() - 30000, label: "LSTM armed KE-MSB-DROUGHT-01 (P=0.72)", stage: "armed" },
    { t: Date.now() - 20000, label: "SPI-4 stream ingest · Gedo", stage: "ingest" },
    { t: Date.now() - 12000, label: "LSTM armed SO-GED-FLOOD-04 (P=0.58)", stage: "armed" },
  ]);
  const [ussdText, setUssdText] = useState<string>(
    "KINGA: Standby. No active advisory for your cell.",
  );
  const [ussdAwaiting, setUssdAwaiting] = useState(false);
  const [criticalBanner, setCriticalBanner] = useState<string | null>(null);
  const [clock, setClock] = useState<string>("");
  const [scorecard, setScorecard] = useState([
    { org: "NDMA · Marsabit", latency: 12, status: "OK" as const },
    { org: "Ministry · Wajir", latency: 84, status: "SLOW" as const },
    { org: "NDMA · Turkana", latency: 21, status: "OK" as const },
    { org: "NEMA · Gedo", latency: 47, status: "OK" as const },
  ]);

  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const threeRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    tiles: Map<string, THREE.Mesh>;
    pulses: Map<string, THREE.Mesh>;
    lines: THREE.Line[];
    disposed: boolean;
  } | null>(null);

  const selected = nodes.find((n) => n.id === selectedId) ?? nodes[0];

  // Live clock (EAT ~ UTC+3)
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const eat = new Date(d.getTime() + (3 * 60 - d.getTimezoneOffset()) * 60000);
      const hh = String(eat.getUTCHours()).padStart(2, "0");
      const mm = String(eat.getUTCMinutes()).padStart(2, "0");
      const ss = String(eat.getUTCSeconds()).padStart(2, "0");
      setClock(`${hh}:${mm}:${ss} EAT`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Synthetic ingest loop — decays soil moisture on armed drought, raises rainfall on floods.
  useEffect(() => {
    const id = setInterval(() => {
      setNodes((prev) =>
        prev.map((n) => {
          if (n.status === "confirmed" || n.status === "critical") return n;
          const drift = (Math.random() - 0.5) * 0.6;
          if (n.hazard === "DROUGHT") {
            const nextSoil = Math.max(0, n.soilMoisture - Math.random() * 0.15 + drift * 0.1);
            const prob = Math.min(
              0.98,
              Math.max(0, (n.threshold - nextSoil) / n.threshold + 0.15),
            );
            const nextStatus: NodeStatus =
              nextSoil < n.threshold * 0.55
                ? "critical"
                : prob > 0.5
                  ? "armed"
                  : "dormant";
            return { ...n, soilMoisture: nextSoil, probability: prob, status: nextStatus };
          } else {
            const nextRain = Math.max(0, n.rainfallMm + (Math.random() - 0.35) * 0.9);
            const prob = Math.min(0.98, Math.max(0, (nextRain - n.threshold) / n.threshold + 0.4));
            const nextStatus: NodeStatus =
              nextRain > n.threshold * 1.35
                ? "critical"
                : prob > 0.5
                  ? "armed"
                  : "dormant";
            return { ...n, rainfallMm: nextRain, probability: prob, status: nextStatus };
          }
        }),
      );
    }, 1500);
    return () => clearInterval(id);
  }, []);

  // React to transitions -> critical: push timeline + banner
  const prevStatusRef = useRef<Record<string, NodeStatus>>({});
  useEffect(() => {
    for (const n of nodes) {
      const prev = prevStatusRef.current[n.id];
      if (prev && prev !== "critical" && n.status === "critical") {
        setTimeline((t: TimelineEvent[]) =>
          [
            ...t,
            {
              t: Date.now(),
              label: `HARD TRIGGER · ${n.id} breached (${n.hazard})`,
              stage: "trigger",
            },
            {
              t: Date.now() + 1,
              label: `Mesh relay dispatched via ${GATEWAYS[0].label}`,
              stage: "mesh",
            },
          ].slice(-14) as TimelineEvent[],
        );
        setCriticalBanner(`CRITICAL ALERT · ${n.id} FIRE`);
        setTimeout(() => setCriticalBanner(null), 6000);
      }
      if (prev && prev !== "armed" && n.status === "armed") {
        setTimeline((t: TimelineEvent[]) =>
          [
            ...t,
            {
              t: Date.now(),
              label: `LSTM armed ${n.id} (P=${n.probability.toFixed(2)})`,
              stage: "armed",
            },
          ].slice(-14) as TimelineEvent[],
        );
      }
    }
    prevStatusRef.current = Object.fromEntries(nodes.map((n) => [n.id, n.status]));
  }, [nodes]);

  // Three.js scene setup
  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;
    const width = host.clientWidth;
    const height = host.clientHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x05080f, 0.09);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 5.2, 6.8);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x05080f, 1);
    host.appendChild(renderer.domElement);

    // Terrain grid (wireframe plane)
    const grid = new THREE.GridHelper(10, 30, 0x1a3a5c, 0x0f2036);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.55;
    scene.add(grid);

    // Ambient glow floor
    const floorGeo = new THREE.PlaneGeometry(10, 10, 40, 40);
    const floorMat = new THREE.MeshBasicMaterial({
      color: 0x0a1626,
      transparent: true,
      opacity: 0.45,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    scene.add(floor);

    // Faux terrain elevation ripples
    const terrainGeo = new THREE.PlaneGeometry(10, 10, 60, 60);
    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = Math.sin(x * 0.9) * 0.15 + Math.cos(y * 0.7) * 0.12 + Math.sin((x + y) * 0.4) * 0.08;
      pos.setZ(i, z);
    }
    terrainGeo.computeVertexNormals();
    const terrainMat = new THREE.MeshBasicMaterial({
      color: 0x123a5a,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.rotation.x = -Math.PI / 2;
    scene.add(terrain);

    // Gateways
    for (const gw of GATEWAYS) {
      const g = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.18, 0),
        new THREE.MeshBasicMaterial({ color: 0x3ab0ff }),
      );
      g.position.set(gw.lon * 4.2, 0.25, gw.lat * 4.2);
      scene.add(g);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.28, 0.34, 32),
        new THREE.MeshBasicMaterial({ color: 0x3ab0ff, side: THREE.DoubleSide, transparent: true, opacity: 0.7 }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(gw.lon * 4.2, 0.02, gw.lat * 4.2);
      scene.add(ring);
    }

    // Region tiles
    const tiles = new Map<string, THREE.Mesh>();
    const pulses = new Map<string, THREE.Mesh>();
    const lines: THREE.Line[] = [];
    for (const n of INITIAL_NODES) {
      const tileGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.12, 6);
      const tileMat = new THREE.MeshBasicMaterial({
        color: statusColor(n.status),
        transparent: true,
        opacity: 0.85,
      });
      const tile = new THREE.Mesh(tileGeo, tileMat);
      tile.position.set(n.lon * 4.2, 0.06, n.lat * 4.2);
      tile.userData.nodeId = n.id;
      scene.add(tile);
      tiles.set(n.id, tile);

      const pulseMat = new THREE.MeshBasicMaterial({
        color: statusColor(n.status),
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
      });
      const pulse = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.48, 32), pulseMat);
      pulse.rotation.x = -Math.PI / 2;
      pulse.position.set(n.lon * 4.2, 0.03, n.lat * 4.2);
      scene.add(pulse);
      pulses.set(n.id, pulse);

      // Mesh lines to nearest gateway
      const gw = GATEWAYS[0];
      const points = [
        new THREE.Vector3(n.lon * 4.2, 0.12, n.lat * 4.2),
        new THREE.Vector3(gw.lon * 4.2, 0.22, gw.lat * 4.2),
      ];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x2478b8,
        transparent: true,
        opacity: 0.35,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      line.userData.nodeId = n.id;
      scene.add(line);
      lines.push(line);
    }

    // Click picking
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const onClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(Array.from(tiles.values()));
      if (hits.length) {
        const id = hits[0].object.userData.nodeId as string;
        setSelectedId(id);
      }
    };
    renderer.domElement.addEventListener("click", onClick);

    // Resize
    const onResize = () => {
      if (!host) return;
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(host);

    const ref = {
      renderer,
      scene,
      camera,
      tiles,
      pulses,
      lines,
      disposed: false,
    };
    threeRef.current = ref;

    let raf = 0;
    const start = performance.now();
    const animate = () => {
      if (ref.disposed) return;
      const t = (performance.now() - start) / 1000;
      // gentle orbit
      camera.position.x = Math.sin(t * 0.08) * 6.8;
      camera.position.z = Math.cos(t * 0.08) * 6.8;
      camera.position.y = 5.2 + Math.sin(t * 0.2) * 0.2;
      camera.lookAt(0, 0, 0);
      pulses.forEach((p) => {
        const s = 1 + (Math.sin(t * 2.4) + 1) * 0.35;
        p.scale.set(s, s, s);
        (p.material as THREE.MeshBasicMaterial).opacity =
          0.15 + (Math.sin(t * 2.4) + 1) * 0.2;
      });
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      ref.disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("click", onClick);
      renderer.dispose();
      if (host.contains(renderer.domElement)) host.removeChild(renderer.domElement);
    };
  }, []);

  // Sync node state -> Three.js colors + mesh line visibility
  useEffect(() => {
    const ref = threeRef.current;
    if (!ref) return;
    for (const n of nodes) {
      const tile = ref.tiles.get(n.id);
      const pulse = ref.pulses.get(n.id);
      const color = statusColor(n.status);
      if (tile) (tile.material as THREE.MeshBasicMaterial).color.setHex(color);
      if (pulse) (pulse.material as THREE.MeshBasicMaterial).color.setHex(color);
    }
    for (const line of ref.lines) {
      const n = nodes.find((x) => x.id === line.userData.nodeId);
      const active = n && (n.status === "armed" || n.status === "critical");
      const mat = line.material as THREE.LineBasicMaterial;
      mat.opacity = active ? 0.85 : 0.18;
      mat.color.setHex(active ? statusColor(n!.status) : 0x2478b8);
    }
    ref.lines.forEach((l) => (l.visible = layers.mesh));
  }, [nodes, layers.mesh]);

  const armedCount = nodes.filter((n) => n.status === "armed").length;
  const criticalCount = nodes.filter((n) => n.status === "critical").length;
  const activeDispatches = nodes.filter(
    (n) => n.status === "armed" || n.status === "critical",
  );
  const threatIndex = Math.round(
    (nodes.reduce((a, n) => a + n.probability, 0) / nodes.length) * 100,
  );

  const killTower = () => {
    setUssdText("Signal lost. Falling back to LoRa mesh relay…");
    setTimeout(() => {
      setUssdText(
        "KINGA (mesh): Advisory relayed via peer node. Confirm receipt: reply 1.",
      );
      setUssdAwaiting(true);
    }, 1200);
    setTimeline((t: TimelineEvent[]) =>
      [
        ...t,
        { t: Date.now(), label: "Cell tower KE-MSB-CT-02 offline", stage: "mesh" },
        { t: Date.now() + 1, label: "Mesh peer relay engaged", stage: "mesh" },
      ].slice(-14) as TimelineEvent[],
    );
  };

  const forceHardTrigger = () => {
    setNodes((prev) =>
      prev.map((n) =>
        n.id === selected.id
          ? {
              ...n,
              status: "critical",
              probability: 0.99,
              soilMoisture: n.hazard === "DROUGHT" ? n.threshold * 0.4 : n.soilMoisture,
              rainfallMm: n.hazard === "FLOOD" ? n.threshold * 1.6 : n.rainfallMm,
            }
          : n,
      ),
    );
  };

  const acknowledgeInstitutional = () => {
    setTimeline((t: TimelineEvent[]) =>
      [
        ...t,
        {
          t: Date.now(),
          label: `Institutional ACK · ${selected.id}`,
          stage: "inst_ack",
        },
      ].slice(-14) as TimelineEvent[],
    );
    setUssdText(
      `${selected.area} NDMA confirms alert. Move livestock to secondary water point. Reply 1 to confirm.`,
    );
    setUssdAwaiting(true);
    setScorecard((s) =>
      s.map((row, i) => (i === 0 ? { ...row, latency: Math.max(6, row.latency - 3) } : row)),
    );
  };

  const acknowledgeCommunity = () => {
    setUssdAwaiting(false);
    setUssdText("✓ Confirmed. Action logged. Stay safe.");
    setTimeline((t: TimelineEvent[]) =>
      [
        ...t,
        {
          t: Date.now(),
          label: `Community ACK · ${selected.id}`,
          stage: "comm_ack",
        },
      ].slice(-14) as TimelineEvent[],
    );
    setNodes((prev) =>
      prev.map((n) => (n.id === selected.id ? { ...n, status: "confirmed" } : n)),
    );
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#05080f] text-slate-100 font-sans">
      {criticalBanner && (
        <div className="pointer-events-none fixed left-1/2 top-4 z-50 -translate-x-1/2">
          <div className="rounded-md border border-rose-500/60 bg-rose-950/90 px-6 py-3 text-sm font-bold uppercase tracking-widest text-rose-200 shadow-[0_0_40px_rgba(255,47,74,0.5)] animate-pulse">
            {criticalBanner}
          </div>
        </div>
      )}

      <div className="grid h-screen w-screen grid-cols-12 grid-rows-6 gap-3 p-3">
        {/* HEADER */}
        <header className="col-span-12 row-span-1 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/80 px-6">
          <div className="flex items-center gap-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-sky-500/40 bg-sky-500/10 text-sky-400 font-bold">
              K
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-[0.28em] text-sky-300">
                KINGA · SITUATION ROOM
              </h1>
              <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
                Eastern Africa Global Operational View
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <StatChip label="ARMED" value={armedCount} tone="amber" />
            <StatChip label="CRITICAL" value={criticalCount} tone="rose" />
            <StatChip label="NODES" value={nodes.length} tone="sky" />
            <div className="text-right">
              <div className="font-mono text-lg text-slate-200">{clock}</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500">
                2026 · Live Ingest
              </div>
            </div>
          </div>
        </header>

        {/* LEFT PANEL */}
        <aside className="col-span-3 row-span-5 flex flex-col gap-3 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <PanelTitle>Regional Threat Index</PanelTitle>
          <div>
            <div className="mb-2 flex items-end justify-between">
              <div className="text-3xl font-bold text-amber-300">{threatIndex}%</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500">
                {threatIndex > 60 ? "ARMED" : threatIndex > 30 ? "ELEVATED" : "NOMINAL"}
              </div>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: 20 }).map((_, i) => {
                const filled = i < Math.round(threatIndex / 5);
                return (
                  <div
                    key={i}
                    className={`h-3 flex-1 rounded-sm ${
                      filled
                        ? threatIndex > 60
                          ? "bg-rose-500/80"
                          : "bg-amber-400/80"
                        : "bg-slate-800"
                    }`}
                  />
                );
              })}
            </div>
          </div>

          <PanelTitle>Active Dispatches</PanelTitle>
          <div className="flex-1 space-y-1.5 overflow-auto pr-1">
            {activeDispatches.length === 0 && (
              <div className="rounded border border-dashed border-slate-800 p-3 text-xs text-slate-500">
                No armed dispatches. Monitoring baseline conditions.
              </div>
            )}
            {activeDispatches.map((n) => (
              <button
                key={n.id}
                onClick={() => setSelectedId(n.id)}
                className={`w-full rounded border px-3 py-2 text-left text-xs transition ${
                  selectedId === n.id
                    ? "border-sky-500/60 bg-sky-500/10"
                    : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-mono text-[11px] text-slate-200">{n.id}</div>
                  <StatusDot status={n.status} />
                </div>
                <div className="mt-0.5 text-[10px] uppercase tracking-widest text-slate-500">
                  {n.area} · P={n.probability.toFixed(2)}
                </div>
              </button>
            ))}
            {nodes
              .filter((n) => n.status === "dormant" || n.status === "confirmed")
              .map((n) => (
                <button
                  key={n.id}
                  onClick={() => setSelectedId(n.id)}
                  className={`w-full rounded border px-3 py-2 text-left text-xs transition ${
                    selectedId === n.id
                      ? "border-sky-500/60 bg-sky-500/10"
                      : "border-slate-900 bg-slate-950/40 hover:border-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-[11px] text-slate-400">{n.id}</div>
                    <StatusDot status={n.status} />
                  </div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-widest text-slate-600">
                    {n.area}
                  </div>
                </button>
              ))}
          </div>

          <PanelTitle>Baselayer GIS Controls</PanelTitle>
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                ["ipc", "IPC Phase"],
                ["pop", "Pop Density"],
                ["rainfall", "Rainfall"],
                ["mesh", "Mesh Links"],
              ] as const
            ).map(([k, label]) => (
              <label
                key={k}
                className={`flex cursor-pointer items-center gap-2 rounded border px-2.5 py-1.5 text-[11px] uppercase tracking-widest transition ${
                  layers[k]
                    ? "border-sky-500/50 bg-sky-500/10 text-sky-200"
                    : "border-slate-800 bg-slate-900/40 text-slate-500"
                }`}
              >
                <input
                  type="checkbox"
                  checked={layers[k]}
                  onChange={(e) => setLayers((l) => ({ ...l, [k]: e.target.checked }))}
                  className="h-3 w-3 accent-sky-400"
                />
                {label}
              </label>
            ))}
          </div>
        </aside>

        {/* THREE.JS VIEWPORT */}
        <main className="relative col-span-6 row-span-3 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/70">
          <div className="absolute left-0 top-0 z-10 flex items-center gap-3 p-3">
            <div className="rounded border border-sky-500/40 bg-slate-950/80 px-2.5 py-1 text-[10px] uppercase tracking-[0.25em] text-sky-300">
              God's View · Terrain + Mesh
            </div>
          </div>
          <div className="absolute right-0 top-0 z-10 space-y-1.5 p-3 text-[10px] uppercase tracking-widest">
            <LegendRow color="#3ab0ff" label="Gateway node" shape="diamond" />
            <LegendRow color="#1fd77a" label="Dormant relay" shape="dot" />
            <LegendRow color="#f5c518" label="Armed (LSTM)" shape="dot" />
            <LegendRow color="#ff2f4a" label="Critical fire" shape="dot" />
            <LegendRow color="#63f0c8" label="Confirmed ACK" shape="dot" />
          </div>
          <div ref={canvasHostRef} className="h-full w-full" />
          <div className="pointer-events-none absolute bottom-2 left-3 font-mono text-[10px] text-slate-600">
            EPSG:4326 · synthetic ingest · click a tile to inspect
          </div>
        </main>

        {/* RIGHT PANEL */}
        <section className="col-span-3 row-span-5 flex flex-col gap-3 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <PanelTitle>Node / Admin Unit Detail</PanelTitle>
          <div className="rounded border border-slate-800 bg-slate-900/50 p-3">
            <div className="flex items-center justify-between">
              <div className="font-mono text-sm text-slate-100">{selected.id}</div>
              <StatusPill status={selected.status} />
            </div>
            <div className="mt-0.5 text-[10px] uppercase tracking-widest text-slate-500">
              {selected.area} · {selected.hazard}
            </div>
          </div>

          <div className="space-y-2">
            {selected.hazard === "DROUGHT" ? (
              <Gauge
                label="Soil Moisture"
                value={selected.soilMoisture}
                unit="%"
                threshold={selected.threshold}
                inverse
              />
            ) : (
              <Gauge
                label="Rainfall (IMERG 3h)"
                value={selected.rainfallMm}
                unit="mm"
                threshold={selected.threshold}
              />
            )}
            <Gauge
              label="LSTM Probability"
              value={selected.probability * 100}
              unit="%"
              threshold={60}
            />
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <MicroStat label="Ingest lag" value={`${selected.lagHours}h`} />
              <MicroStat
                label={selected.hazard === "DROUGHT" ? "Rainfall (24h)" : "Soil sat."}
                value={
                  selected.hazard === "DROUGHT"
                    ? `${selected.rainfallMm.toFixed(1)}mm`
                    : `${selected.soilMoisture.toFixed(0)}%`
                }
              />
            </div>
          </div>

          <div className="rounded border border-slate-800 bg-slate-900/40 p-3 text-[11px] leading-relaxed text-slate-300">
            <div className="mb-1 text-[10px] uppercase tracking-widest text-slate-500">
              Rationale
            </div>
            {selected.rationale}
          </div>

          <PanelTitle>Institutional Scorecard</PanelTitle>
          <div className="space-y-1.5">
            {scorecard.map((row) => (
              <div
                key={row.org}
                className="flex items-center justify-between rounded border border-slate-800 bg-slate-900/40 px-3 py-1.5 text-[11px]"
              >
                <div className="text-slate-300">{row.org}</div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-400">{row.latency}m</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
                      row.status === "OK"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-amber-500/15 text-amber-300"
                    }`}
                  >
                    {row.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={acknowledgeInstitutional}
            className="mt-auto rounded border border-sky-500/50 bg-sky-500/10 px-3 py-2 text-xs font-bold uppercase tracking-widest text-sky-200 transition hover:bg-sky-500/20"
          >
            Acknowledge · Dispatch to Community
          </button>
        </section>

        {/* BOTTOM PANEL */}
        <footer className="col-span-6 row-span-2 grid grid-cols-12 gap-3 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <div className="col-span-7 flex flex-col overflow-hidden border-r border-slate-800 pr-3">
            <PanelTitle>Activation & Action Chronology</PanelTitle>
            <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-widest">
              <ChronoChip color="bg-slate-500" label="Ingest" />
              <span className="text-slate-700">→</span>
              <ChronoChip color="bg-amber-400" label="Armed" />
              <span className="text-slate-700">→</span>
              <ChronoChip color="bg-rose-500" label="Trigger" />
              <span className="text-slate-700">→</span>
              <ChronoChip color="bg-sky-400" label="Mesh" />
              <span className="text-slate-700">→</span>
              <ChronoChip color="bg-emerald-400" label="ACK" />
            </div>
            <div className="flex-1 space-y-1 overflow-auto pr-1 font-mono text-[11px]">
              {[...timeline].reverse().map((e, i) => (
                <div
                  key={`${e.t}-${i}`}
                  className="flex items-center gap-2 rounded border border-slate-900 bg-slate-950/50 px-2 py-1"
                >
                  <StageBadge stage={e.stage} />
                  <span className="text-slate-500">
                    {new Date(e.t).toLocaleTimeString(undefined, {
                      hour12: false,
                    })}
                  </span>
                  <span className="text-slate-300">{e.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                onClick={killTower}
                className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-300 transition hover:border-amber-500/60 hover:text-amber-200"
              >
                Kill Cell Tower
              </button>
              <button
                onClick={forceHardTrigger}
                className="rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-rose-200 transition hover:bg-rose-500/20"
              >
                Force Hard Trigger
              </button>
            </div>
          </div>

          <div className="col-span-5 flex flex-col items-center justify-center">
            <PanelTitle>Community Phone Mock · USSD</PanelTitle>
            <div className="mt-1 flex w-[210px] flex-col rounded-[28px] border border-slate-700 bg-slate-950 p-2 shadow-[0_0_30px_rgba(56,189,248,0.15)]">
              <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-slate-800" />
              <div className="rounded-[18px] border border-slate-800 bg-emerald-950/40 p-3">
                <div className="mb-1 flex items-center justify-between text-[8px] font-mono text-emerald-400/70">
                  <span>SAFARICOM</span>
                  <span>*789#</span>
                </div>
                <div className="min-h-[92px] rounded bg-black/40 p-2 font-mono text-[10px] leading-snug text-emerald-300">
                  {ussdText}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((k) => (
                    <button
                      key={k}
                      onClick={() => {
                        if (k === "1" && ussdAwaiting) acknowledgeCommunity();
                      }}
                      className={`rounded border border-slate-800 py-1 text-center text-xs font-mono transition ${
                        k === "1" && ussdAwaiting
                          ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-200 animate-pulse"
                          : "bg-slate-900 text-slate-400 hover:bg-slate-800"
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-2 text-[9px] uppercase tracking-widest text-slate-600">
              {ussdAwaiting ? "Awaiting user reply · press 1" : "Idle · standing by"}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
      {children}
    </div>
  );
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "amber" | "rose" | "sky";
}) {
  const toneMap = {
    amber: "border-amber-500/40 text-amber-300",
    rose: "border-rose-500/40 text-rose-300",
    sky: "border-sky-500/40 text-sky-300",
  } as const;
  return (
    <div
      className={`flex items-center gap-2 rounded border px-2.5 py-1 ${toneMap[tone]} bg-slate-900/40`}
    >
      <span className="text-[9px] uppercase tracking-widest opacity-70">{label}</span>
      <span className="font-mono text-sm font-bold">{value}</span>
    </div>
  );
}

function StatusDot({ status }: { status: NodeStatus }) {
  const color =
    status === "critical"
      ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)]"
      : status === "armed"
        ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]"
        : status === "confirmed"
          ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
          : "bg-emerald-600/70";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

function StatusPill({ status }: { status: NodeStatus }) {
  const map = {
    dormant: "border-emerald-600/40 bg-emerald-600/10 text-emerald-300",
    armed: "border-amber-500/50 bg-amber-500/10 text-amber-300",
    critical: "border-rose-500/60 bg-rose-500/15 text-rose-200",
    confirmed: "border-emerald-400/60 bg-emerald-400/15 text-emerald-200",
  } as const;
  return (
    <span
      className={`rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${map[status]}`}
    >
      {status}
    </span>
  );
}

function Gauge({
  label,
  value,
  unit,
  threshold,
  inverse = false,
}: {
  label: string;
  value: number;
  unit: string;
  threshold: number;
  inverse?: boolean;
}) {
  const max = Math.max(threshold * 2, value * 1.1, 10);
  const pct = Math.min(100, (value / max) * 100);
  const breached = inverse ? value < threshold : value > threshold;
  const threshPct = Math.min(100, (threshold / max) * 100);
  return (
    <div className="rounded border border-slate-800 bg-slate-900/40 p-2.5">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest">
        <span className="text-slate-400">{label}</span>
        <span
          className={`font-mono text-xs ${breached ? "text-rose-300" : "text-slate-200"}`}
        >
          {value.toFixed(1)}
          {unit}
        </span>
      </div>
      <div className="relative mt-1.5 h-1.5 w-full rounded-full bg-slate-800">
        <div
          className={`absolute left-0 top-0 h-full rounded-full ${
            breached ? "bg-rose-500" : "bg-amber-400"
          }`}
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-[-2px] h-[10px] w-[2px] bg-sky-400"
          style={{ left: `${threshPct}%` }}
          title={`threshold ${threshold}${unit}`}
        />
      </div>
      <div className="mt-1 text-right text-[9px] uppercase tracking-widest text-slate-600">
        threshold {threshold}
        {unit}
      </div>
    </div>
  );
}

function MicroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-900/40 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-widest text-slate-500">{label}</div>
      <div className="font-mono text-xs text-slate-200">{value}</div>
    </div>
  );
}

function LegendRow({
  color,
  label,
  shape,
}: {
  color: string;
  label: string;
  shape: "dot" | "diamond";
}) {
  return (
    <div className="flex items-center gap-2 text-slate-400">
      <span
        className={shape === "diamond" ? "rotate-45" : "rounded-full"}
        style={{
          width: 8,
          height: 8,
          backgroundColor: color,
          boxShadow: `0 0 8px ${color}`,
        }}
      />
      <span>{label}</span>
    </div>
  );
}

function ChronoChip({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1 text-slate-400">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </div>
  );
}

function StageBadge({ stage }: { stage: TimelineEvent["stage"] }) {
  const map = {
    ingest: "bg-slate-500/20 text-slate-300",
    armed: "bg-amber-400/20 text-amber-200",
    trigger: "bg-rose-500/25 text-rose-200",
    mesh: "bg-sky-400/20 text-sky-200",
    inst_ack: "bg-indigo-400/20 text-indigo-200",
    comm_ack: "bg-emerald-400/20 text-emerald-200",
  } as const;
  const label = {
    ingest: "INGEST",
    armed: "ARMED",
    trigger: "TRIGGER",
    mesh: "MESH",
    inst_ack: "INST ACK",
    comm_ack: "COMM ACK",
  }[stage];
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${map[stage]}`}
    >
      {label}
    </span>
  );
}
