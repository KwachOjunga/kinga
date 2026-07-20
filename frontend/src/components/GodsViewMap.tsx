import { useEffect, useRef } from "react";
import * as THREE from "three";

import {
  COUNTRY_OUTLINES,
  elevationAt,
  GATEWAY_COORDS,
  isLand,
  landColor,
  projectToScene,
  type GeoPoint,
} from "../lib/geo";
import type { RegionNode } from "../lib/kinga-types";

export interface MapLayers {
  ipc: boolean;
  pop: boolean;
  rainfall: boolean;
  mesh: boolean;
}

interface GodsViewMapProps {
  nodes: RegionNode[];
  layers: MapLayers;
  selectedId: string;
  onSelect: (id: string) => void;
}

function statusColor(s: RegionNode["status"]): number {
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

function buildTerrain(): THREE.Mesh {
  const segs = 120;
  const geo = new THREE.PlaneGeometry(12, 10, segs, segs);
  const colors: number[] = [];
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getY(i);
    const lon = (x / 12 + 0.5) * (52 - 28) + 28;
    const lat = (0.5 - z / 10) * (18 - -6) + -6;
    const elev = elevationAt(lat, lon);
    pos.setZ(i, elev * 0.35);
    const [r, g, b] = landColor(lat, lon);
    colors.push(r, g, b);
  }

  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.05,
    flatShading: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  return mesh;
}

function buildCountryLines(): THREE.Group {
  const group = new THREE.Group();
  for (const [, points] of Object.entries(COUNTRY_OUTLINES)) {
    const verts: THREE.Vector3[] = [];
    for (const p of points) {
      const { x, z } = projectToScene(p);
      const elev = elevationAt(p.lat, p.lon) * 0.35 + 0.05;
      verts.push(new THREE.Vector3(x, elev, z));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(verts);
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({
        color: 0x7ec8e8,
        transparent: true,
        opacity: 0.45,
      }),
    );
    group.add(line);
  }
  return group;
}

function buildIpcOverlay(): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(12, 10, 1, 1);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xc2410c,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.08;
  return mesh;
}

function buildRainfallOverlay(nodes: RegionNode[]): THREE.Group {
  const group = new THREE.Group();
  for (const n of nodes) {
    if (n.hazard !== "FLOOD") continue;
    const { x, z } = projectToScene({ lat: n.geoLat, lon: n.geoLon });
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.7, 32),
      new THREE.MeshBasicMaterial({
        color: 0x3b82f6,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.1, z);
    group.add(ring);
  }
  return group;
}

function buildPopOverlay(): THREE.Group {
  const group = new THREE.Group();
  for (let lat = -4; lat <= 14; lat += 1.2) {
    for (let lon = 30; lon <= 48; lon += 1.2) {
      if (!isLand(lat, lon)) continue;
      const density = Math.random() > 0.55 ? 1 : 0;
      if (!density) continue;
      const { x, z } = projectToScene({ lat, lon });
      const dot = new THREE.Mesh(
        new THREE.CircleGeometry(0.04, 6),
        new THREE.MeshBasicMaterial({
          color: 0xfbbf24,
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
        }),
      );
      dot.rotation.x = -Math.PI / 2;
      dot.position.set(x, 0.09, z);
      group.add(dot);
    }
  }
  return group;
}

function geoForNode(n: RegionNode): GeoPoint {
  return { lat: n.geoLat, lon: n.geoLon };
}

export function GodsViewMap({ nodes, layers, selectedId, onSelect }: GodsViewMapProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer;
    camera: THREE.PerspectiveCamera;
    tiles: Map<string, THREE.Group>;
    pulses: Map<string, THREE.Mesh>;
    lines: THREE.Line[];
    ipcLayer: THREE.Mesh;
    rainLayer: THREE.Group;
    popLayer: THREE.Group;
    meshLines: THREE.Line[];
    disposed: boolean;
  } | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const w = host.clientWidth;
    const h = host.clientHeight;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x02060d);
    scene.fog = new THREE.FogExp2(0x02060d, 0.045);

    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
    camera.position.set(0, 7.5, 8.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    host.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x334466, 0.6));
    const sun = new THREE.DirectionalLight(0xffeedd, 1.1);
    sun.position.set(6, 12, 4);
    sun.castShadow = true;
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0x4488cc, 0x1a1208, 0.35));

    scene.add(buildTerrain());
    scene.add(buildCountryLines());

    const ipcLayer = buildIpcOverlay();
    scene.add(ipcLayer);
    const rainLayer = buildRainfallOverlay(nodes);
    scene.add(rainLayer);
    const popLayer = buildPopOverlay();
    scene.add(popLayer);

    const tiles = new Map<string, THREE.Group>();
    const pulses = new Map<string, THREE.Mesh>();
    const meshLines: THREE.Line[] = [];

    for (const gw of GATEWAY_COORDS) {
      const { x, z } = projectToScene(gw);
      const elev = elevationAt(gw.lat, gw.lon) * 0.35;
      const tower = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.1, 0.35, 6),
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0c4a6e,
          emissiveIntensity: 0.6,
        }),
      );
      tower.position.set(x, elev + 0.2, z);
      scene.add(tower);
      const beacon = new THREE.PointLight(0x38bdf8, 0.8, 2);
      beacon.position.set(x, elev + 0.5, z);
      scene.add(beacon);
    }

    for (const n of nodes) {
      const geo = geoForNode(n);
      const { x, z } = projectToScene(geo);
      const elev = elevationAt(geo.lat, geo.lon) * 0.35;
      const group = new THREE.Group();
      group.position.set(x, elev, z);
      group.userData.nodeId = n.id;

      const pin = new THREE.Mesh(
        new THREE.ConeGeometry(0.14, 0.42, 8),
        new THREE.MeshStandardMaterial({
          color: statusColor(n.status),
          emissive: statusColor(n.status),
          emissiveIntensity: 0.35,
          roughness: 0.4,
        }),
      );
      pin.position.y = 0.21;
      group.add(pin);

      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.22, 0.04, 16),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.3 }),
      );
      base.position.y = 0.02;
      group.add(base);

      scene.add(group);
      tiles.set(n.id, group);

      const pulse = new THREE.Mesh(
        new THREE.RingGeometry(0.22, 0.32, 32),
        new THREE.MeshBasicMaterial({
          color: statusColor(n.status),
          transparent: true,
          opacity: 0.45,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      pulse.rotation.x = -Math.PI / 2;
      pulse.position.set(x, elev + 0.04, z);
      scene.add(pulse);
      pulses.set(n.id, pulse);

      const gw = projectToScene(GATEWAY_COORDS[0]);
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, elev + 0.15, z),
        new THREE.Vector3(
          gw.x,
          elevationAt(GATEWAY_COORDS[0].lat, GATEWAY_COORDS[0].lon) * 0.35 + 0.2,
          gw.z,
        ),
      ]);
      const line = new THREE.Line(
        lineGeo,
        new THREE.LineBasicMaterial({ color: 0x2478b8, transparent: true, opacity: 0.3 }),
      );
      line.userData.nodeId = n.id;
      scene.add(line);
      meshLines.push(line);
    }

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const onClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const groups = Array.from(tiles.values());
      const hits = raycaster.intersectObjects(groups, true);
      if (hits.length) {
        let obj: THREE.Object3D | null = hits[0].object;
        while (obj && !obj.userData.nodeId) obj = obj.parent;
        if (obj?.userData.nodeId) onSelect(obj.userData.nodeId as string);
      }
    };
    renderer.domElement.addEventListener("click", onClick);

    const onResize = () => {
      const nw = host.clientWidth;
      const nh = host.clientHeight;
      renderer.setSize(nw, nh);
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(host);

    const ref = {
      renderer,
      camera,
      tiles,
      pulses,
      lines: meshLines,
      ipcLayer,
      rainLayer,
      popLayer,
      meshLines,
      disposed: false,
    };
    stateRef.current = ref;

    let raf = 0;
    const start = performance.now();
    const animate = () => {
      if (ref.disposed) return;
      const t = (performance.now() - start) / 1000;
      camera.position.x = Math.sin(t * 0.05) * 8.5;
      camera.position.z = 8.5 + Math.cos(t * 0.05) * 2.5;
      camera.position.y = 7.2 + Math.sin(t * 0.15) * 0.25;
      camera.lookAt(0, 0.2, 0);
      pulses.forEach((p) => {
        const s = 1 + (Math.sin(t * 2.2) + 1) * 0.3;
        p.scale.set(s, s, s);
        (p.material as THREE.MeshBasicMaterial).opacity = 0.12 + (Math.sin(t * 2.2) + 1) * 0.18;
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
      stateRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scene built once; sync via second effect
  }, []);

  useEffect(() => {
    const ref = stateRef.current;
    if (!ref) return;
    for (const n of nodes) {
      const group = ref.tiles.get(n.id);
      const pulse = ref.pulses.get(n.id);
      const color = statusColor(n.status);
      if (group) {
        const pin = group.children[0] as THREE.Mesh;
        const mat = pin.material as THREE.MeshStandardMaterial;
        mat.color.setHex(color);
        mat.emissive.setHex(color);
        group.scale.setScalar(n.id === selectedId ? 1.25 : 1);
      }
      if (pulse) {
        (pulse.material as THREE.MeshBasicMaterial).color.setHex(color);
      }
    }
    ref.ipcLayer.visible = layers.ipc;
    ref.rainLayer.visible = layers.rainfall;
    ref.popLayer.visible = layers.pop;
    for (const line of ref.meshLines) {
      const n = nodes.find((x) => x.id === line.userData.nodeId);
      const active = n && (n.status === "armed" || n.status === "critical");
      line.visible = layers.mesh;
      const mat = line.material as THREE.LineBasicMaterial;
      mat.opacity = active ? 0.75 : 0.15;
      if (n && active) mat.color.setHex(statusColor(n.status));
    }
  }, [nodes, layers, selectedId]);

  return (
    <div ref={hostRef} className="relative h-full w-full">
      <div className="pointer-events-none absolute bottom-2 left-3 font-mono text-[10px] text-slate-500">
        WGS84 · Horn of Africa · click marker to inspect
      </div>
    </div>
  );
}
