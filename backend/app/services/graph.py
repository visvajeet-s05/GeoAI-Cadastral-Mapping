"""
Module 10: Uncertainty Calibration
Module 11: Boundary Refinement
Module 12: Candidate Boundary Graph Construction
Module 13: Graph Optimization and Boundary Linking
Module 14: Topology-Constrained Parcel Reconstruction
"""

import numpy as np
from typing import Dict, Any, List, Tuple, Optional
from dataclasses import dataclass
import json

try:
    import networkx as nx
    from shapely.geometry import LineString, Polygon, Point, MultiPolygon
    from shapely.ops import polygonize, unary_union
    HAS_GRAPH_LIBS = True
except ImportError:
    HAS_GRAPH_LIBS = False
    print("WARNING: networkx or shapely not installed. Graph operations will use simplified methods.")


@dataclass
class BoundarySegment:
    """Represents a boundary segment with reliability scores."""
    segment_id: str
    coordinates: List[Tuple[float, float]]
    raw_reliability: float
    calibrated_confidence: float
    epistemic_uncertainty: float
    aleatoric_uncertainty: float
    length: float


class UncertaintyCalibrator:
    """
    Module 10: Uncertainty Calibration
    Calibrates raw model reliability scores to match observed spatial accuracy.
    """
    
    def __init__(self, num_bins: int = 10):
        self.num_bins = num_bins
        self.calibration_model = None
        self.ece_history = []
    
    def calculate_expected_calibration_error(self, confidences: np.ndarray, 
                                           accuracies: np.ndarray) -> float:
        """
        Calculates Expected Calibration Error (ECE) across confidence bins.
        
        Args:
            confidences: Predicted confidence scores
            accuracies: Actual accuracy scores (0 or 1)
            
        Returns:
            ECE value
        """
        bin_boundaries = np.linspace(0, 1, self.num_bins + 1)
        ece = 0.0
        total_samples = len(confidences)
        
        for i in range(self.num_bins):
            bin_mask = (confidences > bin_boundaries[i]) & (confidences <= bin_boundaries[i + 1])
            bin_size = np.sum(bin_mask)
            
            if bin_size > 0:
                avg_confidence = np.mean(confidences[bin_mask])
                avg_accuracy = np.mean(accuracies[bin_mask])
                ece += (bin_size / total_samples) * abs(avg_accuracy - avg_confidence)
        
        return ece
    
    def fit_isotonic_regression(self, confidences: np.ndarray, 
                               accuracies: np.ndarray) -> callable:
        """
        Fits isotonic regression to calibrate confidence scores.
        
        Args:
            confidences: Raw confidence scores
            accuracies: Actual accuracy scores
            
        Returns:
            Calibration function
        """
        try:
            from sklearn.isotonic import IsotonicRegression
            
            iso_reg = IsotonicRegression(out_of_bounds='clip')
            iso_reg.fit(confidences, accuracies)
            
            self.calibration_model = iso_reg
            return lambda x: iso_reg.predict(x)
        except ImportError:
            # Fallback to simple linear calibration
            self.calibration_model = "linear"
            slope = np.cov(confidences, accuracies)[0, 1] / np.var(confidences)
            intercept = np.mean(accuracies) - slope * np.mean(confidences)
            return lambda x: np.clip(slope * x + intercept, 0, 1)
    
    def calibrate_scores(self, raw_scores: np.ndarray) -> np.ndarray:
        """
        Applies calibration to raw reliability scores.
        
        Args:
            raw_scores: Raw reliability scores
            
        Returns:
            Calibrated confidence scores
        """
        if self.calibration_model is None:
            return raw_scores
        
        if callable(self.calibration_model):
            return self.calibration_model(raw_scores)
        elif self.calibration_model == "linear":
            # Use the linear model (this is a placeholder)
            return np.clip(raw_scores, 0, 1)
        
        return raw_scores


class BoundaryRefiner:
    """
    Module 11: Boundary Refinement
    Cleans, snaps, and structurally joins fragmented candidate vectors.
    """
    
    def __init__(self, drop_threshold: float = 0.3, snap_radius_factor: float = 5.0,
                 collinear_angle_threshold: float = 12.0):
        self.drop_threshold = drop_threshold
        self.snap_radius_factor = snap_radius_factor
        self.collinear_angle_threshold = collinear_angle_threshold
    
    def filter_low_confidence(self, segments: List[BoundarySegment]) -> List[BoundarySegment]:
        """
        Drops low-confidence noise vectors.
        
        Args:
            segments: List of boundary segments
            
        Returns:
            Filtered segments
        """
        return [s for s in segments if s.calibrated_confidence >= self.drop_threshold]
    
    def snap_endpoints(self, segments: List[BoundarySegment], gsd: float) -> List[BoundarySegment]:
        """
        Applies spatial endpoint snapping using adaptive search radius.
        
        Args:
            segments: List of boundary segments
            gsd: Ground sampling distance
            
        Returns:
            Segments with snapped endpoints
        """
        snap_radius = self.snap_radius_factor * gsd
        refined_segments = []
        
        for segment in segments:
            coords = segment.coordinates.copy()
            
            # Snap first endpoint to nearby segment endpoints
            first_point = coords[0]
            snapped_first = self._find_nearest_endpoint(first_point, segments, snap_radius)
            if snapped_first:
                coords[0] = snapped_first
            
            # Snap last endpoint
            last_point = coords[-1]
            snapped_last = self._find_nearest_endpoint(last_point, segments, snap_radius)
            if snapped_last:
                coords[-1] = snapped_last
            
            # Create refined segment
            refined_segment = BoundarySegment(
                segment_id=segment.segment_id,
                coordinates=coords,
                raw_reliability=segment.raw_reliability,
                calibrated_confidence=segment.calibrated_confidence,
                epistemic_uncertainty=segment.epistemic_uncertainty,
                aleatoric_uncertainty=segment.aleatoric_uncertainty,
                length=self._calculate_length(coords)
            )
            refined_segments.append(refined_segment)
        
        return refined_segments
    
    def _find_nearest_endpoint(self, point: Tuple[float, float], 
                              segments: List[BoundarySegment], 
                              radius: float) -> Optional[Tuple[float, float]]:
        """Finds nearest endpoint within radius."""
        nearest = None
        min_distance = radius
        
        for segment in segments:
            for endpoint in [segment.coordinates[0], segment.coordinates[-1]]:
                distance = np.sqrt((point[0] - endpoint[0])**2 + (point[1] - endpoint[1])**2)
                if distance < min_distance:
                    min_distance = distance
                    nearest = endpoint
        
        return nearest
    
    def merge_collinear_segments(self, segments: List[BoundarySegment]) -> List[BoundarySegment]:
        """
        Merges collinear lines where angular deviation is below threshold.
        
        Args:
            segments: List of boundary segments
            
        Returns:
            Merged segments
        """
        merged_segments = []
        used = set()
        
        for i, seg1 in enumerate(segments):
            if i in used:
                continue
            
            current_segment = seg1
            
            for j, seg2 in enumerate(segments):
                if j <= i or j in used:
                    continue
                
                # Check if segments share an endpoint
                if self._share_endpoint(seg1, seg2):
                    # Check collinearity
                    if self._are_collinear(seg1, seg2):
                        # Merge segments
                        merged_coords = self._merge_segment_coords(seg1, seg2)
                        merged_length = self._calculate_length(merged_coords)
                        
                        # Create merged segment
                        merged_segment = BoundarySegment(
                            segment_id=f"merged_{seg1.segment_id}_{seg2.segment_id}",
                            coordinates=merged_coords,
                            raw_reliability=max(seg1.raw_reliability, seg2.raw_reliability),
                            calibrated_confidence=max(seg1.calibrated_confidence, seg2.calibrated_confidence),
                            epistemic_uncertainty=min(seg1.epistemic_uncertainty, seg2.epistemic_uncertainty),
                            aleatoric_uncertainty=min(seg1.aleatoric_uncertainty, seg2.aleatoric_uncertainty),
                            length=merged_length
                        )
                        
                        used.add(j)
                        current_segment = merged_segment
            
            merged_segments.append(current_segment)
            used.add(i)
        
        return merged_segments
    
    def _share_endpoint(self, seg1: BoundarySegment, seg2: BoundarySegment) -> bool:
        """Checks if two segments share an endpoint."""
        tolerance = 1e-6
        return (np.allclose(seg1.coordinates[0], seg2.coordinates[0], atol=tolerance) or
                np.allclose(seg1.coordinates[0], seg2.coordinates[-1], atol=tolerance) or
                np.allclose(seg1.coordinates[-1], seg2.coordinates[0], atol=tolerance) or
                np.allclose(seg1.coordinates[-1], seg2.coordinates[-1], atol=tolerance))
    
    def _are_collinear(self, seg1: BoundarySegment, seg2: BoundarySegment) -> bool:
        """Checks if two segments are collinear within angle threshold."""
        # Calculate segment vectors
        vec1 = np.array(seg1.coordinates[-1]) - np.array(seg1.coordinates[0])
        vec2 = np.array(seg2.coordinates[-1]) - np.array(seg2.coordinates[0])
        
        # Calculate angle between vectors
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        
        if norm1 == 0 or norm2 == 0:
            return False
        
        cos_angle = dot_product / (norm1 * norm2)
        cos_angle = np.clip(cos_angle, -1, 1)
        angle_deg = np.degrees(np.arccos(cos_angle))
        
        return angle_deg < self.collinear_angle_threshold or angle_deg > (180 - self.collinear_angle_threshold)
    
    def _merge_segment_coords(self, seg1: BoundarySegment, seg2: BoundarySegment) -> List[Tuple[float, float]]:
        """Merges coordinates of two segments."""
        # Find shared endpoint and merge
        if np.allclose(seg1.coordinates[-1], seg2.coordinates[0]):
            return seg1.coordinates[:-1] + seg2.coordinates
        elif np.allclose(seg1.coordinates[0], seg2.coordinates[-1]):
            return seg2.coordinates[:-1] + seg1.coordinates
        elif np.allclose(seg1.coordinates[0], seg2.coordinates[0]):
            return seg1.coordinates[::-1] + seg2.coordinates[1:]
        elif np.allclose(seg1.coordinates[-1], seg2.coordinates[-1]):
            return seg1.coordinates + seg2.coordinates[::-1][1:]
        else:
            return seg1.coordinates  # Fallback
    
    def _calculate_length(self, coordinates: List[Tuple[float, float]]) -> float:
        """Calculates segment length."""
        if len(coordinates) < 2:
            return 0.0
        
        total_length = 0.0
        for i in range(len(coordinates) - 1):
            p1 = np.array(coordinates[i])
            p2 = np.array(coordinates[i + 1])
            total_length += np.linalg.norm(p2 - p1)
        
        return total_length


class GraphConstructor:
    """
    Module 12: Candidate Boundary Graph Construction
    Formulates refined vector line network into weighted planar graph.
    """
    
    def __init__(self, lambda_length: float = 0.1):
        self.lambda_length = lambda_length
    
    def construct_planar_graph(self, segments: List[BoundarySegment]) -> Dict[str, Any]:
        """
        Constructs weighted planar graph G=(V,E,W).
        
        Args:
            segments: List of boundary segments
            
        Returns:
            Graph dictionary with vertices, edges, and weights
        """
        if not HAS_GRAPH_LIBS:
            return self._construct_simple_graph(segments)
        
        G = nx.Graph()
        
        # Add vertices (endpoints and junctions)
        vertex_id = 0
        coord_to_vertex = {}
        
        for segment in segments:
            for coord in [segment.coordinates[0], segment.coordinates[-1]]:
                coord_key = (round(coord[0], 7), round(coord[1], 7))
                if coord_key not in coord_to_vertex:
                    coord_to_vertex[coord_key] = vertex_id
                    G.add_node(vertex_id, position=coord)
                    vertex_id += 1
        
        # Add edges with weights
        for segment in segments:
            start_coord = segment.coordinates[0]
            end_coord = segment.coordinates[-1]
            
            start_key = (round(start_coord[0], 7), round(start_coord[1], 7))
            end_key = (round(end_coord[0], 7), round(end_coord[1], 7))
            
            start_vertex = coord_to_vertex[start_key]
            end_vertex = coord_to_vertex[end_key]
            
            # Calculate edge weight: W(e) = -log(C*) + lambda * length
            confidence = segment.calibrated_confidence
            length = segment.length
            weight = -np.log(confidence + 1e-10) + self.lambda_length * length
            
            G.add_edge(start_vertex, end_vertex, 
                      weight=weight,
                      confidence=confidence,
                      length=length,
                      segment_id=segment.segment_id)
        
        return {
            "graph": G,
            "num_vertices": G.number_of_nodes(),
            "num_edges": G.number_of_edges(),
            "is_planar": nx.check_planarity(G)[0] if G.number_of_nodes() > 0 else True
        }
    
    def _construct_simple_graph(self, segments: List[BoundarySegment]) -> Dict[str, Any]:
        """Simplified graph construction without NetworkX."""
        vertices = []
        edges = []
        vertex_id = 0
        coord_to_vertex = {}
        
        for segment in segments:
            for coord in [segment.coordinates[0], segment.coordinates[-1]]:
                coord_key = (round(coord[0], 7), round(coord[1], 7))
                if coord_key not in coord_to_vertex:
                    coord_to_vertex[coord_key] = vertex_id
                    vertices.append({"id": vertex_id, "position": coord})
                    vertex_id += 1
            
            start_coord = segment.coordinates[0]
            end_coord = segment.coordinates[-1]
            
            start_key = (round(start_coord[0], 7), round(start_coord[1], 7))
            end_key = (round(end_coord[0], 7), round(end_coord[1], 7))
            
            start_vertex = coord_to_vertex[start_key]
            end_vertex = coord_to_vertex[end_key]
            
            confidence = segment.calibrated_confidence
            length = segment.length
            weight = -np.log(confidence + 1e-10) + self.lambda_length * length
            
            edges.append({
                "start": start_vertex,
                "end": end_vertex,
                "weight": weight,
                "confidence": confidence,
                "length": length,
                "segment_id": segment.segment_id
            })
        
        return {
            "vertices": vertices,
            "edges": edges,
            "num_vertices": len(vertices),
            "num_edges": len(edges),
            "is_planar": True  # Assume planar for simplified version
        }


class GraphOptimizer:
    """
    Module 13: Graph Optimization and Boundary Linking
    Eliminates dead-end dangling edges and solves for optimal closed boundary cycles.
    """
    
    def __init__(self, high_confidence_threshold: float = 0.9):
        self.high_confidence_threshold = high_confidence_threshold
    
    def prune_dangling_leaves(self, graph_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Prunes dangling leaves (degree 1 nodes) unless edge confidence exceeds threshold.
        
        Args:
            graph_data: Graph dictionary from GraphConstructor
            
        Returns:
            Pruned graph data
        """
        if HAS_GRAPH_LIBS and "graph" in graph_data:
            G = graph_data["graph"]
            G_copy = G.copy()
            
            # Find and prune leaves
            leaves_to_remove = []
            for node in G_copy.nodes():
                if G_copy.degree(node) == 1:
                    # Check edge confidence
                    edges = list(G_copy.edges(node, data=True))
                    if edges:
                        edge_data = edges[0][2]
                        if edge_data.get("confidence", 0) < self.high_confidence_threshold:
                            leaves_to_remove.append(node)
            
            G_copy.remove_nodes_from(leaves_to_remove)
            
            graph_data["graph"] = G_copy
            graph_data["num_vertices"] = G_copy.number_of_nodes()
            graph_data["num_edges"] = G_copy.number_of_edges()
            graph_data["pruned_leaves"] = len(leaves_to_remove)
        
        return graph_data
    
    def find_closed_cycles(self, graph_data: Dict[str, Any]) -> List[List[int]]:
        """
        Finds optimal closed boundary cycles in the graph.
        
        Args:
            graph_data: Graph dictionary
            
        Returns:
            List of cycles (each cycle is a list of vertex IDs)
        """
        if HAS_GRAPH_LIBS and "graph" in graph_data:
            G = graph_data["graph"]
            
            # Find cycles using NetworkX cycle_basis
            cycles = list(nx.cycle_basis(G))
            
            # Sort cycles by length (prefer smaller cycles for parcels)
            cycles.sort(key=len)
            
            return cycles
        else:
            # Simplified cycle detection
            return self._find_simple_cycles(graph_data)
    
    def _find_simple_cycles(self, graph_data: Dict[str, Any]) -> List[List[int]]:
        """Simplified cycle detection without NetworkX."""
        # This is a placeholder - actual implementation would use DFS
        return []


class ParcelReconstructor:
    """
    Module 14: Topology-Constrained Parcel Reconstruction
    Reconstructs adjacent parcel polygons from shared graph edges.
    """
    
    def reconstruct_parcels_from_graph(self, graph_data: Dict[str, Any], 
                                      cycles: List[List[int]]) -> List[Dict[str, Any]]:
        """
        Reconstructs adjacent parcel polygons from planar face traversal.
        
        Args:
            graph_data: Graph dictionary
            cycles: List of closed cycles
            
        Returns:
            List of reconstructed parcels
        """
        parcels = []
        
        if HAS_GRAPH_LIBS and "graph" in graph_data:
            G = graph_data["graph"]
            
            for cycle_idx, cycle in enumerate(cycles):
                if len(cycle) < 3:
                    continue  # Need at least 3 vertices for a polygon
                
                # Extract coordinates from cycle
                coordinates = []
                for vertex_id in cycle:
                    if G.has_node(vertex_id):
                        position = G.nodes[vertex_id].get("position")
                        if position:
                            coordinates.append(position)
                
                if len(coordinates) >= 3:
                    # Close the polygon
                    coordinates.append(coordinates[0])
                    
                    # Create parcel
                    parcel = {
                        "parcel_id": f"PARCEL_{cycle_idx:04d}",
                        "coordinates": coordinates,
                        "num_vertices": len(coordinates),
                        "area": self._calculate_polygon_area(coordinates),
                        "perimeter": self._calculate_polygon_perimeter(coordinates),
                        "shared_edges": self._identify_shared_edges(cycle, cycles)
                    }
                    
                    parcels.append(parcel)
        
        return parcels
    
    def _calculate_polygon_area(self, coordinates: List[Tuple[float, float]]) -> float:
        """Calculates polygon area using Shoelace formula."""
        if len(coordinates) < 3:
            return 0.0
        
        area = 0.0
        n = len(coordinates)
        
        for i in range(n):
            x1, y1 = coordinates[i]
            x2, y2 = coordinates[(i + 1) % n]
            area += (x1 * y2) - (x2 * y1)
        
        return abs(area) / 2.0
    
    def _calculate_polygon_perimeter(self, coordinates: List[Tuple[float, float]]) -> float:
        """Calculates polygon perimeter."""
        if len(coordinates) < 2:
            return 0.0
        
        perimeter = 0.0
        for i in range(len(coordinates) - 1):
            p1 = np.array(coordinates[i])
            p2 = np.array(coordinates[i + 1])
            perimeter += np.linalg.norm(p2 - p1)
        
        return perimeter
    
    def _identify_shared_edges(self, cycle: List[int], all_cycles: List[List[int]]) -> List[str]:
        """Identifies edges shared with other parcels."""
        shared_edges = []
        
        # Convert cycle to edge set
        cycle_edges = set()
        for i in range(len(cycle)):
            edge = tuple(sorted([cycle[i], cycle[(i + 1) % len(cycle)]]))
            cycle_edges.add(edge)
        
        # Check against other cycles
        for other_cycle in all_cycles:
            if other_cycle == cycle:
                continue
            
            for i in range(len(other_cycle)):
                edge = tuple(sorted([other_cycle[i], other_cycle[(i + 1) % len(other_cycle)]]))
                if edge in cycle_edges:
                    shared_edges.append(f"shared_with_cycle_{all_cycles.index(other_cycle)}")
        
        return shared_edges


# Global instances
uncertainty_calibrator = UncertaintyCalibrator()
boundary_refiner = BoundaryRefiner()
graph_constructor = GraphConstructor()
graph_optimizer = GraphOptimizer()
parcel_reconstructor = ParcelReconstructor()