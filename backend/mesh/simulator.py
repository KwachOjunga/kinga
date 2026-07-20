from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

import networkx as nx

from schemas import MeshEdge, MeshHop, MeshNode, MeshNodeStatus, MeshTopology

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# Grid coordinates match the frontend Three.js map (-1..1 scaled by 4.2)
MESH_NODES: list[dict] = [
    {"id": "gateway_01", "label": "Gateway Node 01", "lat": -0.8, "lon": -0.8, "role": "gateway"},
    {"id": "gateway_02", "label": "Gateway Node 02", "lat": 0.8, "lon": 0.85, "role": "gateway"},
    {"id": "village_a", "label": "Village A Relay", "lat": 0.1, "lon": -0.2, "role": "relay"},
    {"id": "village_b", "label": "Village B Relay", "lat": 0.4, "lon": 0.3, "role": "relay"},
    {"id": "village_c", "label": "Village C Relay", "lat": 0.5, "lon": 0.5, "role": "relay"},
    {"id": "field_marsabit", "label": "Marsabit Field Office", "lat": 0.35, "lon": -0.15, "role": "destination"},
    {"id": "field_gedo", "label": "Gedo Field Office", "lat": 0.55, "lon": 0.55, "role": "destination"},
    {"id": "field_dollo", "label": "Dollo Field Office", "lat": 0.62, "lon": 0.05, "role": "destination"},
    {"id": "field_turkana", "label": "Turkana Field Office", "lat": 0.15, "lon": -0.45, "role": "destination"},
    {"id": "field_karamoja", "label": "Karamoja Field Office", "lat": -0.15, "lon": -0.55, "role": "destination"},
    {"id": "field_ali_sabieh", "label": "Ali Sabieh Field Office", "lat": 0.75, "lon": 0.75, "role": "destination"},
    {"id": "field_gash_barka", "label": "Gash-Barka Field Office", "lat": 0.85, "lon": 0.35, "role": "destination"},
    {"id": "field_jonglei", "label": "Jonglei Field Office", "lat": 0.5, "lon": -0.65, "role": "destination"},
    {"id": "field_gedaref", "label": "Gedaref Field Office", "lat": 0.8, "lon": -0.5, "role": "destination"},
]

MESH_EDGES: list[tuple[str, str, int]] = [
    ("gateway_01", "village_a", 120),
    ("gateway_01", "field_turkana", 180),
    ("gateway_01", "field_marsabit", 150),
    ("gateway_01", "field_jonglei", 200),
    ("gateway_01", "field_gedaref", 190),
    ("gateway_02", "village_b", 110),
    ("gateway_02", "village_c", 130),
    ("gateway_02", "field_gedo", 160),
    ("gateway_02", "field_karamoja", 200),
    ("gateway_02", "field_ali_sabieh", 140),
    ("gateway_02", "field_gash_barka", 120),
    ("village_a", "village_b", 90),
    ("village_a", "field_marsabit", 70),
    ("village_a", "field_jonglei", 180),
    ("village_b", "village_c", 85),
    ("village_b", "field_dollo", 140),
    ("village_b", "field_gash_barka", 130),
    ("village_c", "field_gedo", 75),
    ("village_c", "field_karamoja", 160),
    ("village_c", "field_ali_sabieh", 110),
    ("field_marsabit", "field_turkana", 220),
    ("field_marsabit", "field_gedaref", 170),
    ("field_gedaref", "field_jonglei", 210),
    ("field_dollo", "field_gash_barka", 155),
]

TRIGGER_DESTINATIONS = {
    "KE-MSB-DROUGHT-01": "field_marsabit",
    "SO-GED-FLOOD-04": "field_gedo",
    "ET-SOM-DROUGHT-02": "field_dollo",
    "KE-TRK-DROUGHT-03": "field_turkana",
    "UG-KAR-FLOOD-05": "field_karamoja",
    "DJ-ALI-DROUGHT-06": "field_ali_sabieh",
    "ER-GBR-DROUGHT-07": "field_gash_barka",
    "SS-JON-FLOOD-08": "field_jonglei",
    "SD-GED-DROUGHT-09": "field_gedaref",
}


class MeshSimulator:
    def __init__(self) -> None:
        self.graph = nx.Graph()
        for node in MESH_NODES:
            self.graph.add_node(node["id"], **node)
        for source, target, latency in MESH_EDGES:
            self.graph.add_edge(source, target, latency_ms=latency)
        self.offline_nodes: set[str] = set()
        self._rng = random.Random(42)

    def get_topology(self) -> MeshTopology:
        nodes = [MeshNode(**n) for n in MESH_NODES]
        edges = [
            MeshEdge(source=s, target=t, latency_ms=lat)
            for s, t, lat in MESH_EDGES
        ]
        return MeshTopology(nodes=nodes, edges=edges)

    def get_status(self) -> list[MeshNodeStatus]:
        now = datetime.now(timezone.utc)
        statuses: list[MeshNodeStatus] = []
        for node in MESH_NODES:
            online = node["id"] not in self.offline_nodes
            jitter = self._rng.randint(0, 300)
            last_seen = now - timedelta(seconds=jitter if online else 3600)
            statuses.append(
                MeshNodeStatus(id=node["id"], online=online, last_seen=last_seen)
            )
        return statuses

    def set_offline(self, node_ids: list[str]) -> None:
        self.offline_nodes.update(node_ids)

    def clear_offline(self) -> None:
        self.offline_nodes.clear()

    def destination_for_trigger(self, trigger_id: str) -> str:
        return TRIGGER_DESTINATIONS.get(trigger_id, "field_marsabit")

    def simulate_delivery(
        self,
        dispatch_id: str,
        destination: str | None = None,
        force_offline: list[str] | None = None,
    ) -> dict:
        saved_offline = set(self.offline_nodes)
        if force_offline:
            self.offline_nodes.update(force_offline)

        dest = destination or "field_marsabit"
        gateways = [n["id"] for n in MESH_NODES if n["role"] == "gateway"]
        start = gateways[0]

        def edge_weight(u: str, v: str, _data: dict) -> float:
            if u in self.offline_nodes or v in self.offline_nodes:
                return float("inf")
            return self.graph.edges[u, v]["latency_ms"]

        try:
            route = nx.shortest_path(
                self.graph, start, dest, weight=edge_weight
            )
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            self.offline_nodes = saved_offline
            return {
                "dispatch_id": dispatch_id,
                "route": [],
                "hops": [],
                "total_latency_ms": 0,
                "delivered": False,
            }

        now = datetime.now(timezone.utc)
        hops: list[MeshHop] = []
        total_latency = 0
        current = now
        for i, node in enumerate(route):
            if i == 0:
                latency = 0
            else:
                prev = route[i - 1]
                latency = self.graph.edges[prev, node]["latency_ms"]
                jitter = self._rng.randint(10, 80)
                latency += jitter
                total_latency += latency
                current = current + timedelta(milliseconds=latency)
            hops.append(
                MeshHop(node=node, arrived_at=current, latency_ms=latency)
            )

        self.offline_nodes = saved_offline
        return {
            "dispatch_id": dispatch_id,
            "route": route,
            "hops": hops,
            "total_latency_ms": total_latency,
            "delivered": True,
        }
